import { useState, type FormEvent } from 'react';
import { checkNewPassword, PASSWORD_MIN_LENGTH } from '../../shared/auth';
import { ipcErrorMessage } from '../ipcError';
import { useSessionStore } from '../state/useSessionStore';
import RecoveryKeyDisplay from './RecoveryKeyDisplay';

interface RecoverPasswordProps {
  /** Called when the person is finished: after saving the new key, or on Back. */
  onDone: () => void;
}

/** "Forgot password?": the recovery key plus a new password. The key is checked in main. */
export default function RecoverPassword({ onDone }: RecoverPasswordProps) {
  const [key, setKey] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  if (newKey !== null) {
    return (
      <RecoveryKeyDisplay
        recoveryKey={newKey}
        heading="Password reset"
        intro="The exit password has been changed. This is your new recovery key: the old one no longer works. It is shown only once."
        continueLabel="Done"
        onContinue={onDone}
      />
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const problem = checkNewPassword(next, confirmation);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fresh = await window.api.recoverPassword(key, next);
      if (fresh === null) {
        useSessionStore.getState().logAuthFailure(Date.now(), 'recovery');
        setError('That recovery key is not right.');
      } else {
        useSessionStore.getState().logPasswordReset(Date.now());
        setNewKey(fresh);
      }
    } catch (e) {
      setError(ipcErrorMessage(e, 'Could not reset the password.'));
    }
    setBusy(false);
  };

  return (
    <form className="setup-card" onSubmit={(event) => void submit(event)}>
      <h2 className="card-heading">Reset the exit password</h2>
      <p className="setup-lead">
        Enter the recovery key you saved when the password was set up, then choose a new password.
      </p>
      <label className="field">
        Recovery key
        <input
          className="key-input"
          type="text"
          autoFocus
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
          value={key}
          readOnly={busy}
          onChange={(e) => setKey(e.target.value)}
        />
      </label>
      <label className="field">
        New password
        <input type="password" autoComplete="off" value={next} readOnly={busy} onChange={(e) => setNext(e.target.value)} />
      </label>
      <label className="field">
        Confirm new password
        <input
          type="password"
          autoComplete="off"
          value={confirmation}
          readOnly={busy}
          onChange={(e) => setConfirmation(e.target.value)}
        />
      </label>
      <p className="field-hint">At least {PASSWORD_MIN_LENGTH} characters.</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button className="btn" type="button" disabled={busy} onClick={onDone}>
          Back
        </button>
        <button className="btn primary" type="submit" disabled={busy || key.trim() === ''}>
          Reset password
        </button>
      </div>
    </form>
  );
}
