import { describe, expect, it } from 'vitest';
import { baseName, formatTime } from './format';

describe('formatTime', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [75, '1:15'],
    [600, '10:00'],
    [3725, '1:02:05'],
    [75.9, '1:15'],
  ])('formats %s seconds as %s', (seconds, expected) => {
    expect(formatTime(seconds)).toBe(expected);
  });

  it('reads negative and non-finite input as 0:00', () => {
    expect(formatTime(-3)).toBe('0:00');
    expect(formatTime(Number.NaN)).toBe('0:00');
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});

describe('baseName', () => {
  it('handles POSIX and Windows separators', () => {
    expect(baseName('/Users/me/Lecture 1.mp4')).toBe('Lecture 1.mp4');
    expect(baseName('C:\\Videos\\Lecture 1.mp4')).toBe('Lecture 1.mp4');
    expect(baseName('Lecture 1.mp4')).toBe('Lecture 1.mp4');
  });
});
