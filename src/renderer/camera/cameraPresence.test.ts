import { describe, expect, it } from 'vitest';
import {
  CAMERA_STALE_MS,
  cameraChange,
  DISABLED_CAMERA,
  graceSecondsLeft,
  isCameraOk,
  reduceCamera,
  STARTING_CAMERA,
  type CameraConfig,
  type CameraEvent,
  type CameraState,
} from './cameraPresence';

const config: CameraConfig = { graceMs: 45_000, faceFrames: 2 };
const face: CameraEvent = { kind: 'sample', faceSeen: true };
const empty: CameraEvent = { kind: 'sample', faceSeen: false };

/** Feeds one look per second, starting at `from`, and returns the final state. */
function run(start: CameraState, events: CameraEvent[], from = 0, stepMs = 1000): CameraState {
  let state = start;
  events.forEach((event, i) => {
    state = reduceCamera(state, event, from + i * stepMs, config);
  });
  return state;
}

const repeat = (event: CameraEvent, times: number): CameraEvent[] => Array.from({ length: times }, () => event);

/** Someone settled in front of the camera: two frames with a face, at 0 s and 1 s. */
const PRESENT = run(STARTING_CAMERA, repeat(face, 2));

describe('a person in front of the camera', () => {
  it('starts out not counting, and counts once a face has been seen twice in a row', () => {
    expect(isCameraOk(STARTING_CAMERA, 0)).toBe(false);
    const once = reduceCamera(STARTING_CAMERA, face, 0, config);
    expect(once.phase).toBe('starting');
    expect(isCameraOk(once, 0)).toBe(false);
    const twice = reduceCamera(once, face, 1000, config);
    expect(twice.phase).toBe('present');
    expect(isCameraOk(twice, 1000)).toBe(true);
  });

  it('stays present while faces keep being seen', () => {
    const state = run(STARTING_CAMERA, repeat(face, 600));
    expect(state.phase).toBe('present');
    expect(isCameraOk(state, 599_000)).toBe(true);
  });
});

describe('a lone detection is not enough', () => {
  it('does not start the clock when one frame with a face is followed by nothing', () => {
    const state = run(STARTING_CAMERA, [face, empty, empty]);
    expect(state.phase).toBe('starting');
    expect(isCameraOk(state, 2000)).toBe(false);
  });

  it('does not reset the grace period: a stray hit in an empty room changes nothing', () => {
    let state = run(PRESENT, repeat(empty, 20), 2000); // no face since 2 s
    state = reduceCamera(state, face, 22_000, config); // one false detection
    expect(state.noFaceSince).toBe(2000);
    state = reduceCamera(state, empty, 23_000, config);
    expect(state.noFaceSince).toBe(2000);
    // so the grace period still runs out on time: 47 s after the last real face
    expect(reduceCamera(state, empty, 46_999, config).phase).toBe('present');
    expect(reduceCamera(state, empty, 47_000, config).phase).toBe('away');
  });

  it('cannot keep the grace period alive for ever: a stray hit every ten seconds still ends in away', () => {
    const cycle = [face, ...repeat(empty, 9)];
    const state = run(PRESENT, [...cycle, ...cycle, ...cycle, ...cycle, ...cycle], 2000);
    expect(state.phase).toBe('away');
  });

  it('does not bring someone back from away', () => {
    const away = run(PRESENT, repeat(empty, 60), 2000);
    expect(away.phase).toBe('away');
    expect(reduceCamera(away, face, 70_000, config).phase).toBe('away');
  });
});

describe('looking away within the grace period', () => {
  it('is not penalized: the clock keeps counting while no face is seen for less than the grace period', () => {
    let state = run(STARTING_CAMERA, repeat(face, 5));
    state = run(state, repeat(empty, 44), 5000); // frames at 5 s .. 48 s: 43 s without a face
    expect(state.phase).toBe('present');
    expect(isCameraOk(state, 48_000)).toBe(true);
  });

  it('forgets the glance as soon as a face is seen twice in a row, and the grace period starts over', () => {
    let state = run(PRESENT, repeat(empty, 40), 2000); // 40 s without a face
    state = reduceCamera(state, face, 42_000, config);
    state = reduceCamera(state, face, 43_000, config);
    expect(state.noFaceSince).toBeNull();
    // another 40 s without a face is again within the grace period
    state = run(state, repeat(empty, 40), 44_000);
    expect(state.phase).toBe('present');
  });

  it('reports the seconds left of the grace period for the on-screen hint', () => {
    expect(graceSecondsLeft(PRESENT, 1000, config.graceMs)).toBeNull();
    const state = run(PRESENT, repeat(empty, 11), 2000); // no face since 2 s
    expect(graceSecondsLeft(state, 12_000, config.graceMs)).toBe(35);
    expect(graceSecondsLeft(state, 47_000, config.graceMs)).toBe(0);
  });
});

