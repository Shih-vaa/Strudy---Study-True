import { app, ipcMain } from 'electron';
import type { AppInfo, IpcChannel, IpcInvokeMap } from '../shared/types';

type Handler<K extends IpcChannel> = (
  ...args: IpcInvokeMap[K]['args']
) => IpcInvokeMap[K]['result'] | Promise<IpcInvokeMap[K]['result']>;

function handle<K extends IpcChannel>(channel: K, handler: Handler<K>): void {
  ipcMain.handle(channel, (_event, ...args) => handler(...(args as IpcInvokeMap[K]['args'])));
}

export function registerIpc(): void {
  handle(
    'app:getInfo',
    (): AppInfo => ({
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
    }),
  );
}
