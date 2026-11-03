import { describe, expect, it } from 'vitest';
import { checkNewPassword, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validatePasswordLength } from './auth';

describe('validatePasswordLength', () => {
  it('requires at least 6 characters', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(6);
    expect(validatePasswordLength('12345')).toBe('Use at least 6 characters.');
    expect(validatePasswordLength('')).toBe('Use at least 6 characters.');
    expect(validatePasswordLength('123456')).toBeNull();
  });

  it('caps the length so a huge input cannot be used to stall the hash', () => {
    expect(validatePasswordLength('x'.repeat(PASSWORD_MAX_LENGTH))).toBeNull();
    expect(validatePasswordLength('x'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe('Use at most 256 characters.');
  });

  it('counts characters, not spaces trimmed away', () => {
    expect(validatePasswordLength('      ')).toBeNull();
  });
});

describe('checkNewPassword', () => {
  it('accepts a matching password of enough length', () => {
    expect(checkNewPassword('correct horse', 'correct horse')).toBeNull();
  });

  it('reports a short password before a mismatch', () => {
    expect(checkNewPassword('abc', 'abd')).toBe('Use at least 6 characters.');
  });

  it('reports a mismatch', () => {
    expect(checkNewPassword('abcdef', 'abcdeg')).toBe("The two passwords don't match.");
    expect(checkNewPassword('abcdef', '')).toBe("The two passwords don't match.");
  });

  it('is case sensitive', () => {
    expect(checkNewPassword('Abcdef', 'abcdef')).toBe("The two passwords don't match.");
  });
});
