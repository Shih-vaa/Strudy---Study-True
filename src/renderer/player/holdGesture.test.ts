import { describe, expect, it } from 'vitest';
import { createHoldGesture, HOLD_THRESHOLD_MS } from './holdGesture';

/** Fake timers: time only moves when advance() is called. */
function harness() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const log: string[] = [];

  const gesture = createHoldGesture(
    {
      onBoostStart: () => log.push('start'),
      onBoostEnd: () => log.push('end'),
      onTap: () => log.push('tap'),
    },
    HOLD_THRESHOLD_MS,
    {
      set: (fn, ms) => {
        const id = nextId++;
        timers.set(id, { at: now + ms, fn });
        return id;
      },
      clear: (id) => {
        timers.delete(id as number);
      },
    },
  );

  const advance = (ms: number) => {
    const target = now + ms;
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, t]) => t.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      now = due[1].at;
      timers.delete(due[0]);
      due[1].fn();
    }
    now = target;
  };

  return { gesture, advance, log, pendingTimers: () => timers.size };
}

describe('hold gesture', () => {
  it('uses a 250ms threshold', () => {
    expect(HOLD_THRESHOLD_MS).toBe(250);
  });

  it('treats a short press as a tap and leaves no timer behind', () => {
    const h = harness();
    h.gesture.press();
    h.advance(100);
    h.gesture.release();
    expect(h.log).toEqual(['tap']);
    expect(h.pendingTimers()).toBe(0);
  });

  it('still treats a press released just under the threshold as a tap', () => {
    const h = harness();
    h.gesture.press();
    h.advance(249);
    expect(h.log).toEqual([]);
    h.gesture.release();
    expect(h.log).toEqual(['tap']);
  });

  it('starts boosting at the threshold while held, once', () => {
    const h = harness();
    h.gesture.press();
    h.advance(250);
    expect(h.log).toEqual(['start']);
    h.advance(5000);
    expect(h.log).toEqual(['start']);
  });

  it('ends a boost on release and does not count it as a tap', () => {
    const h = harness();
    h.gesture.press();
    h.advance(400);
    h.gesture.release();
    expect(h.log).toEqual(['start', 'end']);
  });

  it('cancelling before the threshold gives neither tap nor boost', () => {
    const h = harness();
    h.gesture.press();
    h.advance(100);
    h.gesture.cancel();
    h.advance(1000);
    expect(h.log).toEqual([]);
    expect(h.pendingTimers()).toBe(0);
  });

  it('cancelling during a boost ends it without a tap, and a later release does nothing', () => {
    const h = harness();
    h.gesture.press();
    h.advance(400);
    h.gesture.cancel();
    h.gesture.release();
    expect(h.log).toEqual(['start', 'end']);
  });

  it('ignores release and cancel without a press', () => {
    const h = harness();
    h.gesture.release();
    h.gesture.cancel();
    expect(h.log).toEqual([]);
  });

  it('does not double-schedule on a repeated press, and is reusable', () => {
    const h = harness();
    h.gesture.press();
    h.gesture.press();
    h.advance(250);
    expect(h.log).toEqual(['start']);
    h.gesture.release();
    h.gesture.press();
    h.advance(50);
    h.gesture.release();
    expect(h.log).toEqual(['start', 'end', 'tap']);
  });
});
