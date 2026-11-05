import { describe, expect, it } from 'vitest';
import {
  createSession,
  formatSpan,
  isSession,
  recordAuthFailed,
  recordCameraUnavailable,
  recordPasswordReset,
  recordPersonAway,
  recordPersonReturned,
  recordPresenceMissed,
  upsertSession,
} from './session';

describe('recordPasswordReset', () => {
  it('logs a password_reset event with its timestamp and changes nothing else', () => {
    const before = { ...createSession('s', 1), studyMs: 700, presenceMissedCount: 2 };
    const after = recordPasswordReset(before, 8_000);
    expect(after.events).toEqual([{ type: 'password_reset', timestamp: 8_000 }]);
    expect(after).toMatchObject({ studyMs: 700, presenceMissedCount: 2, focusLostCount: 0 });
    expect(before.events).toEqual([]);
  });

  it('produces a session isSession accepts', () => {
    expect(isSession(recordPasswordReset(createSession('s', 1), 5))).toBe(true);
  });
});

describe('formatSpan', () => {
  it.each([
    [0, '0 s'],
    [52_000, '52 s'],
    [59_400, '59 s'],
    [60_000, '1 min 0 s'],
    [192_000, '3 min 12 s'],
    [3_599_000, '59 min 59 s'],
    [3_720_000, '1 h 2 min'],
  ])('writes %d ms as %s', (ms, text) => {
    expect(formatSpan(ms)).toBe(text);
  });

  it('never goes negative or non-finite', () => {
    expect(formatSpan(-5000)).toBe('0 s');
    expect(formatSpan(Number.NaN)).toBe('0 s');
    expect(formatSpan(Number.POSITIVE_INFINITY)).toBe('0 s');
  });
});

describe('camera events', () => {
  const base = { ...createSession('s', 1), studyMs: 900, focusLostCount: 1 };

  it('logs person_away with how long no one was seen, and changes nothing else', () => {
    const after = recordPersonAway(base, 9_000, 52_000);
    expect(after.events).toEqual([{ type: 'person_away', timestamp: 9_000, detail: 'no one seen for 52 s' }]);
    expect(after).toMatchObject({ studyMs: 900, focusLostCount: 1, presenceMissedCount: 0 });
    expect(base.events).toEqual([]);
  });

  it('logs closed eyes and a turned head as person_away with the matching words', () => {
    expect(recordPersonAway(base, 9_000, 20_000, 'eyes_closed').events).toEqual([
      { type: 'person_away', timestamp: 9_000, detail: 'eyes closed for 20 s' },
    ]);
    expect(recordPersonAway(base, 9_000, 75_000, 'looking_away').events).toEqual([
      { type: 'person_away', timestamp: 9_000, detail: 'looking away for 1 min 15 s' },
    ]);
    expect(recordPersonAway(base, 9_000, 10_000, 'no_face').events[0]?.detail).toBe('no one seen for 10 s');
  });

  it('logs person_returned with how long they were gone', () => {
    const after = recordPersonReturned(base, 9_000, 192_000);
    expect(after.events).toEqual([{ type: 'person_returned', timestamp: 9_000, detail: 'away for 3 min 12 s' }]);
  });

  it('logs camera_unavailable with the reason', () => {
    const after = recordCameraUnavailable(base, 9_000, 'Camera access was denied');
    expect(after.events).toEqual([
      { type: 'camera_unavailable', timestamp: 9_000, detail: 'Camera access was denied' },
    ]);
  });

  it('keeps events in order and produces sessions isSession accepts', () => {
    let s = recordPersonAway(base, 10, 50_000);
    s = recordPersonReturned(s, 20, 70_000);
    s = recordCameraUnavailable(s, 30, 'busy');
    expect(s.events.map((e) => e.type)).toEqual(['person_away', 'person_returned', 'camera_unavailable']);
    expect(isSession(s)).toBe(true);
  });
});

describe('recordPresenceMissed', () => {
  it('counts the miss and logs a presence_missed event with its timestamp', () => {
    const after = recordPresenceMissed(createSession('s', 1), 7_000);
    expect(after.presenceMissedCount).toBe(1);
    expect(after.events).toEqual([{ type: 'presence_missed', timestamp: 7_000 }]);
    expect(isSession(after)).toBe(true);
  });

  it('accumulates and does not touch the other counters or the input', () => {
    const before = { ...createSession('s', 1), focusLostCount: 2, studyMs: 900 };
    const twice = recordPresenceMissed(recordPresenceMissed(before, 2_000), 3_000);
    expect(twice).toMatchObject({ presenceMissedCount: 2, focusLostCount: 2, studyMs: 900 });
    expect(twice.events.map((e) => e.timestamp)).toEqual([2_000, 3_000]);
    expect(before.presenceMissedCount).toBe(0);
  });
});

