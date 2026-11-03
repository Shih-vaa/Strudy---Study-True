// Types shared by main, preload and renderer. Keep this file type-only: the
// sandboxed preload script cannot require local modules at runtime.

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  electron: string;
  chrome: string;
  node: string;
}

export type OpenDialogKind = 'file' | 'folder';

/** Request/response IPC channels (renderer -> main, via ipcRenderer.invoke). */
export interface IpcInvokeMap {
  'app:getInfo': { args: []; result: AppInfo };
  /** Shows a native picker; returns the playlist (absolute paths), or [] if cancelled/empty. */
  'files:openDialog': { args: [kind: OpenDialogKind]; result: string[] };
  /** Saved resume position in seconds, 0 if none. */
  'positions:get': { args: [path: string]; result: number };
  'positions:set': { args: [path: string, seconds: number]; result: void };
}

export type IpcChannel = keyof IpcInvokeMap;

/** The API exposed to the renderer as `window.api`. */
export interface StrudyApi {
  getAppInfo(): Promise<AppInfo>;
  openMedia(kind: OpenDialogKind): Promise<string[]>;
  getPosition(path: string): Promise<number>;
  setPosition(path: string, seconds: number): Promise<void>;
}
