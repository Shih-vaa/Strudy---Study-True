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

/** Request/response IPC channels (renderer -> main, via ipcRenderer.invoke). */
export interface IpcInvokeMap {
  'app:getInfo': { args: []; result: AppInfo };
}

export type IpcChannel = keyof IpcInvokeMap;

/** The API exposed to the renderer as `window.api`. */
export interface StrudyApi {
  getAppInfo(): Promise<AppInfo>;
}
