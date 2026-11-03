import { useCallback, useEffect, useRef } from 'react';
import { play } from '../player/actions';
import { useSessionStore } from '../state/useSessionStore';
import { awaySeconds } from './focusLoss';

export interface FocusLockState {
  /** Show "Come back to study". */
  overlayVisible: boolean;
  /** How long the window was away; null while it still is. */
  awaySeconds: number | null;
  /** Acknowledge the overlay; resumes the video if it was playing when focus was lost. */
  dismiss: () => void;
}

/**
 * When the window loses focus: pause the video, log it, and keep a "Come back to study"
 * overlay up until it is acknowledged. Call from the player screen only, so losing focus
 * on the library does not count.
 */
export function useFocusLock(video: HTMLVideoElement | null): FocusLockState {
  const focusLoss = useSessionStore((s) => s.focusLoss);
  const resumeOnDismiss = useRef(false);

  useEffect(() => {
    const store = useSessionStore.getState;

    const offBlur = window.api.onEvent('window:blur', () => {
      const current = store().focusLoss;
      if (current && current.returnedAt === null) return; // still the same absence
      // Only the first loss since the last acknowledgement knows whether it was playing;
      // after that the video is already paused by us.
      if (!current) resumeOnDismiss.current = video !== null && !video.paused && !video.ended;
      video?.pause();
      store().focusLost(Date.now());
    });
    const offFocus = window.api.onEvent('window:focus', () => store().focusReturned(Date.now()));

    return () => {
      offBlur();
      offFocus();
    };
  }, [video]);

  // Nothing plays behind the overlay, not even the next video autoplaying.
  useEffect(() => {
    if (!video) return;
    const holdIfAway = () => {
      if (!useSessionStore.getState().focusLoss) return;
      resumeOnDismiss.current = true;
      video.pause();
    };
    holdIfAway();
    video.addEventListener('play', holdIfAway);
    return () => video.removeEventListener('play', holdIfAway);
  }, [video]);

  const dismiss = useCallback(() => {
    useSessionStore.getState().dismissFocusLoss();
    if (video && resumeOnDismiss.current) play(video);
    resumeOnDismiss.current = false;
  }, [video]);

  return {
    overlayVisible: focusLoss !== null,
    awaySeconds: focusLoss ? awaySeconds(focusLoss) : null,
    dismiss,
  };
}
