import { useEffect, useRef } from 'react';
import type { CameraUi } from '../camera/useCameraPresence';

/**
 * The always-visible side of the camera check: a small live picture of what the camera sees, a
 * line saying what it is doing, and a banner when the clock has stopped because no one is there
 * or the camera cannot be used. Nothing here is recorded.
 */
export default function CameraPanel({ ui }: { ui: CameraUi }) {
  const preview = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (preview.current) preview.current.srcObject = ui.stream;
  }, [ui.stream]);

  const trouble =
    ui.missing === 'eyes_closed' ? 'Eyes closed' : ui.missing === 'looking_away' ? 'Looking away' : 'Can’t see you';
  const status =
    ui.phase === 'starting'
      ? 'Starting the camera…'
      : ui.phase === 'present'
        ? ui.graceLeft === null
          ? 'Camera on'
          : `${trouble}. The clock stops in ${ui.graceLeft} s`
        : ui.phase === 'away'
          ? ui.missing === 'eyes_closed'
            ? 'Eyes closed'
            : ui.missing === 'looking_away'
              ? 'Looking away'
              : 'No one in view'
          : 'Camera unavailable';
  const tone = ui.phase === 'present' && ui.graceLeft === null ? 'ok' : ui.phase === 'starting' || ui.phase === 'present' ? 'warn' : 'bad';

  return (
    <>
      <div className="camera-panel" data-tone={tone} role="status" aria-live="polite">
        <video ref={preview} className="camera-preview" autoPlay muted playsInline aria-label="What the camera sees" />
        <span className="camera-status">
          <span className="camera-dot" aria-hidden="true" />
          {status}
        </span>
        <span className="camera-note">Nothing is recorded</span>
      </div>

      {ui.phase === 'away' && (
        <div className="camera-banner" role="alert">
          {ui.missing === 'eyes_closed'
            ? 'Your eyes have been closed for a while.'
            : ui.missing === 'looking_away'
              ? 'You are looking away from the screen.'
              : 'No one in front of the camera.'}{' '}
          The study clock is stopped and the video is paused. It carries on when{' '}
          {ui.missing === 'eyes_closed' ? 'you open your eyes' : ui.missing === 'looking_away' ? 'you look back' : 'you are back'}.
        </div>
      )}
      {ui.phase === 'unavailable' && (
        <div className="camera-banner" role="alert">
          {ui.reason ?? 'The camera could not be used.'} The study clock is stopped until the camera works.
        </div>
      )}
    </>
  );
}
