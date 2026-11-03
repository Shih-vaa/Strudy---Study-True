import { describe, expect, it } from 'vitest';
import { createSession } from '../../shared/session';
import { formatClock, startOfLocalDay, todayStudyMs } from './clock';

const at = (h: number, m = 0, day = 3) => new Date(2026, 10, day, h, m).getTime();

describe('formatClock', () => {
  it.each([
    [0, '00:00:00'],
    [999, '00:00:00'],
    [1000, '00:00:01'],
    [61_000, '00:01:01'],
    [3_725_000, '01:02:05'],
    [100 * 3_600_000, '100:00:00'],
  ])('formats %i ms as %s', (ms, expected) => {
    expect(formatClock(ms)).toBe(expected);
  });

  it('reads negative and non-finite input as zero', () => {
    expect(formatClock(-5000)).toBe('00:00:00');
    expect(formatClock(Number.NaN)).toBe('00:00:00');
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe('00:00:00');
  });
});

describe('startOfLocalDay', () => {
  it('returns local midnight', () => {
    expect(startOfLocalDay(at(15, 42))).toBe(at(0));
  });
});

describe('todayStudyMs', () => {
  const session = (id: string, startedAt: number, studyMs: number) => ({
    ...createSession(id, startedAt),
    studyMs,
  });

  it('sums sessions that started today', () => {
    const sessions = [session('a', at(8), 60_000), session('b', at(13), 30_000)];
    expect(todayStudyMs(sessions, at(18))).toBe(90_000);
  });

  it('ignores other days, including just before midnight', () => {
    const sessions = [session('old', at(23, 59, 2), 99_000), session('today', at(0, 1), 5_000)];
    expect(todayStudyMs(sessions, at(12))).toBe(5_000);
  });

  it('can exclude the running session so it is not counted twice', () => {
    const sessions = [session('prev', at(8), 60_000), session('current', at(9), 30_000)];
    expect(todayStudyMs(sessions, at(10), 'current')).toBe(60_000);
  });

  it('is zero with no sessions', () => {
    expect(todayStudyMs([], at(10))).toBe(0);
  });
});
