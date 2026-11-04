import { app, BrowserWindow } from 'electron';
import { devSwitchOff } from './devFlags';
import { sendToWindow } from './events';
import { isQuitting } from './quitGate';
import { getSettings } from './store';

/** How long after losing focus Strudy tries to take it back. */
const REFOCUS_DELAY_MS = 250;

/**
 * The "take focus back" part is on by default and can be switched off in Settings (which needs
 * the exit password). STRUDY_FOCUS_LOCK=0 switches it off for development; that is ignored in
 * packaged builds. Read at each blur, so a change applies immediately. The blur/focus events,
 * pausing and logging are unaffected either way.
 */
const regainEnabled = (): boolean => !devSwitchOff('STRUDY_FOCUS_LOCK') && getSettings().focusLock;

let suspensions = 0;

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
    sendToWindow(win, 'window:blur');
    if (!regainEnabled() || isQuitting()) return;
    cancelPending();
    timer = setTimeout(() => {
      timer = null;
      if (isQuitting() || suspensions > 0 || win.isDestroyed() || win.isFocused()) return;
      regainFocus(win);
    }, REFOCUS_DELAY_MS);
  });

  win.on('focus', () => {
    cancelPending();
    sendToWindow(win, 'window:focus');
  });

  win.on('closed', cancelPending);
}
