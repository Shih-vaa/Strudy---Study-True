import { describe, expect, it } from 'vitest';
import { parseByteRange } from './range';

describe('parseByteRange', () => {
  const size = 1000;

  it('has nothing to honour without a header', () => {
    expect(parseByteRange(null, size)).toBeNull();
    expect(parseByteRange('', size)).toBeNull();
  });

  it('parses start-end', () => {
    expect(parseByteRange('bytes=0-99', size)).toEqual({ start: 0, end: 99 });
    expect(parseByteRange('bytes=100-199', size)).toEqual({ start: 100, end: 199 });
  });

  it('parses an open-ended range up to the last byte', () => {
    expect(parseByteRange('bytes=900-', size)).toEqual({ start: 900, end: 999 });
  });

  it('parses a suffix range as the last N bytes', () => {
    expect(parseByteRange('bytes=-50', size)).toEqual({ start: 950, end: 999 });
  });

  it('clamps a suffix longer than the file to the whole file', () => {
    expect(parseByteRange('bytes=-5000', size)).toEqual({ start: 0, end: 999 });
  });

  it('clamps an end past the file to the last byte', () => {
    expect(parseByteRange('bytes=500-5000', size)).toEqual({ start: 500, end: 999 });
  });

  it('is unsatisfiable when the start is at or past the end', () => {
    expect(parseByteRange('bytes=1000-', size)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=5000-6000', size)).toBe('unsatisfiable');
  });

  it('is unsatisfiable when start is after end, or for a zero-length suffix', () => {
    expect(parseByteRange('bytes=200-100', size)).toBe('unsatisfiable');
    expect(parseByteRange('bytes=-0', size)).toBe('unsatisfiable');
  });

  it('is unsatisfiable for any range on an empty file', () => {
    expect(parseByteRange('bytes=0-', 0)).toBe('unsatisfiable');
  });

  it('ignores forms it does not support, so the whole file is sent', () => {
    expect(parseByteRange('bytes=0-10,20-30', size)).toBeNull();
    expect(parseByteRange('bytes=-', size)).toBeNull();
    expect(parseByteRange('items=0-10', size)).toBeNull();
    expect(parseByteRange('garbage', size)).toBeNull();
  });
});
