import { describe, expect, it } from 'vitest';
import { applySettingsPatch, DEFAULT_SETTINGS, normalizeSettings } from './settings';

describe('DEFAULT_SETTINGS', () => {
  it('turns the focus lock on and checks in every 8 to 15 minutes of studying', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ focusLock: true, presenceMinMinutes: 8, presenceMaxMinutes: 15 });
  });

  it('leaves the camera check off, with a 10 second grace period ready for when it is switched on', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ cameraCheck: false, cameraGraceSeconds: 10 });
  });

  it('leaves the eyes-and-head check off too, with a 20 second grace period', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ cameraAttention: false, cameraAttentionGraceSeconds: 20 });
  });
});

describe('normalizeSettings', () => {
  it('keeps valid stored settings', () => {
    const stored = {
      focusLock: false,
      presenceMinMinutes: 3,
      presenceMaxMinutes: 5,
      cameraCheck: true,
      cameraGraceSeconds: 90,
      cameraAttention: true,
      cameraAttentionGraceSeconds: 45,
    };
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

  it('reads settings saved before the camera check existed as "camera off"', () => {
    const old = { focusLock: false, presenceMinMinutes: 3, presenceMaxMinutes: 5 };
    expect(normalizeSettings(old)).toEqual({
      ...old,
      cameraCheck: false,
      cameraGraceSeconds: 10,
      cameraAttention: false,
      cameraAttentionGraceSeconds: 20,
    });
  });

  it('never turns the camera on from a wrongly typed value', () => {
    for (const bad of ['true', 1, null, {}]) {
      expect(normalizeSettings({ cameraCheck: bad }).cameraCheck).toBe(false);
    }
  });

  it('never turns the eyes-and-head check on from a wrongly typed value', () => {
    for (const bad of ['true', 1, null, {}]) {
      expect(normalizeSettings({ cameraAttention: bad }).cameraAttention).toBe(false);
    }
  });

  it.each([9, 301, 45.5, '45', Number.NaN, null])('resets an eyes-and-head grace period of %s on its own', (bad) => {
    const result = normalizeSettings({ cameraAttention: true, cameraAttentionGraceSeconds: bad });
    expect(result.cameraAttentionGraceSeconds).toBe(20);
    expect(result.cameraAttention).toBe(true);
  });

  it.each([9, 301, 45.5, '45', Number.NaN, null])('resets a grace period of %s on its own', (bad) => {
    const result = normalizeSettings({ focusLock: false, cameraCheck: true, cameraGraceSeconds: bad });
    expect(result.cameraGraceSeconds).toBe(10);
    expect(result.cameraCheck).toBe(true);
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

  it('switches the camera check on and off', () => {
    expect(applySettingsPatch(current, { cameraCheck: true }).cameraCheck).toBe(true);
    expect(applySettingsPatch({ ...current, cameraCheck: true }, { cameraCheck: false }).cameraCheck).toBe(false);
  });

  it('switches the eyes-and-head check on and off, and sets its grace period within 10 to 300 seconds', () => {
    expect(applySettingsPatch(current, { cameraAttention: true }).cameraAttention).toBe(true);
    expect(applySettingsPatch(current, { cameraAttentionGraceSeconds: 90 }).cameraAttentionGraceSeconds).toBe(90);
    for (const bad of [9, 301, 20.5, '20', Number.NaN, null]) {
      expect(() => applySettingsPatch(current, { cameraAttentionGraceSeconds: bad })).toThrow(/whole seconds from 10 to 300/);
    }
    expect(() => applySettingsPatch(current, { cameraAttention: 'yes' })).toThrow();
  });

  it('sets the grace period within 10 to 300 seconds', () => {
    expect(applySettingsPatch(current, { cameraGraceSeconds: 10 }).cameraGraceSeconds).toBe(10);
    expect(applySettingsPatch(current, { cameraGraceSeconds: 45 }).cameraGraceSeconds).toBe(45);
    expect(applySettingsPatch(current, { cameraGraceSeconds: 300 }).cameraGraceSeconds).toBe(300);
    for (const bad of [9, 301, 0, -5, 45.5, '45', Number.NaN, null]) {
      expect(() => applySettingsPatch(current, { cameraGraceSeconds: bad })).toThrow(/whole seconds from 10 to 300/);
    }
  });

  it.each([
    ['an unknown key', { nope: true }],
    ['a wrongly typed value', { focusLock: 'off' }],
    ['a wrongly typed camera switch', { cameraCheck: 'on' }],
    ['null', null],
    ['an array', [true]],
    ['a string', 'focusLock'],
    ['a valid key next to an unknown one', { focusLock: false, extra: 1 }],
  ])('rejects %s', (_label, patch) => {
    expect(() => applySettingsPatch(current, patch)).toThrow();
  });
});
