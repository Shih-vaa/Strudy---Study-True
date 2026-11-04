import { useState } from 'react';

interface RecoveryKeyDisplayProps {
  recoveryKey: string;
  heading: string;
  intro: string;
  continueLabel: string;
  onContinue: () => void;
}

/**
 * Shows a recovery key once. It cannot be shown again (only a scrambled copy is kept), so the
 * way on is blocked until the person confirms they have saved it.
 */
export default function RecoveryKeyDisplay({
  recoveryKey,
  heading,
  intro,
  continueLabel,
  onContinue,
}: RecoveryKeyDisplayProps) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
    } catch {
      setCopied(false); // no clipboard: the key is on screen to write down
    }
  };

  return (
    <div className="setup-card">
      <h2 className="card-heading">{heading}</h2>
      <p className="setup-lead">{intro}</p>
      <div className="recovery-key" role="group" aria-label="Recovery key">
        {recoveryKey}
      </div>
      <button className="btn" type="button" onClick={() => void copy()}>
        {copied ? 'Copied' : 'Copy'}
      </button>
      <label className="check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>I have saved this recovery key somewhere safe</span>
      </label>
      <button className="btn primary" type="button" disabled={!saved} onClick={onContinue}>
        {continueLabel}
      </button>
    </div>
  );
}
