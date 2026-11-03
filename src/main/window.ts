import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sendToWindow } from './events';
import { watchFocus } from './focusLock';
import { allowQuit, isQuitAllowed } from './quitGate';

const RENDERER_INDEX = join(__dirname, '../renderer/index.html');

/** Set by scripts/dev.mjs; absent in a built/packaged app. */
export const devServerUrl = process.env.VITE_DEV_SERVER_URL;

/** True for the renderer's own page (dev server origin, or the built index.html). */
export function isAppUrl(url: string): boolean {
  if (devServerUrl) return new URL(url).origin === new URL(devServerUrl).origin;
  return url.startsWith(pathToFileURL(RENDERER_INDEX).href);
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Strudy',
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once('ready-to-show', () => win.show());
  watchFocus(win);

  // The close button, Cmd+W, Alt+F4 and Cmd+Q (app.quit closes every window first) all end
  // up here. Without the exit password they are blocked, and the renderer opens the dialog.
  win.on('close', (event) => {
    if (isQuitAllowed()) return;
    event.preventDefault();
    sendToWindow(win, 'app:exit-requested');
  });
  // Windows: logging off or shutting down must not be blocked.
  win.on('session-end', allowQuit);

  // The UI is a single page: never open new windows or navigate away from it.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });

  if (devServerUrl) {
    void win.loadURL(devServerUrl);
  } else {
    void win.loadFile(RENDERER_INDEX);
  }

  return win;
}
