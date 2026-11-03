// Password hashing with Node's built-in scrypt and a random per-password salt. No native
// modules and no Electron imports, so it can be unit-tested directly.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export interface StoredPasswordHash {
  algo: 'scrypt';
  N: number;
  r: number;
  p: number;
  keylen: number;
  /** base64 */
  salt: string;
  /** base64 */
  hash: string;
}

type ScryptParams = Pick<StoredPasswordHash, 'N' | 'r' | 'p' | 'keylen'>;

// Parameters are stored with each hash so they can be raised later without breaking old ones.
const PARAMS: ScryptParams = { N: 16384, r: 8, p: 1, keylen: 64 };
const SALT_BYTES = 16;

// Sanity bounds for a stored hash, so a damaged or tampered file cannot make us allocate gigabytes.
const MAX_N = 1 << 20;
const MAX_R = 32;
const MAX_P = 16;
const MIN_KEYLEN = 16;
const MAX_KEYLEN = 128;

const isPositiveInt = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= max;

export function isStoredPasswordHash(value: unknown): value is StoredPasswordHash {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.algo === 'scrypt' &&
    isPositiveInt(v.N, MAX_N) &&
    (v.N as number) >= 2 &&
    ((v.N as number) & ((v.N as number) - 1)) === 0 && // scrypt needs a power of two
    isPositiveInt(v.r, MAX_R) &&
    isPositiveInt(v.p, MAX_P) &&
    typeof v.keylen === 'number' &&
    Number.isInteger(v.keylen) &&
    v.keylen >= MIN_KEYLEN &&
    v.keylen <= MAX_KEYLEN &&
    typeof v.salt === 'string' &&
    v.salt.length > 0 &&
    typeof v.hash === 'string' &&
    v.hash.length > 0
  );
}

function derive(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      // NFKC so the same typed password matches however the keyboard composed it.
      password.normalize('NFKC'),
      salt,
      params.keylen,
      { N: params.N, r: params.r, p: params.p, maxmem: 256 * params.N * params.r },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<StoredPasswordHash> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, PARAMS);
  return { algo: 'scrypt', ...PARAMS, salt: salt.toString('base64'), hash: key.toString('base64') };
}

/** False for a wrong password and for anything that is not a valid stored hash. */
export async function verifyPassword(password: string, stored: unknown): Promise<boolean> {
  if (!isStoredPasswordHash(stored)) return false;
  const expected = Buffer.from(stored.hash, 'base64');
  if (expected.length !== stored.keylen) return false;
  const actual = await derive(password, Buffer.from(stored.salt, 'base64'), stored);
  return timingSafeEqual(actual, expected);
}
