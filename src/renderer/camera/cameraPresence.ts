// Pure logic of the camera presence check. No camera, no DOM, no clock of its own: the caller
// feeds in what the face detector saw and a monotonic time (performance.now), and gets back the
// new state. Nothing about a frame is kept beyond "a face was / was not seen".
//
// The rules:
//  - The study clock counts only while `isCameraOk` says so.
//  - A face counts as "someone is here". Looking away for a moment (taking notes, a glare, a
//    turned head) is not penalized: nobody has to be seen for the whole of the grace period
//    before the state becomes `away`.
//  - One frame with a face is not enough to be sure: it takes `faceFrames` in a row (two) to count
//    someone as present, to come back from `away`, or to clear a run of empty frames. A lone false
//    detection (a poster, a shadow, a clock face) therefore changes nothing and cannot keep the
//    grace period topped up for ever.
//  - Fails closed: while the camera is starting, broken, or has stopped delivering frames, the
//    clock does not count.

export type CameraPhase =
  /** The camera check is switched off in Settings: it never blocks the clock. */
  | 'disabled'
  /** Camera is being opened, or has not yet shown a face. */
  | 'starting'
  /** Someone is in front of the camera (possibly just glancing away within the grace period). */
  | 'present'
  /** No one was seen for the whole grace period: the clock is stopped. */
  | 'away'
  /** The camera check is on but the camera cannot be used. */
  | 'unavailable';

export interface CameraState {
  phase: CameraPhase;
  /** performance.now() when the current run of frames without a face began; null while a face is in view. */
  noFaceSince: number | null;
  /** Frames with a face in a row. */
  faceStreak: number;
  /** performance.now() of the latest frame looked at, with a face or without. */
  lastSampleAt: number | null;
  /** performance.now() when the absence that led to `away` began. */
  awaySince: number | null;
  /** Why the camera is unavailable. */
  reason: string | null;
}

export interface CameraConfig {
  /** How long no one may be seen before the state becomes `away`, in milliseconds. */
  graceMs: number;
  /** Frames with a face in a row needed to count someone as there. */
  faceFrames: number;
}

/** Frames older than this no longer prove anyone is there (the detector stalled or was throttled). */
export const CAMERA_STALE_MS = 5000;

/** Two frames in a row: about two seconds at the default one look per second. */
export const CAMERA_FACE_FRAMES = 2;

export const DISABLED_CAMERA: CameraState = {
  phase: 'disabled',
  noFaceSince: null,
  faceStreak: 0,
  lastSampleAt: null,
  awaySince: null,
  reason: null,
};

/** The state before anything has been seen. It is also the safe default: the clock does not count. */
export const STARTING_CAMERA: CameraState = { ...DISABLED_CAMERA, phase: 'starting' };

export type CameraEvent =
  /** One look at the camera: was there a face? */
  | { kind: 'sample'; faceSeen: boolean }
  /** The camera could not be opened, was taken away, or the detector failed. */
  | { kind: 'failed'; reason: string };

export function reduceCamera(
  state: CameraState,
  event: CameraEvent,
  now: number,
  config: CameraConfig,
): CameraState {
  if (state.phase === 'disabled') return state;

  if (event.kind === 'failed') {
    return {
      ...state,
      phase: 'unavailable',
      reason: event.reason,
      noFaceSince: null,
      faceStreak: 0,
      awaySince: null,
    };
  }

  const looked = { ...state, lastSampleAt: now };

  if (event.faceSeen) {
    const faceStreak = state.faceStreak + 1;
    // Not sure yet: note the frame, change nothing else (an `away` stays away, a run of empty
    // frames keeps running).
    if (faceStreak < config.faceFrames) return { ...looked, faceStreak };
    return { ...looked, phase: 'present', faceStreak, noFaceSince: null, awaySince: null, reason: null };
  }

  // Nobody seen. A camera that just came back from a failure starts a fresh run of no-face frames.
  if (state.phase === 'unavailable') {
    return { ...looked, phase: 'starting', faceStreak: 0, noFaceSince: now, awaySince: null, reason: null };
  }
  const noFaceSince = state.noFaceSince ?? now;
  const missing = { ...looked, faceStreak: 0, noFaceSince };
  if (state.phase === 'away') return missing;
  if (now - noFaceSince >= config.graceMs) return { ...missing, phase: 'away', awaySince: noFaceSince };
  return missing;
}

/** Condition 6 of the study timer: someone is in front of the camera (or the check is off). */
export function isCameraOk(state: CameraState, now: number): boolean {
  if (state.phase === 'disabled') return true;
  if (state.phase !== 'present') return false;
  return state.lastSampleAt !== null && now - state.lastSampleAt <= CAMERA_STALE_MS;
}

/** What changed between two states that is worth writing to the session log. */
export type CameraChange =
  | { kind: 'away'; absentMs: number }
  | { kind: 'returned'; awayMs: number }
  | { kind: 'unavailable'; reason: string };

export function cameraChange(prev: CameraState, next: CameraState, now: number): CameraChange | null {
  if (prev.phase !== 'away' && next.phase === 'away') {
    return { kind: 'away', absentMs: Math.max(0, now - (next.awaySince ?? now)) };
  }
  if (prev.phase === 'away' && next.phase === 'present') {
    return { kind: 'returned', awayMs: Math.max(0, now - (prev.awaySince ?? now)) };
  }
  // Logged when the camera first fails, not on every retry that fails again.
  if (prev.phase !== 'unavailable' && next.phase === 'unavailable') {
    return { kind: 'unavailable', reason: next.reason ?? 'The camera could not be used.' };
  }
  return null;
}

/**
 * Whole seconds left of the grace period while no face is in view and the state is still `present`
 * (for the "pausing in 30 s" hint); null at any other time.
 */
export function graceSecondsLeft(state: CameraState, now: number, graceMs: number): number | null {
  if (state.phase !== 'present' || state.noFaceSince === null) return null;
  return Math.max(0, Math.ceil((graceMs - (now - state.noFaceSince)) / 1000));
}
