import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { flushForExit } from '../state/exitFlush';
import { useSessionStore } from '../state/useSessionStore';
import RecoverPassword from './RecoverPassword';

interface PasswordDialogProps {
  onCancel: () => void;
}

/**
 * Asks for the exit password. The password is checked in the main process only; this just
 * sends it. On success main saves the session and quits, so a successful submit never returns.
 */
export default function PasswordDialog({ onCancel }: PasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || password === '') return;
    setBusy(true);
    setError(null);
    try {
      // Save what is in flight first (resume position, the timer's last second).
      await flushForExit();
      const ok = await window.api.verifyAndQuit(password, useSessionStore.getState().session);
      if (ok) return; // main is quitting; stay in the "closing" state
      useSessionStore.getState().logAuthFailure(Date.now(), 'exit');
      setError('Wrong password.');
    } catch {
      setError('Something went wrong. Try again.');
    }
    setPassword('');
    setBusy(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !busy) onCancel();
  };

  // Escape is not offered while resetting: a new recovery key is shown only once, and it must not
  // be dismissed by accident.
  if (recovering) {
    return (
      <div className="dialog-backdrop">
        <div className="reset-panel">
          <RecoverPassword onDone={() => setRecovering(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="dialog-backdrop">
      <form
        className="password-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-title"
        onSubmit={(event) => void submit(event)}
        onKeyDown={onKeyDown}
      >
        <h2 id="exit-title">Exit Strudy</h2>
        <p className="setup-lead">Enter the exit password to close the app.</p>

        <input
          ref={inputRef}
          type="password"
          autoFocus
          autoComplete="off"
          aria-label="Exit password"
          // readOnly, not disabled: a disabled field cannot take focus back after a wrong try.
          readOnly={busy}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button className="link-button" type="button" disabled={busy} onClick={() => setRecovering(true)}>
          Forgot password?
        </button>

        <div className="dialog-actions">
          <button className="btn" type="button" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button className="btn primary" type="submit" disabled={busy || password === ''}>
            {busy ? 'Closing…' : 'Exit'}
          </button>
        </div>
      </form>
    </div>
  );
}
