import { useEffect } from 'react';
import type { Session } from '../../shared/types';
import { useSessionStore } from '../state/useSessionStore';
import { todayStudyMs } from './clock';

const AUTOSAVE_MS = 10_000;

/**
 * Loads today's earlier study time once, and keeps the running session saved: every few
 * seconds, when leaving the player, and when the page goes away. A session that is never
 * closed (hard power-off) therefore keeps everything up to the last save.
 */
export function useSessionPersistence(): void {
  useEffect(() => {
    let cancelled = false;
    void window.api.listSessions().then((sessions) => {
      if (cancelled) return;
      const { session, setTodayBase } = useSessionStore.getState();
      setTodayBase(todayStudyMs(sessions, Date.now(), session?.id));
    });

    let lastSaved: Session | null = null;
    const save = () => {
      const { session } = useSessionStore.getState();
      if (!session || session === lastSaved) return;
      lastSaved = session;
      void window.api.saveSession(session);
    };

    const interval = window.setInterval(save, AUTOSAVE_MS);
    window.addEventListener('pagehide', save);
    const unsubscribe = useSessionStore.subscribe((state, prev) => {
      // Events (like a focus loss) are saved right away, not at the next autosave.
      if (state.screen !== prev.screen || state.session?.events !== prev.session?.events) save();
    });

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('pagehide', save);
      unsubscribe();
      save();
    };
  }, []);
}
