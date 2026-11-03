import Store from 'electron-store';
import { upsertSession } from '../shared/session';
import type { Session } from '../shared/types';
import { isStoredPasswordHash, type StoredPasswordHash } from './password';

interface StoreSchema {
  /** Resume position in seconds, keyed by absolute file path. */
  positions: Record<string, number>;
  sessions: Session[];
  /** The exit password's scrypt hash; null until first-run setup. */
  auth: StoredPasswordHash | null;
}

/** Positions under this are treated as "not started" and not kept. */
const MIN_SAVED_SECONDS = 1;

let store: Store<StoreSchema> | null = null;

// Created lazily so app.setName() has run before the userData path is resolved.
function getStore(): Store<StoreSchema> {
  store ??= new Store<StoreSchema>({
    name: 'strudy',
    defaults: { positions: {}, sessions: [], auth: null },
  });
  return store;
}

export function getPosition(path: string): number {
  // The whole record is read/written because file paths contain dots, which
  // electron-store would otherwise treat as nested-key separators.
  return getStore().get('positions')[path] ?? 0;
}

export function setPosition(path: string, seconds: number): void {
  const positions = { ...getStore().get('positions') };
  if (seconds >= MIN_SAVED_SECONDS) {
    positions[path] = seconds;
  } else {
    delete positions[path];
  }
  getStore().set('positions', positions);
}

/** The stored password hash, or null if none is set (or the stored value is unusable). */
export function getPasswordHash(): StoredPasswordHash | null {
  const stored = getStore().get('auth');
  return isStoredPasswordHash(stored) ? stored : null;
}

export function setPasswordHash(hash: StoredPasswordHash): void {
  getStore().set('auth', hash);
}

export function listSessions(): Session[] {
  return getStore().get('sessions');
}

/** Insert, or replace the stored session with the same id (sessions autosave repeatedly). */
export function saveSession(session: Session): void {
  getStore().set('sessions', upsertSession(getStore().get('sessions'), session));
}
