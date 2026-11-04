import { useEffect, useRef, useState, type FormEvent } from 'react';
import { checkNewPassword, PASSWORD_MIN_LENGTH } from '../../shared/auth';
import { PRESENCE_MINUTES_MAX, PRESENCE_MINUTES_MIN } from '../../shared/settings';
import type { Settings as SettingsValues } from '../../shared/types';
import RecoverPassword from '../components/RecoverPassword';
import RecoveryKeyDisplay from '../components/RecoveryKeyDisplay';
import { ipcErrorMessage } from '../ipcError';
import { useSessionStore } from '../state/useSessionStore';

/** Settings can weaken the lock, so they open only with the exit password. */
export default function Settings() {
  const showLibrary = useSessionStore((s) => s.showLibrary);
  const [unlocked, setUnlocked] = useState(false);

  // The screen starts locked, and main must agree: lock on the way in as well as on the way out, so
  // an unlock left over from elsewhere (or from before) can never be inherited.
  useEffect(() => {
    void window.api.lockSettings();
    return () => {
      void window.api.lockSettings();
    };
  }, []);

  return (
    <main className="settings">
      <header className="settings-header">
        <h1>Settings</h1>
        <button className="btn" onClick={showLibrary}>
          {unlocked ? 'Done' : 'Back'}
        </button>
      </header>

      {unlocked ? (
        <>
          <Options onLocked={() => setUnlocked(false)} />
          <ChangePassword />
        </>
      ) : (
        <Unlock onUnlocked={() => setUnlocked(true)} />
      )}
    </main>
  );
}

function Unlock({ onUnlocked }: { onUnlocked: () => void }) {
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
      if (await window.api.unlockSettings(password)) {
        onUnlocked();
        return;
      }
      useSessionStore.getState().logAuthFailure(Date.now(), 'settings');
      setError('Wrong password.');
    } catch {
      setError('Something went wrong. Try again.');
    }
    setPassword('');
    setBusy(false);
    inputRef.current?.focus();
  };

  if (recovering) return <RecoverPassword onDone={() => setRecovering(false)} />;

  return (
    <form className="setup-card" onSubmit={(event) => void submit(event)}>
      <h2 className="card-title">Enter the exit password</h2>
      <p className="setup-lead">Settings can switch off the locks, so they need the exit password.</p>
      <input
        ref={inputRef}
        type="password"
        autoFocus
        autoComplete="off"
        aria-label="Exit password"
        readOnly={busy}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn primary" type="submit" disabled={busy || password === ''}>
        Unlock settings
      </button>
      <button className="link-button" type="button" disabled={busy} onClick={() => setRecovering(true)}>
        Forgot password?
      </button>
    </form>
  );
}

function Options({ onLocked }: { onLocked: () => void }) {
  const [settings, setSettings] = useState<SettingsValues | null>(null);

  useEffect(() => {
    void window.api.getSettings().then(setSettings);
  }, []);

  /** Saves a change. Returns an error message, or null on success. */
  const save = async (patch: Partial<SettingsValues>): Promise<string | null> => {
    try {
      setSettings(await window.api.setSettings(patch));
      return null;
    } catch (e) {
      const message = ipcErrorMessage(e);
      if (/locked/i.test(message)) {
        // The unlock runs out after a few minutes: ask for the password again.
        onLocked();
        return null;
      }
      return message;
    }
  };

  if (!settings) return null;

  return (
    <>
      <section className="setup-card" aria-label="Focus">
        <h2 className="card-title">Focus</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.focusLock}
            onChange={(e) => void save({ focusLock: e.target.checked })}
          />
          <span>
            Bring Strudy back to the front when I leave it
            <small>
              When off, leaving still pauses the video, stops the clock and is logged. Strudy just does not
              pull itself back.
            </small>
          </span>
        </label>
      </section>

      <PresenceRange settings={settings} save={save} />
      <RecoveryKeyCard onLocked={onLocked} />
    </>
  );
}

