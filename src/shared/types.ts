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

/** Changed from the Settings screen, which needs the exit password. */
export interface Settings {
  /** Take focus back shortly after the window loses it. */
  focusLock: boolean;
  /**
   * "Still studying?" comes after a random number of minutes of *studying* (not wall-clock
   * time) between these two, inclusive. Whole minutes, 1 to 180, shortest <= longest.
   */
  presenceMinMinutes: number;
  presenceMaxMinutes: number;
}

/** The presence-check timings in force, in milliseconds. */
export interface PresenceConfig {
  /** Study time between checks is a random value in [minMs, maxMs]. */
  minMs: number;
  maxMs: number;
  /** How long to wait for a click before pausing the video and logging a miss. */
  responseMs: number;
}

export type StudyEventType = 'focus_lost' | 'presence_missed' | 'auth_failed' | 'password_reset';

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
  /** Asks where to save and writes all sessions as CSV. The path, or null if cancelled. */
  'sessions:exportCsv': { args: []; result: string | null };
  /** Has the first-run exit password been created? */
  'auth:isSetup': { args: []; result: boolean };
  /**
   * First-run only: stores a scrypt hash of the password and makes a recovery key. Rejects if a
   * password already exists. Resolves the recovery key, which is shown once.
   */
  'auth:setup': { args: [password: string]; result: string };
  /**
   * Resets a forgotten password with the recovery key. Null for a wrong key. On success resolves a
   * fresh recovery key (the one used stops working).
   */
  'auth:recover': { args: [recoveryKey: string, newPassword: string]; result: string | null };
  /** Needs settings unlocked: is there a recovery key? */
  'auth:hasRecovery': { args: []; result: boolean };
  /** Needs settings unlocked: makes a new recovery key (the old one stops working) and returns it once. */
  'auth:newRecoveryKey': { args: []; result: string };
  /**
   * Verified in main. On success the given session is ended and saved, then the app quits
   * (the reply is true just before it does). False means a wrong password.
   */
  'auth:verifyAndQuit': { args: [password: string, session: Session | null]; result: boolean };
  /** Checks the password in main; if right, settings can be changed for a few minutes. */
  'auth:verify': { args: [password: string]; result: boolean };
  /** Locks settings again (leaving the Settings screen). */
  'auth:lock': { args: []; result: void };
  /** Verifies the current password, then replaces it. False means the current one was wrong. */
  'auth:changePassword': { args: [current: string, next: string]; result: boolean };
  'presence:getConfig': { args: []; result: PresenceConfig };
  'store:getSettings': { args: []; result: Settings };
  /** Rejects unless unlocked with auth:verify. Returns the settings now in force. */
  'store:setSettings': { args: [patch: Partial<Settings>]; result: Settings };
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
  /** Shows a save dialog and writes every session as CSV. Resolves the path, or null if cancelled. */
  exportSessionsCsv(): Promise<string | null>;
  isPasswordSet(): Promise<boolean>;
  /** First-run only. Resolves the recovery key, which is shown once. */
  setPassword(password: string): Promise<string>;
  /** Resolves null for a wrong recovery key, otherwise a fresh recovery key. */
  recoverPassword(recoveryKey: string, newPassword: string): Promise<string | null>;
  hasRecoveryKey(): Promise<boolean>;
  /** Makes a new recovery key (needs settings unlocked); the old one stops working. */
  newRecoveryKey(): Promise<string>;
  /** Resolves false for a wrong password; on success the app quits right after resolving true. */
  verifyAndQuit(password: string, session: Session | null): Promise<boolean>;
  /** Unlocks the Settings screen for a few minutes. Resolves false for a wrong password. */
  unlockSettings(password: string): Promise<boolean>;
  lockSettings(): Promise<void>;
  /** Resolves false if `current` is not the exit password. */
  changePassword(current: string, next: string): Promise<boolean>;
  getPresenceConfig(): Promise<PresenceConfig>;
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  /** Subscribes to a main-process event. Returns an unsubscribe function. */
  onEvent(channel: IpcEventChannel, callback: () => void): () => void;
}
