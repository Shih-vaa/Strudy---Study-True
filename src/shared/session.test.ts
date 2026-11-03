import { describe, expect, it } from 'vitest';
import { createSession, isSession } from './session';

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
