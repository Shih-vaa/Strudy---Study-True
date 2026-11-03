import { app, BrowserWindow, session } from 'electron';
import { MEDIA_SCHEME } from '../shared/media';
import { registerIpc } from './ipc';
import { registerMediaProtocol, registerMediaScheme } from './media';
import { watchPower } from './power';
import { createMainWindow, devServerUrl } from './window';

app.setName('Strudy');

// Custom schemes must be registered before the app is ready.
registerMediaScheme();

const LOCAL_PROTOCOLS = new Set(['file:', 'data:', 'blob:', 'devtools:', `${MEDIA_SCHEME}:`]);

/** Enforce "no outbound network requests": cancel anything that is not local. */
function blockNetworkRequests(): void {
  const devHost = devServerUrl ? new URL(devServerUrl).host : null;
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    let allowed = false;
    try {
      const url = new URL(details.url);
      allowed = LOCAL_PROTOCOLS.has(url.protocol) || (devHost !== null && url.host === devHost);
    } catch {
      allowed = false;
    }
    if (!allowed) console.warn(`[strudy] blocked request: ${details.url}`);
    callback({ cancel: !allowed });
  });
}

// Only one instance: a second launch must not become a way around the lock.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.on('window-all-closed', () => app.quit());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });

  void app.whenReady().then(() => {
    blockNetworkRequests();
    registerMediaProtocol();
    registerIpc();
    watchPower();
    createMainWindow();
  });
}
