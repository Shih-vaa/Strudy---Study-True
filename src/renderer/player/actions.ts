export const SKIP_SECONDS = 10;

function play(video: HTMLVideoElement): void {
  // play() rejects if interrupted by a pause or a new load; that is not an error here.
  video.play().catch(() => undefined);
}

export function togglePlay(video: HTMLVideoElement): void {
  if (video.paused) play(video);
  else video.pause();
}

export function skip(video: HTMLVideoElement, seconds: number): void {
  const end = Number.isFinite(video.duration) ? video.duration : Infinity;
  video.currentTime = Math.min(end, Math.max(0, video.currentTime + seconds));
}

export function restart(video: HTMLVideoElement): void {
  video.currentTime = 0;
  play(video);
}
