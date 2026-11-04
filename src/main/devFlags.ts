import { app } from 'electron';

/**
 * Development-only switches, set as NAME=0 in the environment (for example
 * STRUDY_FOCUS_LOCK=0). They are ignored in packaged builds, so they cannot be used to
 * switch the lock off for someone who only has the installed app.
 */
export function devSwitchOff(name: string): boolean {
  return !app.isPackaged && process.env[name] === '0';
}

/**
 * Reload and DevTools are development tools: available when running from source, never in a
 * packaged build. STRUDY_DEV_TOOLS=0 turns them off from source too, to see what the installed
 * app does.
 */
export function devToolsAllowed(): boolean {
  return !app.isPackaged && !devSwitchOff('STRUDY_DEV_TOOLS');
}

/** The same, for switches that turn something on (NAME=1). */
export function devSwitchOn(name: string): boolean {
  return !app.isPackaged && process.env[name] === '1';
}
