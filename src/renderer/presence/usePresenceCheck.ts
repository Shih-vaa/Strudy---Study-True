import { useCallback, useEffect, useRef, useState } from 'react';
import type { PresenceConfig } from '../../shared/types';
import { play } from '../player/actions';
import { useSessionStore } from '../state/useSessionStore';
import {
  advancePresence,
  clampDueMs,
  IDLE_PRESENCE,
  isCheckDue,
  nextDueMs,
  secondsToAnswer,
  startCheck,
} from './presenceCheck';

const TICK_MS = 250;

export interface PresenceUi {
  phase: 'idle' | 'pending' | 'missed';
  /** Seconds left to answer while pending; null otherwise. */
  secondsLeft: number | null;
  /** The click: dismisses the check, schedules the next one, and resumes a video we paused. */
  answer: () => void;
}

/**
 * Runs "Still studying?" for the player screen. The next check comes after a random amount of
 * *study* time; it shows a modal (the video keeps playing, the study clock stops), and if there
 * is no click within the response window the video is paused and a presence_missed event is
 * logged. Call from the player screen only.
 */
export function usePresenceCheck(video: HTMLVideoElement | null): PresenceUi {
  const phase = useSessionStore((s) => s.presence.phase);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const config = useRef<PresenceConfig | null>(null);
  const resumeOnAnswer = useRef(false);

  // The timings come from main (Settings, or the development fast mode).
  useEffect(() => {
    let cancelled = false;
    void window.api.getPresenceConfig().then((loaded) => {
      if (cancelled) return;
      config.current = loaded;
      const { session, presenceDueMs, setPresenceDue } = useSessionStore.getState();
      const studyMs = session?.studyMs ?? 0;
      setPresenceDue(
        presenceDueMs === null
          ? nextDueMs(studyMs, loaded, Math.random)
          : clampDueMs(presenceDueMs, studyMs, loaded.maxMs), // a shorter range applies at once
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const store = useSessionStore.getState;

    const tick = () => {
      const loaded = config.current;
      if (!loaded) return;
      const s = store();

      // Away from the window: the check is moot (leaving is logged as a focus loss already), and
      // the next one is scheduled afresh so it does not nag the moment she is back.
      if (s.focusLoss) {
        if (s.presence.phase !== 'idle') {
          s.setPresence(IDLE_PRESENCE);
          s.setPresenceDue(nextDueMs(s.session?.studyMs ?? 0, loaded, Math.random));
        }
        setSecondsLeft(null);
        return;
      }

      const now = performance.now();
      if (s.presence.phase === 'idle') {
        // Only while actually studying, so a check never appears over a paused video.
        if (s.studying && isCheckDue(s.session?.studyMs ?? 0, s.presenceDueMs)) {
          const started = startCheck(s.presence, now);
          s.setPresence(started);
          setSecondsLeft(secondsToAnswer(started, now, loaded.responseMs)); // show the countdown at once
        }
        return;
      }

      const { missed } = advancePresence(s.presence, now, loaded.responseMs);
      if (missed) {
        resumeOnAnswer.current = video !== null && !video.paused && !video.ended;
        video?.pause();
        s.presenceMissed(Date.now());
      }
      setSecondsLeft(secondsToAnswer(store().presence, now, loaded.responseMs));
    };

    const interval = window.setInterval(tick, TICK_MS);
    return () => {
      window.clearInterval(interval);
      // Leaving the player: no check stays up. Its due time is kept for when she is back.
      const s = store();
      if (s.presence.phase !== 'idle') s.setPresence(IDLE_PRESENCE);
    };
  }, [video]);

  const answer = useCallback(() => {
    const s = useSessionStore.getState();
    s.setPresence(IDLE_PRESENCE);
    setSecondsLeft(null);
    if (config.current) s.setPresenceDue(nextDueMs(s.session?.studyMs ?? 0, config.current, Math.random));
    if (video && resumeOnAnswer.current) play(video);
    resumeOnAnswer.current = false;
  }, [video]);

  return { phase, secondsLeft, answer };
}
