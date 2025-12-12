console.log('Starting test...');
console.log('process.versions.electron:', process.versions.electron);

// В Electron контексте нужно использовать встроенный модуль
const electron = process.versions.electron ? require('electron') : null;

// Проверяем, получили ли мы строку (путь) или объект
if (typeof electron === 'string') {
  console.log('Got path instead of module, trying process.electronBinding...');
  // Используем внутренний API Electron
  const { app, BrowserWindow } = process._linkedBinding('electron_browser_app') 
    ? { app: process._linkedBinding('electron_browser_app'), BrowserWindow: null }
    : require('electron');
  console.log('app via binding:', app);
} else if (electron && electron.app) {
  console.log('app:', electron.app);
  electron.app.whenReady().then(() => {
    console.log('App is ready!');
    electron.app.quit();
  });
} else {
  console.log('electron object:', electron);
  console.log('Not running in Electron context or module not loaded!');
}
