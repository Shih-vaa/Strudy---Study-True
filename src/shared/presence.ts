import type { PresenceConfig, Settings } from './types';

/** How long "Still studying?" waits for a click before pausing the video. */
export const PRESENCE_RESPONSE_MS = 30_000;

const MINUTE_MS = 60_000;

export function presenceConfigFromSettings(
  settings: Pick<Settings, 'presenceMinMinutes' | 'presenceMaxMinutes'>,
): PresenceConfig {
  return {
    minMs: settings.presenceMinMinutes * MINUTE_MS,
    maxMs: settings.presenceMaxMinutes * MINUTE_MS,
    responseMs: PRESENCE_RESPONSE_MS,
  };
}
