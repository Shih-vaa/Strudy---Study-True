import { useState, type FormEvent } from 'react';
import { checkNewPassword, PASSWORD_MIN_LENGTH } from '../../shared/auth';
import RecoveryKeyDisplay from '../components/RecoveryKeyDisplay';
import { ipcErrorMessage } from '../ipcError';

interface SetupPasswordProps {
  onDone: () => void;
}

/** First run: choose the password that is needed to close Strudy. */
export default function SetupPassword({ onDone }: SetupPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set once the password is saved: the recovery key is shown before moving on.
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const problem = checkNewPassword(password, confirmation);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setRecoveryKey(await window.api.setPassword(password));
    } catch (e) {
      setError(ipcErrorMessage(e, 'Could not save the password.'));
      setBusy(false);
    }
  };

  if (recoveryKey !== null) {
    return (
      <main className="setup">
        <RecoveryKeyDisplay
          recoveryKey={recoveryKey}
          heading="Save your recovery key"
          intro="If the exit password is ever forgotten, this key is the only way to reset it from inside Strudy. Keep it somewhere safe, away from the person using Strudy. It is shown only once."
          continueLabel="Continue"
          onContinue={onDone}
        />
      </main>
    );
  }

  return (
    <main className="setup">
      <form className="setup-card" onSubmit={(event) => void submit(event)}>
        <h1>Set an exit password</h1>
        <p className="setup-lead">
          Strudy stays open until this password is entered. Pick something you will remember: it cannot be
          recovered.
        </p>

        <label className="field">
          Password
          <input
            type="password"
            autoFocus
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="setup-hint"
          />
        </label>
        <label className="field">
          Confirm password
          <input
            type="password"
            autoComplete="off"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>

        <p id="setup-hint" className="field-hint">
          At least {PASSWORD_MIN_LENGTH} characters.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button className="btn primary" type="submit" disabled={busy}>
          Save password
        </button>
      </form>
    </main>
  );
}
