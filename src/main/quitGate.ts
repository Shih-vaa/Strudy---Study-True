import { devSwitchOff } from './devFlags';
import { getPasswordHash } from './store';

let allowed = false;

/** The exit password was verified (or the system is shutting down): let the app quit. */
export function allowQuit(): void {
  allowed = true;
}

/** True once quitting has been allowed and is in progress. */
export function isQuitting(): boolean {
  return allowed;
}

/**
 * Whether the window may close and the app may quit right now. Otherwise the close is
 * blocked and the exit dialog is shown instead. Before a password exists there is nothing
 * to ask for, so the owner is never locked into a half-set-up app.
 */
export function isQuitAllowed(): boolean {
  return allowed || devSwitchOff('STRUDY_EXIT_LOCK') || getPasswordHash() === null;
}
