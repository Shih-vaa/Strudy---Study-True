import type { CSSProperties } from 'react';
import { SKIP_SECONDS } from '../player/actions';
import { formatTime } from '../player/format';
import { formatSpeed, SPEEDS } from '../player/speed';
import type { PlaybackState } from '../player/usePlayback';

interface ControlsProps {
  playback: PlaybackState;
  speed: number;
  disabled: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  onTogglePlay: () => void;
  onSkip: (seconds: number) => void;
  onRestart: () => void;
  onSeek: (seconds: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSpeedChange: (speed: number) => void;
}

export default function Controls({
  playback,
  speed,
  disabled,
  hasPrevious,
  hasNext,
  onTogglePlay,
  onSkip,
  onRestart,
  onSeek,
  onPrevious,
  onNext,
  onSpeedChange,
}: ControlsProps) {
  const { currentTime, duration, paused } = playback;
  const shown = Math.min(currentTime, duration);
  const progress = duration > 0 ? (shown / duration) * 100 : 0;

  return (
    <div className="controls">
      <div className="controls-row">
        <input
          type="range"
          className="seek"
          aria-label="Seek"
          min={0}
          max={duration}
          step={0.1}
          value={shown}
          disabled={disabled || duration === 0}
          style={{ '--progress': `${progress}%` } as CSSProperties}
          onChange={(e) => onSeek(Number(e.target.value))}
          onPointerUp={(e) => e.currentTarget.blur()}
        />
        <span className="time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <div className="controls-row">
        <button className="btn" disabled={!hasPrevious} onClick={onPrevious}>
          Prev
        </button>
        <button className="btn" disabled={disabled} onClick={() => onSkip(-SKIP_SECONDS)}>
          &minus;{SKIP_SECONDS}s
        </button>
        <button className="btn primary play" disabled={disabled} onClick={onTogglePlay}>
          {paused ? 'Play' : 'Pause'}
        </button>
        <button className="btn" disabled={disabled} onClick={() => onSkip(SKIP_SECONDS)}>
          +{SKIP_SECONDS}s
        </button>
        <button className="btn" disabled={!hasNext} onClick={onNext}>
          Next
        </button>
        <button className="btn" disabled={disabled} onClick={onRestart}>
          Replay
        </button>

        <label className="speed">
          Speed
          <select
            value={speed}
            aria-label="Playback speed"
            onChange={(e) => {
              onSpeedChange(Number(e.target.value));
              e.currentTarget.blur();
            }}
          >
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {formatSpeed(value)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
