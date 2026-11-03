import { BrowserWindow } from 'electron';
import type { IpcEventChannel } from '../shared/types';

export function sendToWindow(win: BrowserWindow, channel: IpcEventChannel): void {
  if (!win.isDestroyed()) win.webContents.send(channel);
}

export function broadcast(channel: IpcEventChannel): void {
  for (const win of BrowserWindow.getAllWindows()) sendToWindow(win, channel);
}
