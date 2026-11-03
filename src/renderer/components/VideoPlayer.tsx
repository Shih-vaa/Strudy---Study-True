import { useCallback, useEffect, useState } from 'react';
import { toMediaUrl } from '../../shared/media';
import { usePositionSaver } from '../player/usePositionSaver';

interface VideoPlayerProps {
  path: string;
  /** Where to resume, in seconds (0 = from the start). */
  startAt: number;
  speed: number;
  /** Stable callback receiving the <video> element (null on unmount). */
  onElement: (video: HTMLVideoElement | null) => void;
  onEnded: () => void;
  onToggle: () => void;
}

/** Don't resume into the last few seconds: treat that as "finished". */
const RESUME_END_MARGIN_SECONDS = 3;

/** Render with `key={path}`: one instance per file keeps the element and its path paired. */
export default function VideoPlayer({
  path,
  startAt,
  speed,
  onElement,
  onEnded,
  onToggle,
}: VideoPlayerProps) {
  const [element, setElement] = useState<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);

  const setRef = useCallback(
    (video: HTMLVideoElement | null) => {
      setElement(video);
      onElement(video);
    },
    [onElement],
  );

  usePositionSaver(element, path);

  // A new load resets playbackRate to defaultPlaybackRate, so set both.
  useEffect(() => {
    if (!element) return;
    element.defaultPlaybackRate = speed;
    element.playbackRate = speed;
  }, [element, speed]);

  const handleLoadedMetadata = (video: HTMLVideoElement) => {
    video.defaultPlaybackRate = speed;
    video.playbackRate = speed;
    if (startAt > 0 && startAt < video.duration - RESUME_END_MARGIN_SECONDS) {
      video.currentTime = startAt;
    }
  };

  return (
    <>
      <video
        ref={setRef}
        src={toMediaUrl(path)}
        autoPlay
        preload="auto"
        onLoadedMetadata={(e) => handleLoadedMetadata(e.currentTarget)}
        onEnded={onEnded}
        onError={() => setFailed(true)}
        onClick={onToggle}
      />
      {failed && (
        <div className="video-message" role="alert">
          <p>
            This video can&rsquo;t be played.
            <br />
            The file may be missing, or use a codec this player doesn&rsquo;t support.
          </p>
        </div>
      )}
    </>
  );
}
