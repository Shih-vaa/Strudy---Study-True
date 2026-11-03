import Store from 'electron-store';

interface StoreSchema {
  /** Resume position in seconds, keyed by absolute file path. */
  positions: Record<string, number>;
}

/** Positions under this are treated as "not started" and not kept. */
const MIN_SAVED_SECONDS = 1;

let store: Store<StoreSchema> | null = null;

// Created lazily so app.setName() has run before the userData path is resolved.
function getStore(): Store<StoreSchema> {
  store ??= new Store<StoreSchema>({ name: 'strudy', defaults: { positions: {} } });
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
