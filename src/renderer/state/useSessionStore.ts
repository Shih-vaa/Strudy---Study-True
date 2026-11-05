import { create } from 'zustand';
import {
  createSession,
  recordAuthFailed,
  recordCameraUnavailable,
  recordPasswordReset,
  recordPersonAway,
  recordPersonReturned,
  recordPresenceMissed,
} from '../../shared/session';
import type { OpenDialogKind, Session } from '../../shared/types';
import {
  cameraChange,
  reduceCamera,
  STARTING_CAMERA,
  type CameraConfig,
  type CameraEvent,
  type CameraState,
} from '../camera/cameraPresence';
import { recordFocusLost, recordFocusReturned, type FocusLoss } from '../focus/focusLoss';
import { clampSpeed, nextSpeed } from '../player/speed';
import { IDLE_PRESENCE, type PresenceState } from '../presence/presenceCheck';

type Screen = 'library' | 'player' | 'settings' | 'summary';

const newSession = (): Session => createSession(crypto.randomUUID(), Date.now());

/** A dialog or overlay is up, so the player's keyboard shortcuts must stay quiet. */
export const isModalOpen = (
  state: Pick<SessionState, 'focusLoss' | 'exitDialogOpen' | 'presence' | 'cameraNoticeOpen'>,
): boolean =>
  state.focusLoss !== null ||
  state.exitDialogOpen ||
  state.presence.phase !== 'idle' ||
  state.cameraNoticeOpen;

interface SessionState {
  screen: Screen;
  playlist: string[];
  index: number;
  /** The speed the user selected (hold-to-boost is layered on top of this). */
  speed: number;

  /** The running session; created when the first video plays in this launch. */
  session: Session | null;
  /** Study time already recorded today by earlier sessions, in ms. */
  todayBaseMs: number;
  /** False while the machine sleeps or the screen is locked. */
  systemActive: boolean;
  /** Whether the timer is counting right now (for the clock's indicator). */
  studying: boolean;
  /** Set from the moment the window loses focus until the user dismisses "Come back to study". */
  focusLoss: FocusLoss | null;
  /** The "enter the exit password" dialog is open. */
  exitDialogOpen: boolean;
  /** The "Still studying?" check. */
  presence: PresenceState;
  /** Study time (ms into the session) at which the next check comes up; null until scheduled. */
  presenceDueMs: number | null;
  /**
   * The camera check. Starts as "starting", which does not count: the player sets it to
   * "disabled" when Settings has the check off, so it can never be skipped by accident.
   */
  camera: CameraState;
  /** The one-time "the camera check is on" notice is showing. */
  cameraNoticeOpen: boolean;

  /** Opens a picker; resolves true if a playlist was loaded. */
  openMedia: (kind: OpenDialogKind) => Promise<boolean>;
  playAt: (index: number) => void;
  next: () => void;
  previous: () => void;
  setSpeed: (speed: number) => void;
  stepSpeed: (direction: 1 | -1) => void;
  showLibrary: () => void;
  showSettings: () => void;
  showSummary: () => void;

  /** Starts the session if needed and records that this video played. */
  noteVideoPlayed: (path: string) => void;
  addStudyMs: (ms: number) => void;
  setTodayBase: (ms: number) => void;
  setSystemActive: (active: boolean) => void;
  setStudying: (studying: boolean) => void;

  /** The window lost focus: count it, log it, and start waiting for an acknowledgement. */
  focusLost: (at: number) => void;
  focusReturned: (at: number) => void;
  dismissFocusLoss: () => void;

  openExitDialog: () => void;
  closeExitDialog: () => void;
  setPresence: (presence: PresenceState) => void;
  setPresenceDue: (dueMs: number) => void;
  /** The check went unanswered: mark it missed, count it and log it. */
  presenceMissed: (at: number) => void;
  /** A wrong password was entered: log it on the running session; `detail` says where. */
  logAuthFailure: (at: number, detail?: string) => void;
  /** The exit password was reset with the recovery key: log it so the owner can see. */
  logPasswordReset: (at: number) => void;
  /** Replaces the camera state outright (switching the check off, or back to "starting"). */
  setCamera: (camera: CameraState) => void;
  setCameraNoticeOpen: (open: boolean) => void;
  /**
   * Feeds the camera check one look (or failure). `now` is performance.now(), `at` the epoch time
   * for the log. Going away, coming back and a broken camera are written to the session's events.
   */
  applyCamera: (event: CameraEvent, config: CameraConfig, now: number, at: number) => void;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  screen: 'library',
  playlist: [],
  index: 0,
  speed: 1,

