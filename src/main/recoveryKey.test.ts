import { describe, expect, it } from 'vitest';
import { formatRecoveryKey, generateRecoveryKey, normalizeRecoveryKey } from './recoveryKey';

/** A random source that returns the given bytes, then repeats them. */
const fixed = (bytes: number[]) => {
  let i = 0;
  return (size: number) => Uint8Array.from({ length: size }, () => bytes[i++ % bytes.length] ?? 0);
};

describe('generateRecoveryKey', () => {
  it('is four groups of five characters', () => {
    expect(generateRecoveryKey()).toMatch(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/);
  });

  it('never uses characters that look alike (I, L, O, 0, 1)', () => {
    for (let i = 0; i < 200; i++) expect(generateRecoveryKey()).not.toMatch(/[ILO01]/);
  });

  it('is different every time', () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateRecoveryKey()));
    expect(keys.size).toBe(50);
  });

  it('maps bytes onto the alphabet in order', () => {
    // bytes 0..19 -> the first twenty symbols of ABCDEFGHJKMNPQRSTUVWXYZ23456789
    expect(generateRecoveryKey(fixed(Array.from({ length: 20 }, (_, i) => i)))).toBe('ABCDE-FGHJK-MNPQR-STUVW');
  });

  it('skips bytes that would make some symbols likelier (modulo bias)', () => {
    // 31 symbols: bytes 248..255 are rejected. A source that starts with them must still give a key.
    const key = generateRecoveryKey(fixed([255, 254, 253, 248, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]));
    expect(key).toBe('ABCDE-FGHJK-MNPQR-STUVW');
  });

  it('spreads evenly over the alphabet', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 400; i++) {
      for (const char of generateRecoveryKey().replace(/-/g, '')) counts.set(char, (counts.get(char) ?? 0) + 1);
    }
    expect(counts.size).toBe(31); // every symbol turns up
    const values = [...counts.values()];
    expect(Math.max(...values) / Math.min(...values)).toBeLessThan(1.6); // 8000 draws, ~258 each
  });
});

describe('formatRecoveryKey', () => {
  it('groups by five', () => {
    expect(formatRecoveryKey('ABCDEFGHJKMNPQRSTUVW')).toBe('ABCDE-FGHJK-MNPQR-STUVW');
  });
});

describe('normalizeRecoveryKey', () => {
  const compact = 'K7Q2MX9RTB4WNHDPE3FA';

  it('accepts the key as shown', () => {
    expect(normalizeRecoveryKey('K7Q2M-X9RTB-4WNHD-PE3FA')).toBe(compact);
  });

  it('accepts lower case, spaces and missing dashes', () => {
    expect(normalizeRecoveryKey('k7q2m x9rtb 4wnhd pe3fa')).toBe(compact);
    expect(normalizeRecoveryKey('  k7q2mx9rtb4wnhdpe3fa  ')).toBe(compact);
    expect(normalizeRecoveryKey('K7Q2M-X9RTB-4WNHD-PE3FA\n')).toBe(compact);
  });

  it.each([
    ['too short', 'K7Q2M-X9RTB'],
    ['too long', 'K7Q2M-X9RTB-4WNHD-PE3FA-AAAAA'],
    ['empty', ''],
    ['a look-alike character (O)', 'K7Q2M-X9RTB-4WNHD-PE3FO'],
    ['a look-alike digit (0)', 'K7Q2M-X9RTB-4WNHD-PE3F0'],
    ['punctuation', 'K7Q2M-X9RTB-4WNHD-PE3F!'],
  ])('rejects a key that is %s', (_label, input) => {
    expect(normalizeRecoveryKey(input)).toBeNull();
  });

  it('round-trips with generateRecoveryKey', () => {
    const key = generateRecoveryKey();
    expect(normalizeRecoveryKey(key)).toBe(key.replace(/-/g, ''));
  });
});
