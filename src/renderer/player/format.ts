/** 75 -> "1:15", 3725 -> "1:02:05". Non-finite or negative input reads as 0:00. */
export function formatTime(totalSeconds: number): string {
  const seconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
