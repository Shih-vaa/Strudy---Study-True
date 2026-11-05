import { app, BrowserWindow } from 'electron';
import { devSwitchOff } from './devFlags';
import { sendToWindow } from './events';
import { createFocusGate } from './focusGate';
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

/** How long after a system prompt closes to wait for the window to get its focus back before judging. */
const AFTER_PROMPT_MS = 1500;

const promptGate = createFocusGate();
let recheck: (() => void) | null = null;

/**
 * Call when Strudy itself opens a macOS system prompt (the camera permission). That prompt takes the
 * window's focus, which is not the person leaving: while it is up, the window losing focus is not
 * reported and not fought. Returns the function to call when the prompt closes. A moment after the
 * last prompt closes, if the window still does not have focus (she switched to another app while the
 * prompt was up), that is then reported as leaving, like any other.
 */
export function holdFocusEvents(): () => void {
  const release = promptGate.hold();
  return () => {
    if (release()) setTimeout(() => recheck?.(), AFTER_PROMPT_MS);
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

  const onLeft = (): void => {
    sendToWindow(win, 'window:blur');
    if (!regainEnabled() || isQuitting()) return;
    cancelPending();
    timer = setTimeout(() => {
      timer = null;
      if (isQuitting() || suspensions > 0 || win.isDestroyed() || win.isFocused()) return;
      regainFocus(win);
    }, REFOCUS_DELAY_MS);
  };

  win.on('blur', () => {
    // Our own system prompt took the focus: that is not leaving.
    if (promptGate.held) return;
    onLeft();
  });

  // After such a prompt: if the window did not get its focus back, she did leave meanwhile.
  recheck = () => {
    if (!win.isDestroyed() && !win.isFocused() && !promptGate.held) onLeft();
  };

  win.on('focus', () => {
    cancelPending();
    sendToWindow(win, 'window:focus');
  });

  win.on('closed', () => {
    cancelPending();
    recheck = null;
  });
}
