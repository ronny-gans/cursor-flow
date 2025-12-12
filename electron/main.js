const { app, BrowserWindow, ipcMain, screen, desktopCapturer, session, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');

let mainWindow;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function buildContentSecurityPolicy(dev) {
  const sources = {
    self: "'self'",
    unsafeInline: "'unsafe-inline'",
  };

  const connectSrc = [
    sources.self,
    'https:',
    'wss:',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
  ];

  if (dev) {
    connectSrc.push('http://localhost:3000', 'ws://localhost:3000');
  }

  const scriptSrc = [
    sources.self,
    sources.unsafeInline,
    'https://aistudiocdn.com',
  ];

  if (dev) {
    scriptSrc.push('http://localhost:3000');
  }

  return [
    `default-src ${sources.self}`,
    `base-uri ${sources.self}`,
    "object-src 'none'",
    `frame-src 'none'`,
    `script-src ${scriptSrc.join(' ')}`,
    `style-src ${[sources.self, sources.unsafeInline, 'https://fonts.googleapis.com'].join(' ')}`,
    `font-src ${[sources.self, 'https://fonts.gstatic.com', 'data:'].join(' ')}`,
    `img-src ${[sources.self, 'data:', 'blob:'].join(' ')}`,
    `media-src ${[sources.self, 'data:', 'blob:'].join(' ')}`,
    `worker-src ${[sources.self, 'blob:'].join(' ')}`,
    `connect-src ${connectSrc.join(' ')}`,
  ].join('; ');
}

let robot;
try {
  robot = require('robotjs');
} catch (e) {
  console.error('Failed to load robotjs:', e.message);
}

let mouseTrackingInterval;

function startMouseTracking() {
  if (!robot) return;
  if (mouseTrackingInterval) return;

  let lastX = -1;
  let lastY = -1;

  mouseTrackingInterval = setInterval(() => {
    const mousePos = robot.getMousePos();
    if (mousePos.x === lastX && mousePos.y === lastY) return;
    lastX = mousePos.x;
    lastY = mousePos.y;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mouse-position', {
        x: mousePos.x,
        y: mousePos.y,
        timestamp: Date.now()
      });
    }
  }, 16);
}

function stopMouseTracking() {
  if (mouseTrackingInterval) {
    clearInterval(mouseTrackingInterval);
    mouseTrackingInterval = null;
  }
}

// Handle Squirrel events for Windows installer
if (require('electron-squirrel-startup')) {
  app.quit();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...(details.responseHeaders || {}) };
    const csp = buildContentSecurityPolicy(isDev);

    responseHeaders['Content-Security-Policy'] = [csp];
    responseHeaders['Content-Security-Policy-Report-Only'] = [];

    callback({ responseHeaders });
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
      return;
    }
    callback(false);
  });

  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media') return true;
    return false;
  });

  ipcMain.handle('get-screen-size', () => {
    const primaryDisplay = screen.getPrimaryDisplay();
    return primaryDisplay.size;
  });

  ipcMain.handle('close-devtools', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.closeDevTools();
    }
    return true;
  });

  ipcMain.handle('start-mouse-tracking', () => {
    startMouseTracking();
    return { success: true };
  });

  ipcMain.handle('stop-mouse-tracking', () => {
    stopMouseTracking();
    return { success: true };
  });

  ipcMain.handle('get-window-bounds', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    return mainWindow.getBounds();
  });

  ipcMain.handle('save-project-file', async (event, payload) => {
    const data = payload?.data;
    const defaultPath = payload?.defaultPath;
    if (typeof data !== 'string') return { canceled: true, filePath: null };

    let filePath = payload?.filePath;
    if (!filePath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Project',
        defaultPath: defaultPath || 'cursor-flow-project.cursorflow.json',
        filters: [{ name: 'Cursor Flow Project', extensions: ['json'] }]
      });
      if (result.canceled || !result.filePath) return { canceled: true, filePath: null };
      filePath = result.filePath;
    }

    await fs.writeFile(filePath, data, 'utf8');
    return { canceled: false, filePath };
  });

  ipcMain.handle('reveal-item-in-folder', async (event, filePath) => {
    if (typeof filePath !== 'string' || filePath.length === 0) return false;
    try {
      shell.showItemInFolder(filePath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('get-desktop-sources', async (event, types) => {
    const sources = await desktopCapturer.getSources({ 
      types: types || ['screen', 'window'],
      thumbnailSize: { width: 150, height: 150 }
    });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      display_id: source.display_id,
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }));
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
