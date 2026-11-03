// Runtime helpers shared by main and renderer (not the preload: it is sandboxed).

export const MEDIA_SCHEME = 'strudy-media';

export const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.mov', '.m4v'] as const;

export function isVideoFile(name: string): boolean {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return false;
  return (VIDEO_EXTENSIONS as readonly string[]).includes(name.slice(dot).toLowerCase());
}

/** URL the renderer hands to <video>. Main only serves paths the user picked in a dialog. */
export function toMediaUrl(path: string): string {
  return `${MEDIA_SCHEME}://media/${encodeURIComponent(path)}`;
}

export function fromMediaUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== `${MEDIA_SCHEME}:` || parsed.hostname !== 'media') return null;
    return decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    return null;
  }
}
