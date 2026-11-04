// Settings helpers shared by main (validation) and the renderer (defaults).
import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  focusLock: true,
};

/** Reads settings from storage: unknown keys are dropped, missing or wrongly typed ones get the default. */
export function normalizeSettings(value: unknown): Settings {
  const stored = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  return {
    focusLock: typeof stored.focusLock === 'boolean' ? stored.focusLock : DEFAULT_SETTINGS.focusLock,
  };
}

/** Applies a change from the renderer. Throws on anything that is not a known setting of the right type. */
export function applySettingsPatch(current: Settings, patch: unknown): Settings {
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
    throw new Error('Invalid settings');
  }
  const next: Settings = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'focusLock' && typeof value === 'boolean') next.focusLock = value;
    else throw new Error(`Invalid setting: ${key}`);
  }
  return next;
}
