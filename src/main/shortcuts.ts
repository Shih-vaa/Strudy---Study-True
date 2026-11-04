// Blocks the reload and DevTools keyboard shortcuts. Pure matching (so it can be tested) plus one
// small function that attaches it to a window. Only the types come from electron.
import type { Input, WebContents } from 'electron';

type KeyInput = Pick<Input, 'type' | 'code' | 'control' | 'alt' | 'shift' | 'meta'>;

const INSPECT_CODES = new Set(['KeyI', 'KeyJ', 'KeyC']);

/**
 * Reload (which would wipe the "Come back to study" screen) and DevTools (which would let
 * someone poke at the running app). Matched on the physical key (`code`) because on a Mac
 * Option+I types a different character.
 */
export function isBlockedShortcut(input: KeyInput): boolean {
  if (input.type !== 'keyDown') return false;
  const { code, control, alt, shift, meta } = input;

  // Reload: Cmd/Ctrl+R, Cmd/Ctrl+Shift+R, F5, Ctrl+F5.
  if (code === 'KeyR' && (meta || control) && !alt) return true;
  if (code === 'F5') return true;

  // DevTools: F12, Cmd+Option+I/J/C (macOS), Ctrl+Shift+I/J/C (Windows and Linux).
  if (code === 'F12') return true;
  if (INSPECT_CODES.has(code) && ((meta && alt) || (control && shift))) return true;

  return false;
}

/** Stops the blocked shortcuts before the page or the menu sees them. */
export function blockShortcuts(contents: WebContents): void {
  contents.on('before-input-event', (event, input) => {
    if (isBlockedShortcut(input)) event.preventDefault();
  });
}
