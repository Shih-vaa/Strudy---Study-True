import { describe, expect, it } from 'vitest';
import { applySettingsPatch, DEFAULT_SETTINGS, normalizeSettings } from './settings';

describe('normalizeSettings', () => {
  it('keeps valid stored settings', () => {
    expect(normalizeSettings({ focusLock: false })).toEqual({ focusLock: false });
    expect(normalizeSettings({ focusLock: true })).toEqual({ focusLock: true });
  });

  it.each([
    ['nothing stored', undefined],
    ['null', null],
    ['a string', 'x'],
    ['an empty object', {}],
    ['a wrongly typed value', { focusLock: 'yes' }],
  ])('falls back to the defaults for %s', (_label, value) => {
    expect(normalizeSettings(value)).toEqual(DEFAULT_SETTINGS);
  });

  it('drops keys it does not know', () => {
    expect(normalizeSettings({ focusLock: false, secret: 1 })).toEqual({ focusLock: false });
  });

  it('turns the focus lock on by default', () => {
    expect(DEFAULT_SETTINGS.focusLock).toBe(true);
  });
});

describe('applySettingsPatch', () => {
  const current = { focusLock: true };

  it('applies a valid change without touching the input', () => {
    expect(applySettingsPatch(current, { focusLock: false })).toEqual({ focusLock: false });
    expect(current).toEqual({ focusLock: true });
  });

  it('accepts an empty patch', () => {
    expect(applySettingsPatch(current, {})).toEqual(current);
  });

  it.each([
    ['an unknown key', { nope: true }],
    ['a wrongly typed value', { focusLock: 'off' }],
    ['null', null],
    ['an array', [true]],
    ['a string', 'focusLock'],
    ['a valid key next to an unknown one', { focusLock: false, extra: 1 }],
  ])('rejects %s', (_label, patch) => {
    expect(() => applySettingsPatch(current, patch)).toThrow();
  });
});
