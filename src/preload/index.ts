import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannel, IpcInvokeMap, StrudyApi } from '../shared/types';

// Sandboxed preload: import only 'electron' at runtime, and shared *types* only.

function invoke<K extends IpcChannel>(
  channel: K,
  ...args: IpcInvokeMap[K]['args']
): Promise<IpcInvokeMap[K]['result']> {
  return ipcRenderer.invoke(channel, ...args);
}

const api: StrudyApi = {
  getAppInfo: () => invoke('app:getInfo'),
  openMedia: (kind) => invoke('files:openDialog', kind),
  getPosition: (path) => invoke('positions:get', path),
  setPosition: (path, seconds) => invoke('positions:set', path, seconds),
};

contextBridge.exposeInMainWorld('api', api);
