import { describe, expect, it } from 'vitest';
import {
  createStudyTimer,
  intersect,
  isStudying,
  MAX_TICK_DELTA_MS,
  TICK_MS,
  type StudyConditions,
} from './studyTimer';

const ALL_OK: StudyConditions = {
  videoPlaying: true,
  windowFocused: true,
  windowVisible: true,
  presenceOk: true,
  systemActive: true,
  cameraOk: true,
};

const CONDITION_KEYS = Object.keys(ALL_OK) as (keyof StudyConditions)[];

function fakeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('isStudying', () => {
  it('is true when every condition holds', () => {
    expect(isStudying(ALL_OK)).toBe(true);
  });

  it.each(CONDITION_KEYS)('is false when only %s fails', (key) => {
    expect(isStudying({ ...ALL_OK, [key]: false })).toBe(false);
  });
});

describe('intersect', () => {
  it('keeps only what held in both', () => {
    const a = { ...ALL_OK, windowFocused: false };
    const b = { ...ALL_OK, videoPlaying: false };
    expect(intersect(a, b)).toEqual({ ...ALL_OK, windowFocused: false, videoPlaying: false });
  });

  it('is the identity for identical inputs', () => {
    expect(intersect(ALL_OK, ALL_OK)).toEqual(ALL_OK);
  });
});

describe('createStudyTimer', () => {
  it('starts at zero', () => {
    expect(createStudyTimer(fakeClock().now).studyMs).toBe(0);
  });

  it('credits the wall-clock time between ticks while studying', () => {
    const clock = fakeClock();
    const timer = createStudyTimer(clock.now);
    for (let i = 0; i < 3; i++) {
      clock.advance(TICK_MS);
      expect(timer.tick(ALL_OK)).toBe(TICK_MS);
    }
    expect(timer.studyMs).toBe(3 * TICK_MS);
  });

  it('credits the real delta, not a fixed 1000, so interval drift does not matter', () => {
    const clock = fakeClock();
    const timer = createStudyTimer(clock.now);
    clock.advance(1043);
    timer.tick(ALL_OK);
    clock.advance(987);
    timer.tick(ALL_OK);
    expect(timer.studyMs).toBe(1043 + 987);
  });

  it.each(CONDITION_KEYS)('does not advance when %s is false', (key) => {
    const clock = fakeClock();
    const timer = createStudyTimer(clock.now);
    clock.advance(TICK_MS);
    expect(timer.tick({ ...ALL_OK, [key]: false })).toBe(0);
    expect(timer.studyMs).toBe(0);
  });

  it('does not bank time spent not studying', () => {
    const clock = fakeClock();
    const timer = createStudyTimer(clock.now);
    clock.advance(2000);
    timer.tick({ ...ALL_OK, windowFocused: false });
    clock.advance(TICK_MS);
    timer.tick(ALL_OK);
    expect(timer.studyMs).toBe(TICK_MS);
  });

  describe('sleep and throttling', () => {
    it('discards a gap longer than 2500ms and keeps counting normally afterwards', () => {
      const clock = fakeClock();
      const timer = createStudyTimer(clock.now);
      clock.advance(TICK_MS);
      timer.tick(ALL_OK);

      clock.advance(8 * 60 * 60 * 1000); // slept overnight
      expect(timer.tick(ALL_OK)).toBe(0);
      expect(timer.studyMs).toBe(TICK_MS);

      clock.advance(TICK_MS);
      expect(timer.tick(ALL_OK)).toBe(TICK_MS);
      expect(timer.studyMs).toBe(2 * TICK_MS);
    });

    it('credits a gap of exactly 2500ms but not 2501ms', () => {
      const clock = fakeClock();
      const timer = createStudyTimer(clock.now);
      clock.advance(MAX_TICK_DELTA_MS);
      expect(timer.tick(ALL_OK)).toBe(MAX_TICK_DELTA_MS);
      clock.advance(MAX_TICK_DELTA_MS + 1);
      expect(timer.tick(ALL_OK)).toBe(0);
    });
  });

  describe('odd clocks', () => {
    it('credits nothing when no time has passed', () => {
      const timer = createStudyTimer(fakeClock().now);
      expect(timer.tick(ALL_OK)).toBe(0);
    });

    it('ignores a clock that moved backwards and recovers on the next tick', () => {
      const clock = fakeClock(10_000);
      const timer = createStudyTimer(clock.now);
      clock.advance(-500);
      expect(timer.tick(ALL_OK)).toBe(0);
      clock.advance(TICK_MS);
      expect(timer.tick(ALL_OK)).toBe(TICK_MS);
    });
  });

  describe('playback speed', () => {
    it.each([0.5, 1, 2])('credits one real second per second at %sx', (_rate) => {
      // The timer has no notion of playback rate: only elapsed time and conditions.
      const clock = fakeClock();
      const timer = createStudyTimer(clock.now);
      for (let i = 0; i < 10; i++) {
        clock.advance(TICK_MS);
        timer.tick(ALL_OK);
      }
      expect(timer.studyMs).toBe(10 * TICK_MS);
    });
  });

  describe('flushing on a condition change (how the app attributes time exactly)', () => {
    it('credits up to a pause with the old conditions, then nothing', () => {
      const clock = fakeClock();
      const timer = createStudyTimer(clock.now);
      clock.advance(600); // pause happens 600ms into the interval
      timer.tick(ALL_OK); // flush with the conditions that held until now
      clock.advance(400);
      timer.tick({ ...ALL_OK, videoPlaying: false });
      expect(timer.studyMs).toBe(600);
    });

    it('does not credit the idle part of an interval when playback resumes late', () => {
      const clock = fakeClock();
      const timer = createStudyTimer(clock.now);
      clock.advance(900); // paused for 900ms of this interval
      timer.tick({ ...ALL_OK, videoPlaying: false });
      clock.advance(100);
      timer.tick(ALL_OK);
      expect(timer.studyMs).toBe(100);
    });
  });

  describe('the camera check', () => {
    it('stops the clock when no one is in front of the camera and restarts it when they are back', () => {
      const clock = fakeClock();
      const timer = createStudyTimer(clock.now);
      clock.advance(TICK_MS);
      timer.tick(ALL_OK);
      for (let i = 0; i < 5; i++) {
        clock.advance(TICK_MS);
        expect(timer.tick({ ...ALL_OK, cameraOk: false })).toBe(0);
      }
      clock.advance(TICK_MS);
      timer.tick(ALL_OK);
      expect(timer.studyMs).toBe(2 * TICK_MS);
    });

    it('credits the part of a second before someone left, not the part after', () => {
      const clock = fakeClock();
      const timer = createStudyTimer(clock.now);
      clock.advance(700);
      timer.tick(ALL_OK); // flush under the conditions that held until the camera lost them
      clock.advance(300);
      timer.tick({ ...ALL_OK, cameraOk: false });
      expect(timer.studyMs).toBe(700);
    });

    it('intersect keeps "camera not ok" if it failed on either side', () => {
      expect(intersect({ ...ALL_OK, cameraOk: false }, ALL_OK).cameraOk).toBe(false);
      expect(intersect(ALL_OK, { ...ALL_OK, cameraOk: false }).cameraOk).toBe(false);
    });
  });
});
