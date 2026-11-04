import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannel, IpcEventChannel, IpcInvokeMap, StrudyApi } from '../shared/types';

// Sandboxed preload: import only 'electron' at runtime, and shared *types* only.

const EVENT_CHANNELS: readonly IpcEventChannel[] = [
  'power:suspend',
  'power:resume',
  'window:blur',
  'window:focus',
  'app:exit-requested',
];

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
  exportSessionsCsv: () => invoke('sessions:exportCsv'),
  isPasswordSet: () => invoke('auth:isSetup'),
  setPassword: (password) => invoke('auth:setup', password),
  verifyAndQuit: (password, session) => invoke('auth:verifyAndQuit', password, session),
  unlockSettings: (password) => invoke('auth:verify', password),
  lockSettings: () => invoke('auth:lock'),
  changePassword: (current, next) => invoke('auth:changePassword', current, next),
  getPresenceConfig: () => invoke('presence:getConfig'),
  getSettings: () => invoke('store:getSettings'),
  setSettings: (patch) => invoke('store:setSettings', patch),
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
