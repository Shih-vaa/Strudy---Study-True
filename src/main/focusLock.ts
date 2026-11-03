import { app, BrowserWindow } from 'electron';
import type { IpcEventChannel } from '../shared/types';

/** How long after losing focus Strudy tries to take it back. */
const REFOCUS_DELAY_MS = 250;

/**
 * On by default. STRUDY_FOCUS_LOCK=0 turns off only the "take focus back" part (handy while
 * developing, since otherwise switching to your editor pulls Strudy back to the front).
 * The blur/focus events, pausing and logging are unaffected.
 */
const regainEnabled = process.env.STRUDY_FOCUS_LOCK !== '0';

let suspensions = 0;
let quitting = false;

app.on('before-quit', () => {
  quitting = true;
});

/**
 * Holds off regaining focus until the returned function is called, for things that
 * legitimately take focus themselves, such as our own native file dialog.
 */
export function suspendFocusLock(): () => void {
  suspensions += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    suspensions -= 1;
  };
}

function notify(win: BrowserWindow, channel: IpcEventChannel): void {
  if (!win.isDestroyed()) win.webContents.send(channel);
}

function regainFocus(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  // macOS: the whole app has to come forward before the window can take focus.
  if (process.platform === 'darwin') app.focus({ steal: true });
  // Windows: the OS may refuse to give focus to a background app and flash the taskbar
  // button instead; there is no reliable way around that without native hooks.
  win.show();
  win.focus();
  win.moveTop();
}

/** Forwards focus changes to the renderer and tries to regain focus shortly after losing it. */
export function watchFocus(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null;

  const cancelPending = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  win.on('blur', () => {
    notify(win, 'window:blur');
    if (!regainEnabled || quitting) return;
    cancelPending();
    timer = setTimeout(() => {
      timer = null;
      if (quitting || suspensions > 0 || win.isDestroyed() || win.isFocused()) return;
      regainFocus(win);
    }, REFOCUS_DELAY_MS);
  });

  win.on('focus', () => {
    cancelPending();
    notify(win, 'window:focus');
  });

  win.on('closed', cancelPending);
}
