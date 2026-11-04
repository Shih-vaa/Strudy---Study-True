import { presenceConfigFromSettings } from '../shared/presence';
import type { PresenceConfig } from '../shared/types';
import { devSwitchOn } from './devFlags';
import { getSettings } from './store';

/**
 * The presence-check timings in force: from Settings, or, with STRUDY_PRESENCE_FAST=1
 * (development only, ignored in packaged builds), seconds instead of minutes so the flow can
 * be tried without waiting.
 */
export function getPresenceConfig(): PresenceConfig {
  if (devSwitchOn('STRUDY_PRESENCE_FAST')) return { minMs: 4000, maxMs: 6000, responseMs: 4000 };
  return presenceConfigFromSettings(getSettings());
}
