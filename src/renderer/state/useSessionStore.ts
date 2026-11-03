import { create } from 'zustand';
import { createSession } from '../../shared/session';
import type { OpenDialogKind, Session } from '../../shared/types';
import { recordFocusLost, recordFocusReturned, type FocusLoss } from '../focus/focusLoss';
import { clampSpeed, nextSpeed } from '../player/speed';

type Screen = 'library' | 'player';

const newSession = (): Session => createSession(crypto.randomUUID(), Date.now());

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

  /** Opens a picker; resolves true if a playlist was loaded. */
  openMedia: (kind: OpenDialogKind) => Promise<boolean>;
  playAt: (index: number) => void;
  next: () => void;
  previous: () => void;
  setSpeed: (speed: number) => void;
  stepSpeed: (direction: 1 | -1) => void;
  showLibrary: () => void;

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
}));
