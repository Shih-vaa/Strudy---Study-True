// Types shared by main, preload and renderer. Keep this file type-only: the
// sandboxed preload script cannot require local modules at runtime.

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  electron: string;
  chrome: string;
  node: string;
}

export type OpenDialogKind = 'file' | 'folder';

export type StudyEventType = 'focus_lost' | 'presence_missed' | 'auth_failed';

export interface StudyEvent {
  type: StudyEventType;
  /** Epoch milliseconds. */
  timestamp: number;
  detail?: string;
}

/** One launch of the app. Times are epoch milliseconds. */
export interface Session {
  id: string;
  startedAt: number;
  /** null until the app exits through the password, so a hard stop stays visible. */
  endedAt: number | null;
  /** Real (wall-clock) study time; playback speed never affects it. */
  studyMs: number;
  videosWatched: string[];
  focusLostCount: number;
  presenceMissedCount: number;
  pauseCount: number;
  events: StudyEvent[];
}

/** Request/response IPC channels (renderer -> main, via ipcRenderer.invoke). */
export interface IpcInvokeMap {
  'app:getInfo': { args: []; result: AppInfo };
  /** Shows a native picker; returns the playlist (absolute paths), or [] if cancelled/empty. */
  'files:openDialog': { args: [kind: OpenDialogKind]; result: string[] };
  /** Saved resume position in seconds, 0 if none. */
  'positions:get': { args: [path: string]; result: number };
  'positions:set': { args: [path: string, seconds: number]; result: void };
  /** Inserts the session, or replaces the stored one with the same id. */
  'sessions:save': { args: [session: Session]; result: void };
  'sessions:list': { args: []; result: Session[] };
}

export type IpcChannel = keyof IpcInvokeMap;

/**
 * Events pushed from main to the renderer. power:suspend means the machine is asleep or
 * the screen is locked; power:resume means it is neither.
 */
export type IpcEventChannel = 'power:suspend' | 'power:resume';

/** The API exposed to the renderer as `window.api`. */
export interface StrudyApi {
  getAppInfo(): Promise<AppInfo>;
  openMedia(kind: OpenDialogKind): Promise<string[]>;
  getPosition(path: string): Promise<number>;
  setPosition(path: string, seconds: number): Promise<void>;
  saveSession(session: Session): Promise<void>;
  listSessions(): Promise<Session[]>;
  /** Subscribes to a main-process event. Returns an unsubscribe function. */
  onEvent(channel: IpcEventChannel, callback: () => void): () => void;
}
