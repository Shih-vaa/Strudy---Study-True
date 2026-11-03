/** Inclusive byte offsets, as in a Content-Range header. */
export interface ByteRange {
  start: number;
  end: number;
}

/**
 * Parses a single-range `Range: bytes=...` header against a file of `size` bytes.
 * Returns null when there is nothing to honour (no header, or a form we ignore such as
 * multiple ranges: the whole file is sent instead), or 'unsatisfiable' for a 416.
 */
export function parseByteRange(header: string | null, size: number): ByteRange | null | 'unsatisfiable' {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, rawStart = '', rawEnd = ''] = match;
  if (rawStart === '' && rawEnd === '') return null;

  let start: number;
  let end: number;
  if (rawStart === '') {
    // "-N": the last N bytes.
    const suffix = Number(rawEnd);
    if (suffix === 0) return 'unsatisfiable';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  }

  if (start >= size || start > end) return 'unsatisfiable';
  return { start, end };
}