function PresenceRange({
  settings,
  save,
}: {
  settings: SettingsValues;
  save: (patch: Partial<SettingsValues>) => Promise<string | null>;
}) {
  const [min, setMin] = useState(String(settings.presenceMinMinutes));
  const [max, setMax] = useState(String(settings.presenceMaxMinutes));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // Both ends go together, so the pair is checked as a whole.
    const error = await save({ presenceMinMinutes: Number(min), presenceMaxMinutes: Number(max) });
    setMessage(error ? { ok: false, text: error } : { ok: true, text: 'Saved.' });
  };

  return (
    <form className="setup-card" onSubmit={(event) => void submit(event)}>
      <h2 className="card-title">Still studying? checks</h2>
      <p className="setup-lead">
        Every so often Strudy asks &ldquo;Still studying?&rdquo;. If nobody clicks within 30 seconds, the video
        pauses and it is logged. Choose how many minutes of studying pass between checks; the gap is a random
        time in this range.
      </p>
      <div className="range-row">
        <label className="field">
          Shortest (minutes)
          <input
            type="number"
            min={PRESENCE_MINUTES_MIN}
            max={PRESENCE_MINUTES_MAX}
            step={1}
            value={min}
            onChange={(e) => setMin(e.target.value)}
          />
        </label>
        <label className="field">
          Longest (minutes)
          <input
            type="number"
            min={PRESENCE_MINUTES_MIN}
            max={PRESENCE_MINUTES_MAX}
            step={1}
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </label>
      </div>
      {message && (
        <p className={message.ok ? 'form-ok' : 'form-error'} role="alert">
          {message.text}
        </p>
      )}
      <button className="btn primary" type="submit">
        Save
      </button>
    </form>
  );
}

function RecoveryKeyCard({ onLocked }: { onLocked: () => void }) {
  const [has, setHas] = useState<boolean | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The unlock may have run out while this screen was open.
    window.api.hasRecoveryKey().then(setHas, onLocked);
  }, [onLocked]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      setNewKey(await window.api.newRecoveryKey());
    } catch (e) {
      const message = ipcErrorMessage(e);
      if (/locked/i.test(message)) onLocked();
      else setError(message);
    }
    setBusy(false);
  };

  if (newKey !== null) {
    return (
      <RecoveryKeyDisplay
        recoveryKey={newKey}
        heading="Your new recovery key"
        intro="Any earlier recovery key no longer works. Keep this one somewhere safe, away from the person using Strudy. It is shown only once."
        continueLabel="Done"
        onContinue={() => {
          setNewKey(null);
          setHas(true);
        }}
      />
    );
  }

  if (has === null) return null;

  return (
    <section className="setup-card" aria-label="Recovery key">
      <h2 className="card-title">Recovery key</h2>
      <p className="setup-lead">
        If the exit password is forgotten, the recovery key resets it: choose <strong>Forgot password?</strong> on
        the exit box. Anyone who holds the key can reset the password, so treat it like the password itself.
      </p>
      <p className={has ? 'form-ok' : 'form-error'}>
        {has ? 'A recovery key is set.' : 'No recovery key has been created yet.'}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn" type="button" disabled={busy} onClick={() => void create()}>
        {has ? 'Create a new recovery key' : 'Create a recovery key'}
      </button>
      {has && <p className="field-hint">Making a new key stops the old one working.</p>}
    </section>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const problem = checkNewPassword(next, confirmation);
    if (problem) {
      setMessage({ ok: false, text: problem });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      if (await window.api.changePassword(current, next)) {
        setCurrent('');
        setNext('');
        setConfirmation('');
        setMessage({ ok: true, text: 'Password changed.' });
      } else {
        useSessionStore.getState().logAuthFailure(Date.now(), 'change-password');
        setMessage({ ok: false, text: 'The current password is wrong.' });
      }
    } catch (e) {
      setMessage({ ok: false, text: ipcErrorMessage(e, 'Could not change the password.') });
    }
    setBusy(false);
  };

  return (
    <form className="setup-card" onSubmit={(event) => void submit(event)}>
      <h2 className="card-title">Change the exit password</h2>
      <label className="field">
        Current password
        <input type="password" autoComplete="off" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className="field">
        New password
        <input type="password" autoComplete="off" value={next} onChange={(e) => setNext(e.target.value)} />
      </label>
      <label className="field">
        Confirm new password
        <input
          type="password"
          autoComplete="off"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
      </label>
      <p className="field-hint">At least {PASSWORD_MIN_LENGTH} characters.</p>
      {message && (
        <p className={message.ok ? 'form-ok' : 'form-error'} role="alert">
          {message.text}
        </p>
      )}
      <button className="btn primary" type="submit" disabled={busy || current === ''}>
        Change password
      </button>
    </form>
  );
}
