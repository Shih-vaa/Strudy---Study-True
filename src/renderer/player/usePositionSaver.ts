import { useEffect } from 'react';

const SAVE_INTERVAL_MS = 5000;

/**
 * Persists the resume position of `path` while its <video> plays: every few seconds,
 * on pause, on unmount and on page hide. A finished video resets to 0.
 *
 * `video` and `path` must belong together (call this from a component keyed by path).
 */
export function usePositionSaver(video: HTMLVideoElement | null, path: string): void {
  useEffect(() => {
    if (!video) return;

    // null until the video has actually reported a time, so that leaving before
    // it loaded never overwrites the saved position with 0.
    let latest: number | null = null;
    let lastSavedAt = 0;

    const flush = () => {
      if (latest === null) return;
      // Read `ended` from the element, not from an event: React's own onEnded can
      // unmount us before an 'ended' listener of ours would run.
      void window.api.setPosition(path, video.ended ? 0 : latest);
    };

    const onTimeUpdate = () => {
      latest = video.currentTime;
      if (performance.now() - lastSavedAt >= SAVE_INTERVAL_MS) {
        lastSavedAt = performance.now();
        flush();
      }
    };
    // While a seek is in flight currentTime is already the target, so leaving or
    // quitting right after a seek still saves where the user asked to be.
    const onSeek = () => {
      latest = video.currentTime;
    };
    const onPause = () => {
      latest = video.currentTime;
      flush();
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('seeking', onSeek);
    video.addEventListener('seeked', onSeek);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', flush);
    window.addEventListener('pagehide', flush);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('seeking', onSeek);
      video.removeEventListener('seeked', onSeek);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', flush);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [video, path]);
}
