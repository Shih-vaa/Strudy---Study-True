import { useEffect } from 'react';
import { registerExitFlush } from '../state/exitFlush';

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

    const flush = (): Promise<void> => {
      if (latest === null) return Promise.resolve();
      // Read `ended` from the element, not from an event: React's own onEnded can
      // unmount us before an 'ended' listener of ours would run.
      return window.api.setPosition(path, video.ended ? 0 : latest);
    };

    const onTimeUpdate = () => {
      latest = video.currentTime;
      if (performance.now() - lastSavedAt >= SAVE_INTERVAL_MS) {
        lastSavedAt = performance.now();
        void flush();
      }
    };
    // While a seek is in flight currentTime is already the target, so leaving or
    // quitting right after a seek still saves where the user asked to be.
    const onSeek = () => {
      latest = video.currentTime;
    };
    const onPause = () => {
      latest = video.currentTime;
      void flush();
    };
    const onEnded = () => void flush();
    const onPageHide = () => void flush();

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('seeking', onSeek);
    video.addEventListener('seeked', onSeek);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    window.addEventListener('pagehide', onPageHide);
    const unregisterExitFlush = registerExitFlush(() => {
      latest = video.currentTime;
      return flush();
    });

    return () => {
      unregisterExitFlush();
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('seeking', onSeek);
      video.removeEventListener('seeked', onSeek);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      window.removeEventListener('pagehide', onPageHide);
      void flush();
    };
  }, [video, path]);
}
