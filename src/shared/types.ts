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
  /** Has the first-run exit password been created? */
  'auth:isSetup': { args: []; result: boolean };
  /** First-run only: stores a scrypt hash of the password. Rejects if one already exists. */
  'auth:setup': { args: [password: string]; result: void };
  /**
   * Verified in main. On success the given session is ended and saved, then the app quits
   * (the reply is true just before it does). False means a wrong password.
   */
  'auth:verifyAndQuit': { args: [password: string, session: Session | null]; result: boolean };
}

export type IpcChannel = keyof IpcInvokeMap;

/**
 * Events pushed from main to the renderer. power:suspend means the machine is asleep or
 * the screen is locked; power:resume means it is neither. window:blur / window:focus mirror
 * the BrowserWindow losing and regaining focus. app:exit-requested means a close or quit was
 * blocked, so the exit password dialog should open.
 */
export type IpcEventChannel =
  | 'power:suspend'
  | 'power:resume'
  | 'window:blur'
  | 'window:focus'
  | 'app:exit-requested';

/** The API exposed to the renderer as `window.api`. */
export interface StrudyApi {
  getAppInfo(): Promise<AppInfo>;
  openMedia(kind: OpenDialogKind): Promise<string[]>;
  getPosition(path: string): Promise<number>;
  setPosition(path: string, seconds: number): Promise<void>;
  saveSession(session: Session): Promise<void>;
  listSessions(): Promise<Session[]>;
  isPasswordSet(): Promise<boolean>;
  setPassword(password: string): Promise<void>;
  /** Resolves false for a wrong password; on success the app quits right after resolving true. */
  verifyAndQuit(password: string, session: Session | null): Promise<boolean>;
  /** Subscribes to a main-process event. Returns an unsubscribe function. */
  onEvent(channel: IpcEventChannel, callback: () => void): () => void;
}
