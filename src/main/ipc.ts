import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent,
  type OpenDialogOptions,
} from 'electron';
import { VIDEO_EXTENSIONS } from '../shared/media';
import { isSession } from '../shared/session';
import type { AppInfo, IpcChannel, IpcInvokeMap, OpenDialogKind } from '../shared/types';
import { isPasswordSet, setupPassword, verifyAndQuit } from './auth';
import { suspendFocusLock } from './focusLock';
import { grantMedia, listVideosInFolder } from './media';
import { getPosition, listSessions, saveSession, setPosition } from './store';
import { isAppUrl } from './window';

type Handler<K extends IpcChannel> = (
  event: IpcMainInvokeEvent,
  ...args: IpcInvokeMap[K]['args']
) => IpcInvokeMap[K]['result'] | Promise<IpcInvokeMap[K]['result']>;

function handle<K extends IpcChannel>(channel: K, handler: Handler<K>): void {
  ipcMain.handle(channel, (event, ...args) => {
    const senderUrl = event.senderFrame?.url;
    if (!senderUrl || !isAppUrl(senderUrl)) {
      throw new Error(`Rejected ${channel} from an untrusted frame`);
    }
    return handler(event, ...(args as IpcInvokeMap[K]['args']));
  });
}

function isOpenKind(value: unknown): value is OpenDialogKind {
  return value === 'file' || value === 'folder';
}

async function openMediaDialog(event: IpcMainInvokeEvent, kind: OpenDialogKind): Promise<string[]> {
  if (!isOpenKind(kind)) throw new Error('Invalid dialog kind');

  const options: OpenDialogOptions =
    kind === 'folder'
      ? { properties: ['openDirectory'] }
      : {
          properties: ['openFile'],
          filters: [{ name: 'Video', extensions: VIDEO_EXTENSIONS.map((ext) => ext.slice(1)) }],
        };
  const parent = BrowserWindow.fromWebContents(event.sender);
  // Our own dialog takes focus; do not fight it by pulling the window back to the front.
  const resumeFocusLock = suspendFocusLock();
  let result: Electron.OpenDialogReturnValue;
  try {
    result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options);
  } finally {
    resumeFocusLock();
  }

  const [picked] = result.filePaths;
  if (result.canceled || picked === undefined) return [];

  const paths = kind === 'folder' ? await listVideosInFolder(picked) : [picked];
  grantMedia(paths);
  return paths;
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

  handle('files:openDialog', openMediaDialog);

  handle('positions:get', (_event, path) => {
    if (typeof path !== 'string') throw new Error('Invalid path');
    return getPosition(path);
  });

  handle('positions:set', (_event, path, seconds) => {
    if (typeof path !== 'string' || !Number.isFinite(seconds) || seconds < 0) {
      throw new Error('Invalid position');
    }
    setPosition(path, seconds);
  });

  handle('sessions:save', (_event, session) => {
    if (!isSession(session)) throw new Error('Invalid session');
    saveSession(session);
  });

  handle('sessions:list', () => listSessions());

  handle('auth:isSetup', () => isPasswordSet());
  handle('auth:setup', (_event, password) => setupPassword(password));
  handle('auth:verifyAndQuit', (_event, password, session) => verifyAndQuit(password, session));
}
