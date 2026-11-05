// Pure study-timer logic. No DOM, no Electron, no real clock: time and conditions are
// injected so the rules can be unit-tested. See CLAUDE.md section 4.2.

/** How often the caller should tick. */
export const TICK_MS = 1000;

/**
 * A gap longer than this between two ticks means the machine slept or the renderer was
 * throttled; that time is discarded rather than credited.
 */
export const MAX_TICK_DELTA_MS = 2500;

/** A second counts as study time only when every one of these holds. */
export interface StudyConditions {
  /** A video is loaded and actually playing: !paused && !ended && readyState >= 3. */
  videoPlaying: boolean;
  windowFocused: boolean;
  /** Not minimized or hidden. */
  windowVisible: boolean;
  /** No presence check is pending or failed. */
  presenceOk: boolean;
  /** The system is not suspended or locked. */
  systemActive: boolean;
  /** The camera check, when switched on, sees someone in front of the camera (always true when it is off). */
  cameraOk: boolean;
}

export function isStudying(conditions: StudyConditions): boolean {
  return (
    conditions.videoPlaying &&
    conditions.windowFocused &&
    conditions.windowVisible &&
    conditions.presenceOk &&
    conditions.systemActive &&
    conditions.cameraOk
  );
}

/** Conditions that held in both `a` and `b` (used when something may have changed in between). */
export function intersect(a: StudyConditions, b: StudyConditions): StudyConditions {
  return {
    videoPlaying: a.videoPlaying && b.videoPlaying,
    windowFocused: a.windowFocused && b.windowFocused,
    windowVisible: a.windowVisible && b.windowVisible,
    presenceOk: a.presenceOk && b.presenceOk,
    systemActive: a.systemActive && b.systemActive,
    cameraOk: a.cameraOk && b.cameraOk,
  };
}

export interface StudyTimer {
  /**
   * Credits the wall-clock time since the previous tick if `conditions` all hold, and
   * returns the milliseconds credited. Never looks at playback speed: it only knows time.
   */
  tick: (conditions: StudyConditions) => number;
  /** Total milliseconds credited by this timer so far. */
  readonly studyMs: number;
}

/** `now` must be monotonic (performance.now), so wall-clock adjustments cannot skew it. */
export function createStudyTimer(now: () => number): StudyTimer {
  let lastTick = now();
  let studyMs = 0;

  return {
    tick(conditions) {
      const current = now();
      const delta = current - lastTick;
      lastTick = current;

      if (delta <= 0 || delta > MAX_TICK_DELTA_MS) return 0;
      if (!isStudying(conditions)) return 0;

      studyMs += delta;
      return delta;
    },
    get studyMs() {
      return studyMs;
    },
  };
}
