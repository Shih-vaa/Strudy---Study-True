import { describe, expect, it } from 'vitest';
import { createSession } from '../../shared/session';
import {
  barHeights,
  countPersonAway,
  formatStudyTime,
  lastDays,
  sessionRows,
  summarizeDay,
  wholeMinutes,
  withCurrentSession,
} from './summary';

// Wednesday 4 Nov 2026, local time
const at = (h: number, m = 0, day = 4) => new Date(2026, 10, day, h, m).getTime();
const midnight = (day: number) => new Date(2026, 10, day).getTime();

const session = (
  id: string,
  startedAt: number,
  extra: Partial<ReturnType<typeof createSession>> = {},
) => ({ ...createSession(id, startedAt), ...extra });

describe('summarizeDay', () => {
  const sessions = [
    session('a', at(8), { studyMs: 600_000, focusLostCount: 2, presenceMissedCount: 1 }),
    session('b', at(14), { studyMs: 300_000, focusLostCount: 1 }),
    session('yesterday', at(20, 0, 3), { studyMs: 999_000, focusLostCount: 9 }),
  ];

  it('adds up the sessions that started that day', () => {
    expect(summarizeDay(sessions, midnight(4))).toEqual({
      dayStart: midnight(4),
      studyMs: 900_000,
      sessions: 2,
      focusLost: 3,
      presenceMissed: 1,
      personAway: 0,
    });
  });

  it('is all zeros for a day with nothing', () => {
    expect(summarizeDay(sessions, midnight(1))).toEqual({
      dayStart: midnight(1),
      studyMs: 0,
      sessions: 0,
      focusLost: 0,
      presenceMissed: 0,
      personAway: 0,
    });
  });

  it('counts the times the camera check found no one, from the logged events', () => {
    const watched = [
      session('cam', at(9), {
        events: [
          { type: 'person_away', timestamp: at(9, 10), detail: 'no one seen for 45 s' },
          { type: 'person_returned', timestamp: at(9, 20), detail: 'away for 9 min 40 s' },
          { type: 'person_away', timestamp: at(9, 40), detail: 'no one seen for 50 s' },
          { type: 'camera_unavailable', timestamp: at(9, 50), detail: 'busy' },
        ],
      }),
      session('other', at(13), { events: [{ type: 'person_away', timestamp: at(13, 5) }] }),
    ];
    expect(summarizeDay(watched, midnight(4)).personAway).toBe(3);
    expect(sessionRows(watched, null).find((r) => r.id === 'cam')?.personAway).toBe(2);
  });

  it('puts a session just before and just after midnight on the right days', () => {
    const edge = [session('late', at(23, 59, 3), { studyMs: 1000 }), session('early', at(0, 1, 4), { studyMs: 2000 })];
    expect(summarizeDay(edge, midnight(3)).studyMs).toBe(1000);
    expect(summarizeDay(edge, midnight(4)).studyMs).toBe(2000);
  });
});

describe('countPersonAway', () => {
  it('counts only person_away events, and is 0 for none', () => {
    expect(countPersonAway([])).toBe(0);
    expect(
      countPersonAway([
        { type: 'focus_lost', timestamp: 1 },
        { type: 'person_away', timestamp: 2 },
        { type: 'person_returned', timestamp: 3 },
      ]),
    ).toBe(1);
  });
});

