const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Screen size
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),
  
  // Screen capture for recording (via IPC to main process)
  getDesktopSources: (types) => ipcRenderer.invoke('get-desktop-sources', types),

  closeDevTools: () => ipcRenderer.invoke('close-devtools'),

  startMouseTracking: () => ipcRenderer.invoke('start-mouse-tracking'),
  stopMouseTracking: () => ipcRenderer.invoke('stop-mouse-tracking'),
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),

  onMousePosition: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('mouse-position', handler);
    return () => ipcRenderer.removeListener('mouse-position', handler);
  },

  saveProjectFile: (payload) => ipcRenderer.invoke('save-project-file', payload),
  revealItemInFolder: (filePath) => ipcRenderer.invoke('reveal-item-in-folder', filePath)
});