describe('no one seen for the whole grace period', () => {
  it('becomes away exactly when the grace period is used up', () => {
    const state = reduceCamera(PRESENT, empty, 10_000, config); // no face since 10 s
    expect(reduceCamera(state, empty, 54_999, config).phase).toBe('present');
    const away = reduceCamera(state, empty, 55_000, config);
    expect(away.phase).toBe('away');
    expect(away.awaySince).toBe(10_000);
    expect(isCameraOk(away, 55_000)).toBe(false);
  });

  it('stays away while no one is seen', () => {
    const state = run(PRESENT, repeat(empty, 100), 2000);
    expect(state.phase).toBe('away');
    expect(state.awaySince).toBe(2000);
  });

  it('also applies at the start: nobody ever showing up is away too', () => {
    const state = run(STARTING_CAMERA, repeat(empty, 50));
    expect(state.phase).toBe('away');
  });

  it('honours a different grace period', () => {
    const short: CameraConfig = { graceMs: 10_000, faceFrames: 2 };
    let state = reduceCamera(STARTING_CAMERA, face, 0, short);
    state = reduceCamera(state, face, 500, short);
    state = reduceCamera(state, empty, 1000, short);
    expect(reduceCamera(state, empty, 10_999, short).phase).toBe('present');
    expect(reduceCamera(state, empty, 11_000, short).phase).toBe('away');
  });
});

describe('coming back', () => {
  const away = run(PRESENT, repeat(empty, 60), 2000);

  it('needs more than one frame with a face, so a single false detection changes nothing', () => {
    const blip = reduceCamera(away, face, 70_000, config);
    expect(blip.phase).toBe('away');
    expect(isCameraOk(blip, 70_000)).toBe(false);
    // and the blip does not wipe out how long they were gone
    expect(blip.awaySince).toBe(2000);
    expect(reduceCamera(blip, empty, 71_000, config).faceStreak).toBe(0);
  });

  it('comes back after two frames in a row with a face', () => {
    let state = reduceCamera(away, face, 70_000, config);
    state = reduceCamera(state, face, 71_000, config);
    expect(state.phase).toBe('present');
    expect(isCameraOk(state, 71_000)).toBe(true);
    expect(state.awaySince).toBeNull();
  });

  it('does not count two frames with an empty frame in between', () => {
    let state = reduceCamera(away, face, 70_000, config);
    state = reduceCamera(state, empty, 71_000, config);
    state = reduceCamera(state, face, 72_000, config);
    expect(state.phase).toBe('away');
  });
});

describe('a camera that cannot be used', () => {
  it('stops the clock (fails closed) and keeps the reason', () => {
    const state = reduceCamera(PRESENT, { kind: 'failed', reason: 'Camera access was denied' }, 5000, config);
    expect(state.phase).toBe('unavailable');
    expect(state.reason).toBe('Camera access was denied');
    expect(isCameraOk(state, 5000)).toBe(false);
  });

  it('is unavailable from the start when the camera never opens', () => {
    const state = reduceCamera(STARTING_CAMERA, { kind: 'failed', reason: 'No camera was found' }, 0, config);
    expect(state.phase).toBe('unavailable');
  });

  it('recovers when frames arrive again: with a face seen twice it counts', () => {
    let state = reduceCamera(STARTING_CAMERA, { kind: 'failed', reason: 'busy' }, 0, config);
    state = reduceCamera(state, face, 10_000, config);
    expect(state.phase).toBe('unavailable'); // one frame is not enough
    state = reduceCamera(state, face, 11_000, config);
    expect(state.phase).toBe('present');
    expect(state.reason).toBeNull();
  });

  it('recovers into "starting" when the camera works but no one is there, then goes away after the grace period', () => {
    let state = reduceCamera(STARTING_CAMERA, { kind: 'failed', reason: 'busy' }, 0, config);
    state = reduceCamera(state, empty, 10_000, config);
    expect(state.phase).toBe('starting');
    expect(state.noFaceSince).toBe(10_000);
    state = reduceCamera(state, empty, 55_000, config);
    expect(state.phase).toBe('away');
  });

  it('a failure while away forgets the absence (it is the camera, not the person, that is reported)', () => {
    const away = run(PRESENT, repeat(empty, 60), 2000);
    const failed = reduceCamera(away, { kind: 'failed', reason: 'gone' }, 70_000, config);
    expect(failed.phase).toBe('unavailable');
    expect(failed.awaySince).toBeNull();
  });
});

