interface ScreenSize {
  width: number;
  height: number;
}

interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string;
  display_id: string;
  appIcon: string | null;
}

interface ElectronAPI {
  getScreenSize: () => Promise<ScreenSize>;
  getDesktopSources: (types?: string[]) => Promise<DesktopSource[]>;
  closeDevTools: () => Promise<boolean>;
  startMouseTracking: () => Promise<{ success: boolean }>;
  stopMouseTracking: () => Promise<{ success: boolean }>;
  getWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number } | null>;
  onMousePosition: (callback: (data: { x: number; y: number; timestamp: number }) => void) => () => void;
  saveProjectFile: (payload: { data: string; defaultPath?: string; filePath?: string | null }) => Promise<{ canceled: boolean; filePath: string | null }>;
  revealItemInFolder: (filePath: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
