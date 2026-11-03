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
