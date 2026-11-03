import Store from 'electron-store';
import type { Session } from '../shared/types';

interface StoreSchema {
  /** Resume position in seconds, keyed by absolute file path. */
  positions: Record<string, number>;
  sessions: Session[];
}

/** Positions under this are treated as "not started" and not kept. */
const MIN_SAVED_SECONDS = 1;

let store: Store<StoreSchema> | null = null;

// Created lazily so app.setName() has run before the userData path is resolved.
function getStore(): Store<StoreSchema> {
  store ??= new Store<StoreSchema>({
    name: 'strudy',
    defaults: { positions: {}, sessions: [] },
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

export function listSessions(): Session[] {
  return getStore().get('sessions');
}

/** Insert, or replace the stored session with the same id (sessions autosave repeatedly). */
export function saveSession(session: Session): void {
  const sessions = [...getStore().get('sessions')];
  const index = sessions.findIndex((existing) => existing.id === session.id);
  if (index === -1) sessions.push(session);
  else sessions[index] = session;
  getStore().set('sessions', sessions);
}
