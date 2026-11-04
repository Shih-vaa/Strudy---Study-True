import { app, dialog, type BrowserWindow, type SaveDialogOptions } from 'electron';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { formatLocalDateTime, sessionsToCsv } from '../shared/csv';
import { suspendFocusLock } from './focusLock';
import { listSessions } from './store';

/**
 * Asks where to save (a native dialog, so only a place the user picked is ever written to),
 * then writes every stored session as CSV. Returns the path, or null if the user cancelled.
 */
export async function exportSessionsCsv(parent: BrowserWindow | null): Promise<string | null> {
  const day = formatLocalDateTime(Date.now()).slice(0, 10);
  const options: SaveDialogOptions = {
    title: 'Export sessions',
    defaultPath: join(app.getPath('documents'), `strudy-sessions-${day}.csv`),
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  };

  // Our own dialog takes focus; do not fight it by pulling the window back to the front.
  const resumeFocusLock = suspendFocusLock();
  let result: Electron.SaveDialogReturnValue;
  try {
    result = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options);
  } finally {
    resumeFocusLock();
  }
  if (result.canceled || !result.filePath) return null;

  await writeFile(result.filePath, sessionsToCsv(listSessions()), 'utf8');
  return result.filePath;
}
