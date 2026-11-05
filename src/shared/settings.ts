// Settings helpers shared by main (validation) and the renderer (defaults).
import type { Settings } from './types';

export const PRESENCE_MINUTES_MIN = 1;
export const PRESENCE_MINUTES_MAX = 180;

export const CAMERA_GRACE_SECONDS_MIN = 10;
export const CAMERA_GRACE_SECONDS_MAX = 300;

export const DEFAULT_SETTINGS: Settings = {
  focusLock: true,
  presenceMinMinutes: 8,
  presenceMaxMinutes: 15,
  cameraCheck: false,
  cameraGraceSeconds: 10,
};

const isMinutes = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= PRESENCE_MINUTES_MIN &&
  value <= PRESENCE_MINUTES_MAX;

const isGraceSeconds = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= CAMERA_GRACE_SECONDS_MIN &&
  value <= CAMERA_GRACE_SECONDS_MAX;

/** Reads settings from storage: unknown keys are dropped, missing or wrongly typed ones get the default. */
export function normalizeSettings(value: unknown): Settings {
  const stored = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const min = stored.presenceMinMinutes;
  const max = stored.presenceMaxMinutes;
  // The two ends only make sense together: if either is bad, or they are the wrong way round,
  // both go back to the defaults.
  const rangeIsValid = isMinutes(min) && isMinutes(max) && min <= max;
  return {
    focusLock: typeof stored.focusLock === 'boolean' ? stored.focusLock : DEFAULT_SETTINGS.focusLock,
    presenceMinMinutes: rangeIsValid ? min : DEFAULT_SETTINGS.presenceMinMinutes,
    presenceMaxMinutes: rangeIsValid ? max : DEFAULT_SETTINGS.presenceMaxMinutes,
    cameraCheck: typeof stored.cameraCheck === 'boolean' ? stored.cameraCheck : DEFAULT_SETTINGS.cameraCheck,
    cameraGraceSeconds: isGraceSeconds(stored.cameraGraceSeconds)
      ? stored.cameraGraceSeconds
      : DEFAULT_SETTINGS.cameraGraceSeconds,
  };
}

/** Applies a change from the renderer. Throws on anything that is not a known setting of the right type. */
export function applySettingsPatch(current: Settings, patch: unknown): Settings {
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
    throw new Error('Invalid settings');
  }
  const next: Settings = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'focusLock' && typeof value === 'boolean') {
      next.focusLock = value;
    } else if (key === 'cameraCheck' && typeof value === 'boolean') {
      next.cameraCheck = value;
    } else if (key === 'cameraGraceSeconds') {
      if (!isGraceSeconds(value)) {
        throw new Error(`Use whole seconds from ${CAMERA_GRACE_SECONDS_MIN} to ${CAMERA_GRACE_SECONDS_MAX}.`);
      }
      next.cameraGraceSeconds = value;
    } else if (key === 'presenceMinMinutes' || key === 'presenceMaxMinutes') {
      if (!isMinutes(value)) {
        throw new Error(`Use whole minutes from ${PRESENCE_MINUTES_MIN} to ${PRESENCE_MINUTES_MAX}.`);
      }
      next[key] = value;
    } else {
      throw new Error(`Invalid setting: ${key}`);
    }
  }
  if (next.presenceMinMinutes > next.presenceMaxMinutes) {
    throw new Error('The shortest gap cannot be longer than the longest.');
  }
  return next;
}
