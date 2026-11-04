import { describe, expect, it } from 'vitest';
import {
  advancePresence,
  clampDueMs,
  IDLE_PRESENCE,
  isCheckDue,
  isPresenceOk,
  nextDueMs,
  secondsToAnswer,
  startCheck,
  type PresenceState,
} from './presenceCheck';

const config = { minMs: 480_000, maxMs: 900_000 }; // 8 to 15 minutes

describe('nextDueMs', () => {
  it('is a random gap between the ends, counted from the given study time', () => {
    expect(nextDueMs(0, config, () => 0)).toBe(480_000);
    expect(nextDueMs(0, config, () => 1)).toBe(900_000);
    expect(nextDueMs(0, config, () => 0.5)).toBe(690_000);
    expect(nextDueMs(100_000, config, () => 0)).toBe(580_000);
  });

  it('never leaves the range, whatever the random number', () => {
    for (let i = 0; i <= 100; i++) {
      const due = nextDueMs(0, config, () => i / 100);
      expect(due).toBeGreaterThanOrEqual(480_000);
      expect(due).toBeLessThanOrEqual(900_000);
    }
  });

  it('is exact when both ends are equal', () => {
    expect(nextDueMs(5_000, { minMs: 60_000, maxMs: 60_000 }, () => 0.7)).toBe(65_000);
  });
});

describe('clampDueMs', () => {
  it('pulls a check scheduled further out than the new maximum back in', () => {
    expect(clampDueMs(900_000, 100_000, 120_000)).toBe(220_000);
  });

  it('leaves an earlier check alone', () => {
    expect(clampDueMs(150_000, 100_000, 120_000)).toBe(150_000);
  });
});

describe('isCheckDue', () => {
  it('is due once enough has been studied', () => {
    expect(isCheckDue(499_999, 500_000)).toBe(false);
    expect(isCheckDue(500_000, 500_000)).toBe(true);
    expect(isCheckDue(600_000, 500_000)).toBe(true);
  });

  it('is never due when nothing is scheduled yet', () => {
    expect(isCheckDue(10_000_000, null)).toBe(false);
  });
});

describe('startCheck', () => {
  it('starts from idle, remembering when it was shown', () => {
    expect(startCheck(IDLE_PRESENCE, 1234)).toEqual({ phase: 'pending', shownAt: 1234 });
  });

  it('does nothing if a check is already up', () => {
    const pending: PresenceState = { phase: 'pending', shownAt: 10 };
    const missed: PresenceState = { phase: 'missed', shownAt: 10 };
    expect(startCheck(pending, 999)).toBe(pending);
    expect(startCheck(missed, 999)).toBe(missed);
  });
});

describe('advancePresence', () => {
  const pending: PresenceState = { phase: 'pending', shownAt: 1_000 };

  it('keeps waiting just under 30 seconds', () => {
    const result = advancePresence(pending, 30_999, 30_000);
    expect(result.missed).toBe(false);
    expect(result.state).toBe(pending);
  });

  it('becomes a miss at exactly 30 seconds', () => {
    const result = advancePresence(pending, 31_000, 30_000);
    expect(result.missed).toBe(true);
    expect(result.state).toEqual({ phase: 'missed', shownAt: 1_000 });
  });

  it('reports a miss only once', () => {
    const first = advancePresence(pending, 40_000, 30_000);
    const second = advancePresence(first.state, 50_000, 30_000);
    expect(second.missed).toBe(false);
    expect(second.state).toBe(first.state);
  });

  it('ignores idle', () => {
    expect(advancePresence(IDLE_PRESENCE, 1e9, 30_000)).toEqual({ state: IDLE_PRESENCE, missed: false });
  });
});

describe('secondsToAnswer', () => {
  const pending: PresenceState = { phase: 'pending', shownAt: 0 };

  it('counts down in whole seconds, rounding up', () => {
    expect(secondsToAnswer(pending, 0, 30_000)).toBe(30);
    expect(secondsToAnswer(pending, 100, 30_000)).toBe(30);
    expect(secondsToAnswer(pending, 1_000, 30_000)).toBe(29);
    expect(secondsToAnswer(pending, 29_001, 30_000)).toBe(1);
  });

  it('stops at zero', () => {
    expect(secondsToAnswer(pending, 45_000, 30_000)).toBe(0);
  });

  it('is null when nothing is pending', () => {
    expect(secondsToAnswer(IDLE_PRESENCE, 0, 30_000)).toBeNull();
    expect(secondsToAnswer({ phase: 'missed', shownAt: 0 }, 0, 30_000)).toBeNull();
  });
});

describe('isPresenceOk', () => {
  it('is only true while idle, so a pending or missed check stops the study clock', () => {
    expect(isPresenceOk(IDLE_PRESENCE)).toBe(true);
    expect(isPresenceOk({ phase: 'pending', shownAt: 0 })).toBe(false);
    expect(isPresenceOk({ phase: 'missed', shownAt: 0 })).toBe(false);
  });
});
