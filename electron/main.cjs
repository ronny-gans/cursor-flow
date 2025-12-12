const path = require('path');

// Electron модули доступны напрямую в Electron runtime
const { app, BrowserWindow, ipcMain, screen } = require('electron');

let robot;
try {
  robot = require('robotjs');
} catch (e) {
  console.error('Failed to load robotjs:', e.message);
}

let mainWindow;
let mouseTrackingInterval;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // В режиме разработки загружаем Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3002');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopMouseTracking();
  });
}

// Глобальное отслеживание позиции мыши через robotjs
function startMouseTracking() {
  if (mouseTrackingInterval) return;
  
  let lastX = 0, lastY = 0;
  
  mouseTrackingInterval = setInterval(() => {
    const mousePos = robot.getMousePos();
    
    // Отправляем только если позиция изменилась
    if (mousePos.x !== lastX || mousePos.y !== lastY) {
      lastX = mousePos.x;
      lastY = mousePos.y;
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('mouse-position', {
          x: mousePos.x,
          y: mousePos.y,
          timestamp: Date.now()
        });
      }
    }
  }, 16); // ~60 FPS
}

function stopMouseTracking() {
  if (mouseTrackingInterval) {
    clearInterval(mouseTrackingInterval);
    mouseTrackingInterval = null;
  }
}

app.whenReady().then(() => {
  // IPC handlers
  ipcMain.handle('start-mouse-tracking', () => {
    startMouseTracking();
    return { success: true };
  });

  ipcMain.handle('stop-mouse-tracking', () => {
    stopMouseTracking();
    return { success: true };
  });

  ipcMain.handle('get-mouse-position', () => {
    const mousePos = robot.getMousePos();
    return { x: mousePos.x, y: mousePos.y };
  });

  ipcMain.handle('get-screen-size', () => {
    const primaryDisplay = screen.getPrimaryDisplay();
    return primaryDisplay.size;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopMouseTracking();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