  session: null,
  todayBaseMs: 0,
  systemActive: true,
  studying: false,
  focusLoss: null,
  exitDialogOpen: false,
  presence: IDLE_PRESENCE,
  presenceDueMs: null,
  camera: STARTING_CAMERA,
  cameraNoticeOpen: false,

  openMedia: async (kind) => {
    const paths = await window.api.openMedia(kind);
    if (paths.length === 0) return false;
    // A single file starts right away; a folder lands on the playlist to pick from.
    set({ playlist: paths, index: 0, screen: paths.length === 1 ? 'player' : 'library' });
    return true;
  },

  playAt: (index) => {
    if (index < 0 || index >= get().playlist.length) return;
    set({ index, screen: 'player' });
  },

  next: () => {
    const { index, playlist } = get();
    if (index + 1 < playlist.length) set({ index: index + 1 });
  },

  previous: () => {
    const { index } = get();
    if (index > 0) set({ index: index - 1 });
  },

  setSpeed: (speed) => set({ speed: clampSpeed(speed) }),

  stepSpeed: (direction) => set({ speed: nextSpeed(get().speed, direction) }),

  showLibrary: () => set({ screen: 'library' }),

  showSettings: () => set({ screen: 'settings' }),

  showSummary: () => set({ screen: 'summary' }),

  noteVideoPlayed: (path) =>
    set(({ session }) => {
      const current = session ?? newSession();
      if (current.videosWatched.includes(path)) return session ? {} : { session: current };
      return { session: { ...current, videosWatched: [...current.videosWatched, path] } };
    }),

  addStudyMs: (ms) =>
    set(({ session }) => {
      const current = session ?? newSession();
      return { session: { ...current, studyMs: current.studyMs + ms } };
    }),

  setTodayBase: (ms) => set({ todayBaseMs: ms }),

  setSystemActive: (active) => set({ systemActive: active }),

  setStudying: (studying) => {
    if (get().studying !== studying) set({ studying });
  },

  focusLost: (at) =>
    set(({ session, focusLoss }) => {
      // Repeated blur events within one absence are one loss. Leaving again after coming back
      // (even before dismissing the overlay) is a new one.
      if (focusLoss && focusLoss.returnedAt === null) return {};
      return {
        focusLoss: { lostAt: at, returnedAt: null },
        session: recordFocusLost(session ?? newSession(), at),
      };
    }),

  focusReturned: (at) =>
    set(({ session, focusLoss }) => {
      if (!focusLoss || focusLoss.returnedAt !== null) return {};
      const returned: FocusLoss = { ...focusLoss, returnedAt: at };
      return {
        focusLoss: returned,
        session: session ? recordFocusReturned(session, returned) : session,
      };
    }),

  dismissFocusLoss: () => set({ focusLoss: null }),

  openExitDialog: () => set({ exitDialogOpen: true }),
  closeExitDialog: () => set({ exitDialogOpen: false }),

  setPresence: (presence) => set({ presence }),

  setPresenceDue: (dueMs) => set({ presenceDueMs: dueMs }),

  presenceMissed: (at) =>
    set(({ session, presence }) => {
      if (presence.phase !== 'pending') return {};
      return {
        presence: { phase: 'missed', shownAt: presence.shownAt },
        session: recordPresenceMissed(session ?? newSession(), at),
      };
    }),

  logAuthFailure: (at, detail) =>
    set(({ session }) => ({ session: recordAuthFailed(session ?? newSession(), at, detail) })),

  logPasswordReset: (at) =>
    set(({ session }) => ({ session: recordPasswordReset(session ?? newSession(), at) })),

  setCamera: (camera) => set({ camera }),

  setCameraNoticeOpen: (open) => set({ cameraNoticeOpen: open }),

  applyCamera: (event, config, now, at) =>
    set(({ camera, session }) => {
      const next = reduceCamera(camera, event, now, config);
      if (next === camera) return {};
      const change = cameraChange(camera, next, now);
      if (!change) return { camera: next };
      const current = session ?? newSession();
      const logged =
        change.kind === 'away'
          ? recordPersonAway(current, at, change.absentMs)
          : change.kind === 'returned'
            ? recordPersonReturned(current, at, change.awayMs)
            : recordCameraUnavailable(current, at, change.reason);
      return { camera: next, session: logged };
    }),
}));
