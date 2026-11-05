import { describe, expect, it } from 'vitest';
import { describeCameraError } from './cameraErrors';

describe('describeCameraError', () => {
  it.each([
    ['NotAllowedError', /denied/i],
    ['SecurityError', /denied/i],
    ['NotFoundError', /no camera/i],
    ['OverconstrainedError', /no camera/i],
    ['NotReadableError', /another app/i],
    ['AbortError', /stopped/i],
  ])('explains %s', (name, expected) => {
    expect(describeCameraError(new DOMException('x', name))).toMatch(expected);
  });

  it('reads the name from any error-like object', () => {
    expect(describeCameraError({ name: 'NotAllowedError' })).toMatch(/denied/i);
  });

  it.each([['something odd', new Error('boom')], ['a string', 'boom'], ['null', null], ['undefined', undefined]])(
    'falls back to a general message for %s',
    (_label, error) => {
      expect(describeCameraError(error)).toBe('The camera could not be used.');
    },
  );

  it('tells the person where to allow access when it was denied', () => {
    expect(describeCameraError({ name: 'NotAllowedError' })).toMatch(/System Settings/);
  });
});
