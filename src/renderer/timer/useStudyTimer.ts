import { useEffect } from 'react';
import { isPresenceOk } from '../presence/presenceCheck';
import { registerExitFlush } from '../state/exitFlush';
import { useSessionStore } from '../state/useSessionStore';
import { createStudyTimer, intersect, isStudying, TICK_MS, type StudyConditions } from './studyTimer';

// Anything that can change whether the video counts as "actually playing".
const VIDEO_EVENTS = [
  'play',
  'playing',
  'pause',
  'ended',
  'waiting',
  'stalled',
  'canplay',
  'seeking',
  'seeked',
  'emptied',
  'error',
] as const;

export function isVideoPlaying(video: HTMLVideoElement): boolean {
  return !video.paused && !video.ended && video.readyState >= 3;
}

function readConditions(video: HTMLVideoElement): StudyConditions {
  return {
    videoPlaying: isVideoPlaying(video),
    windowFocused: document.hasFocus(),
    windowVisible: document.visibilityState === 'visible',
    presenceOk: isPresenceOk(useSessionStore.getState().presence),
    systemActive: useSessionStore.getState().systemActive,
  };
}

/**
 * Feeds the study timer for one <video>: ticks every second on monotonic deltas, and also
 * banks time at every change (pause, blur, minimize, sleep...) under the conditions that
 * held until then, so a transition is never attributed to the wrong side.
 *
 * `video` and `path` must belong together (call this from a component keyed by path).
 */
export function useStudyTimer(video: HTMLVideoElement | null, path: string): void {
  useEffect(() => {
    if (!video) return;

    const store = useSessionStore.getState;
    const timer = createStudyTimer(() => performance.now());
    let previous = readConditions(video);
    store().setStudying(isStudying(previous));

    const credit = (conditions: StudyConditions) => {
      const credited = timer.tick(conditions);
      if (credited > 0) store().addStudyMs(credited);
    };

    // Something changed: bank the time up to now, then adopt the new conditions.
    const onChange = () => {
      credit(previous);
      previous = readConditions(video);
      store().setStudying(isStudying(previous));
    };

    // Routine tick: if anything changed unnoticed since the last look, count conservatively.
    const onTick = () => {
      const current = readConditions(video);
      credit(intersect(previous, current));
      previous = current;
      store().setStudying(isStudying(current));
    };

    const onPlaying = () => store().noteVideoPlayed(path);

    if (isVideoPlaying(video)) onPlaying();
    const interval = window.setInterval(onTick, TICK_MS);
    for (const name of VIDEO_EVENTS) video.addEventListener(name, onChange);
    video.addEventListener('playing', onPlaying);
    window.addEventListener('focus', onChange);
    window.addEventListener('blur', onChange);
    document.addEventListener('visibilitychange', onChange);
    const unsubscribe = useSessionStore.subscribe((state, prev) => {
      if (state.systemActive !== prev.systemActive || state.presence.phase !== prev.presence.phase) onChange();
    });
    // Before exiting, bank the part of the current second that has not been ticked yet.
    const unregisterExitFlush = registerExitFlush(onChange);

    return () => {
      unregisterExitFlush();
      window.clearInterval(interval);
      for (const name of VIDEO_EVENTS) video.removeEventListener(name, onChange);
      video.removeEventListener('playing', onPlaying);
      window.removeEventListener('focus', onChange);
      window.removeEventListener('blur', onChange);
      document.removeEventListener('visibilitychange', onChange);
      unsubscribe();
      credit(previous);
      store().setStudying(false);
    };
  }, [video, path]);
}
