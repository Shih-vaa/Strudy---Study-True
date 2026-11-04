interface PresenceModalProps {
  phase: 'pending' | 'missed';
  /** Seconds left before the video pauses; only while pending. */
  secondsLeft: number | null;
  onAnswer: () => void;
}

/** "Still studying?" The video keeps playing behind it until the time runs out. */
export default function PresenceModal({ phase, secondsLeft, onAnswer }: PresenceModalProps) {
  return (
    <div className="presence-backdrop">
      <div className="presence-modal" role="alertdialog" aria-modal="true" aria-labelledby="presence-title">
        <h2 id="presence-title">Still studying?</h2>
        <p>
          {phase === 'missed'
            ? 'There was no answer, so your video was paused. Click to continue.'
            : 'Click to continue.'}
        </p>
        {phase === 'pending' && secondsLeft !== null && (
          <p className="presence-countdown">The video pauses in {secondsLeft}s</p>
        )}
        <button className="btn primary" autoFocus onClick={onAnswer}>
          I&rsquo;m still studying
        </button>
      </div>
    </div>
  );
}
