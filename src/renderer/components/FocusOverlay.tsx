import { formatTime } from '../player/format';

interface FocusOverlayProps {
  /** How long the window was away; null while it still is. */
  awaySeconds: number | null;
  onDismiss: () => void;
}

/** Covers the whole window until acknowledged, so nothing is used behind it. */
export default function FocusOverlay({ awaySeconds, onDismiss }: FocusOverlayProps) {
  return (
    <div className="focus-overlay" role="alertdialog" aria-modal="true" aria-labelledby="focus-overlay-title">
      <h2 id="focus-overlay-title">Come back to study</h2>
      <p>
        {awaySeconds === null
          ? 'Your video was paused because you left Strudy.'
          : `You were away for ${formatTime(awaySeconds)}.`}
      </p>
      <button className="btn primary" autoFocus onClick={onDismiss}>
        Resume studying
      </button>
    </div>
  );
}
