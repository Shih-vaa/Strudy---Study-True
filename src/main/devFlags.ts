import { app } from 'electron';

/**
 * Development-only switches, set as NAME=0 in the environment (for example
 * STRUDY_FOCUS_LOCK=0). They are ignored in packaged builds, so they cannot be used to
 * switch the lock off for someone who only has the installed app.
 */
export function devSwitchOff(name: string): boolean {
  return !app.isPackaged && process.env[name] === '0';
}
