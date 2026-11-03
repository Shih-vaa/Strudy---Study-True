import { protocol } from 'electron';
import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fromMediaUrl, isVideoFile, MEDIA_SCHEME } from '../shared/media';
import { parseByteRange } from './range';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
};

/** Files the user has picked in a dialog this launch; the only ones the protocol serves. */
const granted = new Set<string>();

export function grantMedia(paths: string[]): void {
  for (const path of paths) granted.add(resolve(path));
}

/** Videos directly inside `folder` (not recursive), naturally sorted: "2" before "10". */
export async function listVideosInFolder(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.') && isVideoFile(entry.name))
    .map((entry) => join(folder, entry.name))
    .sort((a, b) => collator.compare(basename(a), basename(b)));
}

/** Must run before the app is ready. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ]);
}

/**
 * Streams a granted file with proper Range support (206 + Content-Range), which Chromium
 * needs to seek inside large files that are not fully buffered.
 */
async function serveMedia(request: Request): Promise<Response> {
  const path = fromMediaUrl(request.url);
  if (path === null || !granted.has(resolve(path))) {
    return new Response('Forbidden', { status: 403 });
  }

  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    return new Response('Not found', { status: 404 });
  }

  const baseHeaders = {
    'Content-Type': MIME_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
  };

  const range = parseByteRange(request.headers.get('range'), size);
  if (range === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: { ...baseHeaders, 'Content-Range': `bytes */${size}` },
    });
  }

  const { start, end } = range ?? { start: 0, end: size - 1 };
  const headers: Record<string, string> = {
    ...baseHeaders,
    'Content-Length': String(size === 0 ? 0 : end - start + 1),
  };
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;

  if (size === 0) return new Response(null, { status: 200, headers });

  const stream = createReadStream(path, { start, end });
  // Seeking aborts the in-flight request: stop reading instead of buffering the rest.
  request.signal.addEventListener('abort', () => stream.destroy(), { once: true });
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    status: range ? 206 : 200,
    headers,
  });
}

export function registerMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, serveMedia);
}
