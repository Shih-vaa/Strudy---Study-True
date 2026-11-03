import { describe, expect, it } from 'vitest';
import { hashPassword, isStoredPasswordHash, verifyPassword, type StoredPasswordHash } from './password';

describe('hashPassword / verifyPassword', () => {
  it('accepts the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse');
    expect(await verifyPassword('correct horse', stored)).toBe(true);
    expect(await verifyPassword('correct horsf', stored)).toBe(false);
    expect(await verifyPassword('Correct horse', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('stores scrypt parameters, a salt and a hash, and never the password', async () => {
    const stored = await hashPassword('hunter2hunter2');
    expect(stored).toMatchObject({ algo: 'scrypt', N: 16384, r: 8, p: 1, keylen: 64 });
    expect(Buffer.from(stored.salt, 'base64')).toHaveLength(16);
    expect(Buffer.from(stored.hash, 'base64')).toHaveLength(64);
    expect(JSON.stringify(stored)).not.toContain('hunter2hunter2');
  });

  it('uses a fresh random salt each time, so equal passwords hash differently', async () => {
    const a = await hashPassword('same password');
    const b = await hashPassword('same password');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(await verifyPassword('same password', a)).toBe(true);
    expect(await verifyPassword('same password', b)).toBe(true);
  });

  it('handles spaces, long and non-ASCII passwords', async () => {
    for (const password of ['with some spaces', 'x'.repeat(256), 'pässwörd-日本語-🔒']) {
      const stored = await hashPassword(password);
      expect(await verifyPassword(password, stored)).toBe(true);
      expect(await verifyPassword(`${password}!`, stored)).toBe(false);
    }
  });

  it('treats differently composed but equivalent text as the same password (NFKC)', async () => {
    const stored = await hashPassword('café-secret'); // é as one character
    expect(await verifyPassword('café-secret', stored)).toBe(true); // e + combining accent
  });

  it('rejects a tampered hash or salt', async () => {
    const stored = await hashPassword('correct horse');
    const flipped = Buffer.from(stored.hash, 'base64');
    flipped[0] = (flipped[0] ?? 0) ^ 1;
    expect(await verifyPassword('correct horse', { ...stored, hash: flipped.toString('base64') })).toBe(false);
    expect(await verifyPassword('correct horse', { ...stored, salt: Buffer.from('other salt').toString('base64') })).toBe(false);
  });
});

describe('isStoredPasswordHash', () => {
  const valid: StoredPasswordHash = {
    algo: 'scrypt',
    N: 16384,
    r: 8,
    p: 1,
    keylen: 64,
    salt: 'c2FsdA==',
    hash: 'aGFzaA==',
  };

  it('accepts a well-formed record', () => {
    expect(isStoredPasswordHash(valid)).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'scrypt'],
    ['an empty object', {}],
    ['another algorithm', { ...valid, algo: 'md5' }],
    ['a non-power-of-two N', { ...valid, N: 1000 }],
    ['an N large enough to exhaust memory', { ...valid, N: 1 << 30 }],
    ['a zero r', { ...valid, r: 0 }],
    ['a huge p', { ...valid, p: 1000 }],
    ['a tiny keylen', { ...valid, keylen: 4 }],
    ['a missing salt', { ...valid, salt: undefined }],
    ['an empty hash', { ...valid, hash: '' }],
  ])('rejects %s', (_label, value) => {
    expect(isStoredPasswordHash(value)).toBe(false);
  });

  it('makes verifyPassword fail closed on invalid records', async () => {
    expect(await verifyPassword('anything', null)).toBe(false);
    expect(await verifyPassword('anything', { ...valid, N: 1 << 30 })).toBe(false);
    expect(await verifyPassword('anything', { ...valid, hash: 'AAAA' })).toBe(false); // wrong length
  });
});