describe('frames that stop arriving', () => {
  it('stop counting once the last frame is too old, even if it showed a face', () => {
    // last frame at 1000
    expect(isCameraOk(PRESENT, 1000 + CAMERA_STALE_MS)).toBe(true);
    expect(isCameraOk(PRESENT, 1000 + CAMERA_STALE_MS + 1)).toBe(false);
  });

  it('count again as soon as a fresh frame with a face arrives', () => {
    const fresh = reduceCamera(PRESENT, face, 60_000, config);
    expect(isCameraOk(fresh, 60_000)).toBe(true);
  });

  it('never count in a state that has had no frames at all', () => {
    expect(isCameraOk({ ...STARTING_CAMERA, phase: 'present' }, 0)).toBe(false);
  });
});

describe('the check switched off', () => {
  it('never blocks the clock and ignores whatever arrives', () => {
    expect(isCameraOk(DISABLED_CAMERA, 0)).toBe(true);
    expect(reduceCamera(DISABLED_CAMERA, empty, 99_000, config)).toBe(DISABLED_CAMERA);
    expect(reduceCamera(DISABLED_CAMERA, { kind: 'failed', reason: 'x' }, 1, config)).toBe(DISABLED_CAMERA);
  });
});

describe('cameraChange (what gets logged)', () => {
  it('reports going away once, with how long no one was seen', () => {
    const before = run(PRESENT, repeat(empty, 44), 2000); // no face since 2 s, still present
    const after = reduceCamera(before, empty, 47_000, config);
    expect(cameraChange(before, after, 47_000)).toEqual({ kind: 'away', absentMs: 45_000 });
    // staying away is not a new change
    const later = reduceCamera(after, empty, 48_000, config);
    expect(cameraChange(after, later, 48_000)).toBeNull();
  });

  it('reports the return with the whole time away', () => {
    const away = run(PRESENT, repeat(empty, 60), 2000);
    const half = reduceCamera(away, face, 100_000, config);
    expect(cameraChange(away, half, 100_000)).toBeNull();
    const back = reduceCamera(half, face, 101_000, config);
    expect(cameraChange(half, back, 101_000)).toEqual({ kind: 'returned', awayMs: 99_000 });
  });

  it('reports a camera failure once, not on every failed retry', () => {
    const failed = reduceCamera(PRESENT, { kind: 'failed', reason: 'busy' }, 5000, config);
    expect(cameraChange(PRESENT, failed, 5000)).toEqual({ kind: 'unavailable', reason: 'busy' });
    const again = reduceCamera(failed, { kind: 'failed', reason: 'busy' }, 15_000, config);
    expect(cameraChange(failed, again, 15_000)).toBeNull();
  });

  it('reports nothing for ordinary frames, the first face, or a recovery', () => {
    expect(cameraChange(STARTING_CAMERA, PRESENT, 0)).toBeNull();
    expect(cameraChange(PRESENT, reduceCamera(PRESENT, face, 2000, config), 2000)).toBeNull();
    const failed = reduceCamera(PRESENT, { kind: 'failed', reason: 'busy' }, 5000, config);
    const recovered = run(failed, repeat(face, 2), 6000);
    expect(recovered.phase).toBe('present');
    expect(cameraChange(failed, recovered, 7000)).toBeNull();
  });
});

describe('the state is never mutated', () => {
  it('returns new objects and leaves the input alone', () => {
    const before = Object.freeze({ ...STARTING_CAMERA });
    const after = reduceCamera(before, face, 1, config);
    expect(after).not.toBe(before);
    expect(before.phase).toBe('starting');
  });
});