describe('lastDays', () => {
  // The window is 29 Oct .. 4 Nov. (Day -2 of November is 29 Oct, day -3 is 28 Oct.)
  const sessions = [
    session('today', at(9), { studyMs: 120_000 }),
    session('2 Nov', at(9, 0, 2), { studyMs: 60_000 }),
    session('29 Oct, the oldest day shown', at(9, 0, -2), { studyMs: 30_000 }),
    session('28 Oct, just outside', at(9, 0, -3), { studyMs: 777_000 }),
  ];

  it('gives seven days, oldest first, ending with today', () => {
    const days = lastDays(sessions, at(18));
    expect(days).toHaveLength(7);
    expect(days[6]?.dayStart).toBe(midnight(4));
    expect(days[0]?.dayStart).toBe(new Date(2026, 9, 29).getTime()); // 29 Oct
    const starts = days.map((d) => d.dayStart);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it('puts each session on its own day, with zeros in between', () => {
    // 29 Oct, 30, 31, 1 Nov, 2 Nov, 3 Nov, 4 Nov
    expect(lastDays(sessions, at(18)).map((d) => d.studyMs)).toEqual([30_000, 0, 0, 0, 60_000, 0, 120_000]);
  });

  it('includes the oldest day of the window and leaves out the day before it', () => {
    const total = lastDays(sessions, at(18)).reduce((sum, d) => sum + d.studyMs, 0);
    expect(total).toBe(210_000); // not 987_000: the 28 Oct session is excluded
  });

  it('works with no sessions at all', () => {
    expect(lastDays([], at(18)).every((d) => d.studyMs === 0)).toBe(true);
  });

  it('respects a different length', () => {
    expect(lastDays([], at(18), 3)).toHaveLength(3);
  });
});

describe('withCurrentSession', () => {
  it('swaps in the running session, which is newer than its last save', () => {
    const stored = [session('x', at(9), { studyMs: 1000 })];
    const merged = withCurrentSession(stored, session('x', at(9), { studyMs: 5000 }));
    expect(merged).toHaveLength(1);
    expect(merged[0]?.studyMs).toBe(5000);
  });

  it('adds a running session that was never saved', () => {
    expect(withCurrentSession([], session('new', at(9)))).toHaveLength(1);
  });

  it('leaves the stored sessions alone when nothing is running', () => {
    const stored = [session('x', at(9))];
    expect(withCurrentSession(stored, null)).toEqual(stored);
  });

  it('does not change what it was given', () => {
    const stored = [session('x', at(9), { studyMs: 1000 })];
    withCurrentSession(stored, session('x', at(9), { studyMs: 5000 }));
    expect(stored[0]?.studyMs).toBe(1000);
  });
});

describe('sessionRows', () => {
  const sessions = [
    session('old', at(8), { studyMs: 1000, videosWatched: ['/a.mp4', '/b.mp4'], focusLostCount: 2 }),
    session('new', at(15), { endedAt: at(16) }),
    session('mid', at(11), { presenceMissedCount: 3 }),
  ];

  it('lists the newest session first', () => {
    expect(sessionRows(sessions, null).map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });

  it('carries the numbers the screen shows', () => {
    const row = sessionRows(sessions, null).find((r) => r.id === 'old');
    expect(row).toMatchObject({ studyMs: 1000, videoCount: 2, focusLost: 2, presenceMissed: 0, endedAt: null });
    expect(sessionRows(sessions, null).find((r) => r.id === 'mid')?.presenceMissed).toBe(3);
  });

  it('marks only the running session', () => {
    expect(sessionRows(sessions, 'mid').map((r) => r.running)).toEqual([false, true, false]);
    expect(sessionRows(sessions, null).every((r) => !r.running)).toBe(true);
  });

  it('keeps the events so they can be shown', () => {
    const withEvents = [session('e', at(9), { events: [{ type: 'focus_lost', timestamp: at(9, 5), detail: 'away 4s' }] })];
    expect(sessionRows(withEvents, null)[0]?.events).toHaveLength(1);
  });
});

describe('barHeights', () => {
  it('scales to the biggest value', () => {
    expect(barHeights([0, 30, 60], 100, 10)).toEqual([0, 50, 100]);
  });

  it('does not blow up a few minutes to fill the chart: the scale has a floor', () => {
    expect(barHeights([5], 100, 60)).toEqual([(5 / 60) * 100]);
  });

  it('gives any non-zero value a visible sliver', () => {
    expect(barHeights([0.01, 1000], 100, 10)[0]).toBe(2);
  });

  it('is flat for all zeros, and never divides by zero', () => {
    expect(barHeights([0, 0, 0], 100, 0)).toEqual([0, 0, 0]);
  });
});

describe('formatStudyTime', () => {
  it.each([
    [0, '0 s'],
    [42_000, '42 s'],
    [59_999, '59 s'],
    [60_000, '1 min'],
    [720_000, '12 min'],
    [3_599_000, '59 min'],
    [3_600_000, '1 h 0 min'],
    [3_720_000, '1 h 2 min'],
    [90_000_000, '25 h 0 min'],
  ])('formats %i ms as %s', (ms, expected) => {
    expect(formatStudyTime(ms)).toBe(expected);
  });

  it('reads negative and non-finite input as zero', () => {
    expect(formatStudyTime(-5)).toBe('0 s');
    expect(formatStudyTime(Number.NaN)).toBe('0 s');
  });
});

describe('wholeMinutes', () => {
  it('rounds to the nearest minute and never goes negative', () => {
    expect(wholeMinutes(29_999)).toBe(0);
    expect(wholeMinutes(30_000)).toBe(1);
    expect(wholeMinutes(5_400_000)).toBe(90);
    expect(wholeMinutes(-1000)).toBe(0);
  });
});
