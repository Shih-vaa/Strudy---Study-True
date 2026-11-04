import { describe, expect, it } from 'vitest';
import { PRESENCE_RESPONSE_MS, presenceConfigFromSettings } from './presence';

describe('presenceConfigFromSettings', () => {
  it('turns minutes into milliseconds and waits 30 seconds for a click', () => {
    expect(presenceConfigFromSettings({ presenceMinMinutes: 8, presenceMaxMinutes: 15 })).toEqual({
      minMs: 480_000,
      maxMs: 900_000,
      responseMs: 30_000,
    });
    expect(PRESENCE_RESPONSE_MS).toBe(30_000);
  });

  it('handles equal ends', () => {
    expect(presenceConfigFromSettings({ presenceMinMinutes: 1, presenceMaxMinutes: 1 })).toMatchObject({
      minMs: 60_000,
      maxMs: 60_000,
    });
  });
});
