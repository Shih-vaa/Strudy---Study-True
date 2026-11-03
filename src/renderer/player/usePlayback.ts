import { useEffect, useState } from 'react';

export interface PlaybackState {
  currentTime: number;
  duration: number;
  paused: boolean;
}

const IDLE: PlaybackState = { currentTime: 0, duration: 0, paused: true };

const EVENTS = [
  'timeupdate',
  'seeking',
  'seeked',
  'durationchange',
  'loadedmetadata',
  'play',
  'pause',
  'ended',
  'emptied',
] as const;

/** Mirrors a <video> element's playback state into React state. */
export function usePlayback(video: HTMLVideoElement | null): PlaybackState {
  const [state, setState] = useState<PlaybackState>(IDLE);

  useEffect(() => {
    if (!video) {
      setState(IDLE);
      return;
    }
    const sync = () =>
      setState({
        currentTime: video.currentTime,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        paused: video.paused,
      });
    sync();
    for (const name of EVENTS) video.addEventListener(name, sync);
    return () => {
      for (const name of EVENTS) video.removeEventListener(name, sync);
    };
  }, [video]);

  return state;
}
