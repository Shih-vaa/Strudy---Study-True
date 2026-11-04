import { app } from 'electron';
import { validatePasswordLength } from '../shared/auth';
import { isSession } from '../shared/session';
import { hashPassword, verifyPassword } from './password';
import { allowQuit } from './quitGate';
import { getPasswordHash, saveSession, setPasswordHash } from './store';

export function isPasswordSet(): boolean {
  return getPasswordHash() !== null;
}

/** First-run setup. Refuses to replace an existing password. */
export async function setupPassword(password: unknown): Promise<void> {
  if (isPasswordSet()) throw new Error('An exit password is already set');
  if (typeof password !== 'string') throw new Error('Invalid password');
  const problem = validatePasswordLength(password);
  if (problem) throw new Error(problem);
  setPasswordHash(await hashPassword(password));
}

/** How long the Settings screen stays unlocked after the password was entered. */
const SETTINGS_UNLOCK_MS = 5 * 60 * 1000;
let settingsUnlockedUntil = 0;

/** Settings can be changed only shortly after the password was entered (or while none exists). */
export function isSettingsUnlocked(): boolean {
  return getPasswordHash() === null || Date.now() < settingsUnlockedUntil;
}

/** Checks the password in main; if right, unlocks changing settings for a few minutes. */
export async function unlockSettings(password: unknown): Promise<boolean> {
  const stored = getPasswordHash();
  if (stored === null) return true;
  if (typeof password !== 'string' || !(await verifyPassword(password, stored))) return false;
  settingsUnlockedUntil = Date.now() + SETTINGS_UNLOCK_MS;
  return true;
}

export function lockSettings(): void {
  settingsUnlockedUntil = 0;
}

/**
 * Replaces the exit password. The current one is required again (not just the unlock), and
 * the new one must meet the same rules as at setup. False means the current one was wrong.
 */
export async function changePassword(current: unknown, next: unknown): Promise<boolean> {
  const stored = getPasswordHash();
  if (stored === null) throw new Error('No exit password is set yet');
  if (typeof current !== 'string' || !(await verifyPassword(current, stored))) return false;
  if (typeof next !== 'string') throw new Error('Invalid password');
  const problem = validatePasswordLength(next);
  if (problem) throw new Error(problem);
  setPasswordHash(await hashPassword(next));
  return true;
}

/**
 * Checks the password here in main, never in the renderer. On success it ends and saves the
 * session first (the renderer sends its latest copy), then allows the app to quit.
 * Returns false for a wrong password; nothing else changes.
 */
export async function verifyAndQuit(password: unknown, session: unknown): Promise<boolean> {
  const stored = getPasswordHash();
  if (stored === null || typeof password !== 'string') return false;
  if (!(await verifyPassword(password, stored))) return false;

  // A damaged session payload must not stop someone who knows the password from leaving.
  if (isSession(session)) saveSession({ ...session, endedAt: Date.now() });

  allowQuit();
  // Quit after this reply has gone back to the renderer.
  setImmediate(() => app.quit());
  return true;
}
