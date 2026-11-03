import { create } from 'zustand';
import type { OpenDialogKind } from '../../shared/types';
import { clampSpeed, nextSpeed } from '../player/speed';

type Screen = 'library' | 'player';

interface SessionState {
  screen: Screen;
  playlist: string[];
  index: number;
  /** The speed the user selected (hold-to-boost will be layered on top of this). */
  speed: number;

  /** Opens a picker; resolves true if a playlist was loaded. */
  openMedia: (kind: OpenDialogKind) => Promise<boolean>;
  playAt: (index: number) => void;
  next: () => void;
  previous: () => void;
  setSpeed: (speed: number) => void;
  stepSpeed: (direction: 1 | -1) => void;
  showLibrary: () => void;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  screen: 'library',
  playlist: [],
  index: 0,
  speed: 1,

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
}));
