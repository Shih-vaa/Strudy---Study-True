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
};

contextBridge.exposeInMainWorld('api', api);