describe('upsertSession', () => {
  const open = (id: string, studyMs = 0) => ({ ...createSession(id, 1_000), studyMs });
  const ended = (id: string, studyMs: number) => ({ ...open(id, studyMs), endedAt: 9_000 });

  it('adds a session it has not seen', () => {
    expect(upsertSession([open('a')], open('b')).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('replaces the session with the same id, keeping its place', () => {
    const next = upsertSession([open('a', 1), open('b', 2), open('c', 3)], open('b', 50));
    expect(next.map((s) => [s.id, s.studyMs])).toEqual([['a', 1], ['b', 50], ['c', 3]]);
  });

  it('lets a session end', () => {
    const next = upsertSession([open('a', 1)], ended('a', 5));
    expect(next[0]).toMatchObject({ endedAt: 9_000, studyMs: 5 });
  });

  it('keeps an ended session ended when a late, still-open copy arrives', () => {
    const next = upsertSession([ended('a', 5)], open('a', 6));
    expect(next[0]).toMatchObject({ endedAt: 9_000, studyMs: 5 });
  });

  it('still accepts a newer ended copy', () => {
    const next = upsertSession([ended('a', 5)], ended('a', 7));
    expect(next[0]?.studyMs).toBe(7);
  });

  it('does not mutate its input', () => {
    const before = [open('a', 1)];
    upsertSession(before, open('a', 99));
    expect(before[0]?.studyMs).toBe(1);
    expect(before).toHaveLength(1);
  });
});

describe('recordAuthFailed', () => {
  it('logs an auth_failed event with its timestamp and changes nothing else', () => {
    const before = { ...createSession('s', 1), studyMs: 500 };
    const after = recordAuthFailed(before, 9_000);
    expect(after.events).toEqual([{ type: 'auth_failed', timestamp: 9_000 }]);
    expect(after).toMatchObject({ id: 's', studyMs: 500, focusLostCount: 0 });
    expect(before.events).toEqual([]);
  });

  it('can say where the wrong password was typed', () => {
    const after = recordAuthFailed(createSession('s', 1), 9_000, 'settings');
    expect(after.events).toEqual([{ type: 'auth_failed', timestamp: 9_000, detail: 'settings' }]);
    expect(isSession(after)).toBe(true);
  });

  it('keeps earlier events and stays valid', () => {
    const twice = recordAuthFailed(recordAuthFailed(createSession('s', 1), 2_000), 3_000);
    expect(twice.events.map((e) => e.timestamp)).toEqual([2_000, 3_000]);
    expect(isSession(twice)).toBe(true);
  });
});

describe('createSession', () => {
  it('starts empty and unfinished', () => {
    expect(createSession('abc', 1234)).toEqual({
      id: 'abc',
      startedAt: 1234,
      endedAt: null,
      studyMs: 0,
      videosWatched: [],
      focusLostCount: 0,
      presenceMissedCount: 0,
      pauseCount: 0,
      events: [],
    });
  });

  it('produces something isSession accepts', () => {
    expect(isSession(createSession('abc', 1234))).toBe(true);
  });
});

describe('isSession', () => {
  const valid = {
    ...createSession('s1', 1000),
    endedAt: 5000,
    studyMs: 4000,
    videosWatched: ['/a.mp4'],
    focusLostCount: 2,
    events: [{ type: 'focus_lost', timestamp: 2000, detail: 'blur' }],
  };

  it('accepts a complete session', () => {
    expect(isSession(valid)).toBe(true);
  });

  it('accepts events without a detail', () => {
    expect(isSession({ ...valid, events: [{ type: 'presence_missed', timestamp: 1 }] })).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'session'],
    ['an empty object', {}],
    ['an empty id', { ...valid, id: '' }],
    ['a non-numeric start', { ...valid, startedAt: '1000' }],
    ['a missing endedAt', { ...valid, endedAt: undefined }],
    ['a negative study time', { ...valid, studyMs: -1 }],
    ['a NaN study time', { ...valid, studyMs: Number.NaN }],
    ['non-string videos', { ...valid, videosWatched: [1] }],
    ['a fractional count', { ...valid, pauseCount: 1.5 }],
    ['an unknown event type', { ...valid, events: [{ type: 'nope', timestamp: 1 }] }],
    ['an event without a timestamp', { ...valid, events: [{ type: 'focus_lost' }] }],
    ['events that are not an array', { ...valid, events: {} }],
  ])('rejects %s', (_label, value) => {
    expect(isSession(value)).toBe(false);
  });
});
