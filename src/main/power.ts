import { BrowserWindow, powerMonitor } from 'electron';
import type { IpcEventChannel } from '../shared/types';

function broadcast(channel: IpcEventChannel): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(channel);
}

/**
 * Tells the renderer when the machine goes to sleep or the screen locks (power:suspend)
 * and when it is neither (power:resume). Sleep and lock are tracked separately so that
 * waking from sleep onto a still-locked screen does not count as active.
 */
export function watchPower(): void {
  let suspended = false;
  let locked = false;
  let inactive = false;

  const update = (): void => {
    const next = suspended || locked;
    if (next === inactive) return;
    inactive = next;
    broadcast(next ? 'power:suspend' : 'power:resume');
  };

  powerMonitor.on('suspend', () => {
    suspended = true;
    update();
  });
  powerMonitor.on('resume', () => {
    suspended = false;
    update();
  });
  powerMonitor.on('lock-screen', () => {
    locked = true;
    update();
  });
  powerMonitor.on('unlock-screen', () => {
    locked = false;
    update();
  });
}
