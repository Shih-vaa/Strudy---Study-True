// The recovery key: a random 20-character key, shown once when the exit password is set, that can
// reset a forgotten password. Pure (the random source is injected), so it can be tested.
import { randomBytes as nodeRandomBytes } from 'node:crypto';

// No I, L, O, 0 or 1: they look alike when written down or read out.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const KEY_LENGTH = 20;
const GROUP_SIZE = 5;

type RandomBytes = (size: number) => Uint8Array;

/** Four groups of five, like "K7Q2M-X9RTB-4WNHD-PE3FA": about 99 bits of randomness. */
export function generateRecoveryKey(randomBytes: RandomBytes = nodeRandomBytes): string {
  // Bytes at or above this would make some symbols likelier than others, so they are skipped.
  const limit = 256 - (256 % ALPHABET.length);
  let key = '';
  while (key.length < KEY_LENGTH) {
    for (const byte of randomBytes(KEY_LENGTH * 2)) {
      if (byte < limit && key.length < KEY_LENGTH) key += ALPHABET[byte % ALPHABET.length];
    }
  }
  return formatRecoveryKey(key);
}

export function formatRecoveryKey(compact: string): string {
  return (compact.match(new RegExp(`.{1,${GROUP_SIZE}}`, 'g')) ?? []).join('-');
}

/**
 * The key as typed (any case, with or without dashes and spaces) reduced to its 20 characters, or
 * null if it cannot be a recovery key. This is what gets hashed and checked.
 */
export function normalizeRecoveryKey(input: string): string | null {
  const compact = input.toUpperCase().replace(/[\s-]/g, '');
  if (compact.length !== KEY_LENGTH) return null;
  return [...compact].every((char) => ALPHABET.includes(char)) ? compact : null;
}
