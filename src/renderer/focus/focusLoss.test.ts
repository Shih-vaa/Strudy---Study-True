import { describe, expect, it } from 'vitest';
import { createSession } from '../../shared/session';
import { awaySeconds, recordFocusLost, recordFocusReturned, type FocusLoss } from './focusLoss';

const session = () => createSession('s1', 1_000);

describe('recordFocusLost', () => {
  it('counts the loss and logs a focus_lost event with its timestamp', () => {
    const next = recordFocusLost(session(), 5_000);
    expect(next.focusLostCount).toBe(1);
    expect(next.events).toEqual([{ type: 'focus_lost', timestamp: 5_000 }]);
  });

  it('accumulates over several losses', () => {
    const next = recordFocusLost(recordFocusLost(session(), 5_000), 9_000);
    expect(next.focusLostCount).toBe(2);
    expect(next.events.map((e) => e.timestamp)).toEqual([5_000, 9_000]);
  });

  it('does not mutate its input', () => {
    const before = session();
    recordFocusLost(before, 5_000);
    expect(before.focusLostCount).toBe(0);
    expect(before.events).toEqual([]);
  });

  it('leaves everything else alone', () => {
    const base = { ...session(), studyMs: 1234, videosWatched: ['/a.mp4'], pauseCount: 3 };
    const next = recordFocusLost(base, 5_000);
    expect(next).toMatchObject({ studyMs: 1234, videosWatched: ['/a.mp4'], pauseCount: 3, id: 's1' });
  });
});

describe('awaySeconds', () => {
  it('is null while still away', () => {
    expect(awaySeconds({ lostAt: 1_000, returnedAt: null })).toBeNull();
  });

  it('rounds to whole seconds', () => {
    expect(awaySeconds({ lostAt: 1_000, returnedAt: 43_400 })).toBe(42);
    expect(awaySeconds({ lostAt: 1_000, returnedAt: 43_600 })).toBe(43);
  });

  it('never goes negative', () => {
    expect(awaySeconds({ lostAt: 5_000, returnedAt: 4_000 })).toBe(0);
  });
});

describe('recordFocusReturned', () => {
  const loss: FocusLoss = { lostAt: 5_000, returnedAt: 47_000 };

  it('notes how long it was away on the matching event', () => {
    const next = recordFocusReturned(recordFocusLost(session(), 5_000), loss);
    expect(next.events).toEqual([{ type: 'focus_lost', timestamp: 5_000, detail: 'away 42s' }]);
  });

  it('only touches the event that matches, not earlier ones', () => {
    const twice = recordFocusLost(recordFocusLost(session(), 2_000), 5_000);
    const next = recordFocusReturned(twice, loss);
    expect(next.events[0]).toEqual({ type: 'focus_lost', timestamp: 2_000 });
    expect(next.events[1]).toEqual({ type: 'focus_lost', timestamp: 5_000, detail: 'away 42s' });
  });

  it('does not change the count', () => {
    const next = recordFocusReturned(recordFocusLost(session(), 5_000), loss);
    expect(next.focusLostCount).toBe(1);
  });

  it('does nothing while still away', () => {
    const logged = recordFocusLost(session(), 5_000);
    expect(recordFocusReturned(logged, { lostAt: 5_000, returnedAt: null })).toBe(logged);
  });

  it('does nothing when there is no matching event', () => {
    const logged = recordFocusLost(session(), 5_000);
    expect(recordFocusReturned(logged, { lostAt: 9_999, returnedAt: 12_000 })).toBe(logged);
  });

  it('does not mutate its input', () => {
    const logged = recordFocusLost(session(), 5_000);
    recordFocusReturned(logged, loss);
    expect(logged.events[0]).toEqual({ type: 'focus_lost', timestamp: 5_000 });
  });
});
