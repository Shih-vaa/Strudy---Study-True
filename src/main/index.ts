import { app, BrowserWindow, Menu, session } from 'electron';
import { MEDIA_SCHEME } from '../shared/media';
import { devToolsAllowed } from './devFlags';
import { registerIpc } from './ipc';
import { registerMediaProtocol, registerMediaScheme } from './media';
import { buildMenuTemplate } from './menuTemplate';
import { fakeCameraRequested, registerPermissionHandlers } from './permissions';
import { getSettings } from './store';
import { watchPower } from './power';
import { findDebugSwitch } from './debugSwitches';
import { createMainWindow, devServerUrl, isAppUrl } from './window';

// The installed app will not start with a debugging switch (remote debugging, the inspector):
// it would let anyone drive the page from outside. Running from source is unaffected.
if (app.isPackaged && findDebugSwitch(process.argv) !== null) {
  process.exit(1);
}

app.setName('Strudy');

// Custom schemes must be registered before the app is ready.
registerMediaScheme();

// Development only: a synthetic test-pattern camera instead of the real one (see permissions.ts).
if (fakeCameraRequested()) app.commandLine.appendSwitch('use-fake-device-for-media-stream');

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
    registerPermissionHandlers(isAppUrl, () => getSettings().cameraCheck);
    Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate(devToolsAllowed())));
    registerMediaProtocol();
    registerIpc();
    watchPower();
    createMainWindow();
  });
}
