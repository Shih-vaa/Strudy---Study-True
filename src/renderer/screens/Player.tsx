import { useEffect, useState } from 'react';
import Controls from '../components/Controls';
import FocusOverlay from '../components/FocusOverlay';
import PresenceModal from '../components/PresenceModal';
import StudyClock from '../components/StudyClock';
import VideoPlayer from '../components/VideoPlayer';
import { useFocusLock } from '../focus/useFocusLock';
import { restart, skip, togglePlay } from '../player/actions';
import { baseName } from '../player/format';
import { usePresenceCheck } from '../presence/usePresenceCheck';
import { usePlayback } from '../player/usePlayback';
import { usePlayerShortcuts } from '../player/usePlayerShortcuts';
import { useSessionStore } from '../state/useSessionStore';

export default function Player() {
  const playlist = useSessionStore((s) => s.playlist);
  const index = useSessionStore((s) => s.index);
  const speed = useSessionStore((s) => s.speed);
  const next = useSessionStore((s) => s.next);
  const previous = useSessionStore((s) => s.previous);
  const setSpeed = useSessionStore((s) => s.setSpeed);
  const showLibrary = useSessionStore((s) => s.showLibrary);
  const openExitDialog = useSessionStore((s) => s.openExitDialog);

  const path = playlist[index];
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  // Tagged with its path so a stale value is never applied to the next video.
  const [resume, setResume] = useState<{ path: string; seconds: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.api.getPosition(path).then((seconds) => {
      if (!cancelled) setResume({ path, seconds });
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  const playback = usePlayback(video);
  usePlayerShortcuts(video);
  const focus = useFocusLock(video);
  const presence = usePresenceCheck(video);

  const ready = video !== null;

  return (
    <div className="player">
      <header className="player-bar">
        <button className="btn" onClick={showLibrary}>
          &larr; Library
        </button>
        <span className="player-title" title={path}>
          {baseName(path)}
        </span>
        <StudyClock />
        <span className="player-count">
          {index + 1} / {playlist.length}
        </span>
        <button className="btn" onClick={openExitDialog}>
          Exit
        </button>
      </header>

      <div className="player-stage">
        {resume?.path === path && (
          <VideoPlayer
            key={path}
            path={path}
            startAt={resume.seconds}
            speed={speed}
            onElement={setVideo}
            onEnded={next}
            onToggle={() => video && togglePlay(video)}
          />
        )}
      </div>

      <Controls
        playback={playback}
        speed={speed}
        disabled={!ready}
        hasPrevious={index > 0}
        hasNext={index + 1 < playlist.length}
        onTogglePlay={() => video && togglePlay(video)}
        onSkip={(seconds) => video && skip(video, seconds)}
        onRestart={() => video && restart(video)}
        onSeek={(seconds) => {
          if (video) video.currentTime = seconds;
        }}
        onPrevious={previous}
        onNext={next}
        onSpeedChange={setSpeed}
      />

      {presence.phase !== 'idle' && (
        <PresenceModal phase={presence.phase} secondsLeft={presence.secondsLeft} onAnswer={presence.answer} />
      )}

      {focus.overlayVisible && <FocusOverlay awaySeconds={focus.awaySeconds} onDismiss={focus.dismiss} />}
    </div>
  );
}
