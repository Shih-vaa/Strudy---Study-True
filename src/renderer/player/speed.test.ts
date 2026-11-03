import { describe, expect, it } from 'vitest';
import { clampSpeed, formatSpeed, MAX_SPEED, MIN_SPEED, nextSpeed, SPEEDS } from './speed';

describe('speeds', () => {
  it('runs 0.5x to 2x in 0.25 steps', () => {
    expect(SPEEDS).toEqual([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
  });

  it('is hard-capped at 2x', () => {
    expect(MAX_SPEED).toBe(2);
    expect(MIN_SPEED).toBe(0.5);
  });
});

describe('clampSpeed', () => {
  it('keeps values inside the range', () => {
    expect(clampSpeed(3)).toBe(2);
    expect(clampSpeed(100)).toBe(2);
    expect(clampSpeed(0.1)).toBe(0.5);
    expect(clampSpeed(-1)).toBe(0.5);
  });

  it('snaps to the nearest step', () => {
    expect(clampSpeed(1.1)).toBe(1);
    expect(clampSpeed(1.2)).toBe(1.25);
    expect(clampSpeed(1.9)).toBe(2);
  });
});

describe('nextSpeed', () => {
  it('steps by 0.25', () => {
    expect(nextSpeed(1, 1)).toBe(1.25);
    expect(nextSpeed(1, -1)).toBe(0.75);
  });

  it('stops at both ends', () => {
    expect(nextSpeed(2, 1)).toBe(2);
    expect(nextSpeed(0.5, -1)).toBe(0.5);
  });
});

describe('formatSpeed', () => {
  it('appends x', () => {
    expect(formatSpeed(1.25)).toBe('1.25x');
    expect(formatSpeed(2)).toBe('2x');
  });
});
