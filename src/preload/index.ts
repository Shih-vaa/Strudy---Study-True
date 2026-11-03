import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannel, IpcEventChannel, IpcInvokeMap, StrudyApi } from '../shared/types';

// Sandboxed preload: import only 'electron' at runtime, and shared *types* only.

const EVENT_CHANNELS: readonly IpcEventChannel[] = ['power:suspend', 'power:resume'];

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
  saveSession: (session) => invoke('sessions:save', session),
  listSessions: () => invoke('sessions:list'),
  onEvent: (channel, callback) => {
    if (!EVENT_CHANNELS.includes(channel)) throw new Error(`Unknown event channel: ${channel}`);
    const listener = (): void => callback();
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
};

contextBridge.exposeInMainWorld('api', api);
