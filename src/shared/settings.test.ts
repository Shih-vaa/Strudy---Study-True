import { describe, expect, it } from 'vitest';
import { applySettingsPatch, DEFAULT_SETTINGS, normalizeSettings } from './settings';

describe('DEFAULT_SETTINGS', () => {
  it('turns the focus lock on and checks in every 8 to 15 minutes of studying', () => {
    expect(DEFAULT_SETTINGS).toEqual({ focusLock: true, presenceMinMinutes: 8, presenceMaxMinutes: 15 });
  });
});

describe('normalizeSettings', () => {
  it('keeps valid stored settings', () => {
    const stored = { focusLock: false, presenceMinMinutes: 3, presenceMaxMinutes: 5 };
    expect(normalizeSettings(stored)).toEqual(stored);
  });

  it.each([
    ['nothing stored', undefined],
    ['null', null],
    ['a string', 'x'],
    ['an empty object', {}],
  ])('falls back to the defaults for %s', (_label, value) => {
    expect(normalizeSettings(value)).toEqual(DEFAULT_SETTINGS);
  });

  it('defaults a wrongly typed focus lock on its own', () => {
    expect(normalizeSettings({ focusLock: 'yes' }).focusLock).toBe(true);
  });

  it('drops keys it does not know', () => {
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, secret: 1 })).toEqual(DEFAULT_SETTINGS);
  });

  it.each([
    ['one end missing', { presenceMinMinutes: 3 }],
    ['not whole minutes', { presenceMinMinutes: 2.5, presenceMaxMinutes: 5 }],
    ['below the minimum', { presenceMinMinutes: 0, presenceMaxMinutes: 5 }],
    ['above the maximum', { presenceMinMinutes: 5, presenceMaxMinutes: 500 }],
    ['the wrong way round', { presenceMinMinutes: 10, presenceMaxMinutes: 5 }],
    ['text', { presenceMinMinutes: '3', presenceMaxMinutes: '5' }],
  ])('resets both ends of the interval when it is %s', (_label, stored) => {
    const result = normalizeSettings({ focusLock: false, ...stored });
    expect(result.presenceMinMinutes).toBe(8);
    expect(result.presenceMaxMinutes).toBe(15);
    expect(result.focusLock).toBe(false);
  });

  it('accepts an interval with equal ends', () => {
    expect(normalizeSettings({ presenceMinMinutes: 10, presenceMaxMinutes: 10 })).toMatchObject({
      presenceMinMinutes: 10,
      presenceMaxMinutes: 10,
    });
  });
});

describe('applySettingsPatch', () => {
  const current = { ...DEFAULT_SETTINGS };

  it('applies a valid change without touching the input', () => {
    expect(applySettingsPatch(current, { focusLock: false })).toEqual({ ...DEFAULT_SETTINGS, focusLock: false });
    expect(current).toEqual(DEFAULT_SETTINGS);
  });

  it('accepts an empty patch', () => {
    expect(applySettingsPatch(current, {})).toEqual(current);
  });

  it('changes both ends of the interval together', () => {
    expect(applySettingsPatch(current, { presenceMinMinutes: 1, presenceMaxMinutes: 3 })).toMatchObject({
      presenceMinMinutes: 1,
      presenceMaxMinutes: 3,
    });
  });

  it('checks the result as a whole: one end alone must still fit the other', () => {
    expect(() => applySettingsPatch(current, { presenceMinMinutes: 20 })).toThrow(/cannot be longer/);
    expect(() => applySettingsPatch(current, { presenceMaxMinutes: 5 })).toThrow(/cannot be longer/);
    expect(applySettingsPatch(current, { presenceMinMinutes: 14 }).presenceMinMinutes).toBe(14);
  });

  it('says what is wrong with a bad number of minutes', () => {
    for (const bad of [0, 181, 2.5, '5', Number.NaN, null]) {
      expect(() => applySettingsPatch(current, { presenceMinMinutes: bad })).toThrow(/whole minutes from 1 to 180/);
    }
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
