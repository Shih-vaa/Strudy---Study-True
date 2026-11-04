import { useEffect, useRef, useState, type FormEvent } from 'react';
import { checkNewPassword, PASSWORD_MIN_LENGTH } from '../../shared/auth';
import type { Settings as SettingsValues } from '../../shared/types';
import { useSessionStore } from '../state/useSessionStore';

/** Settings can weaken the lock, so they open only with the exit password. */
export default function Settings() {
  const showLibrary = useSessionStore((s) => s.showLibrary);
  const [unlocked, setUnlocked] = useState(false);

  // However this screen is left, lock it again.
  useEffect(
    () => () => {
      void window.api.lockSettings();
    },
    [],
  );

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
    </form>
  );
}

function Options({ onLocked }: { onLocked: () => void }) {
  const [settings, setSettings] = useState<SettingsValues | null>(null);

  useEffect(() => {
    void window.api.getSettings().then(setSettings);
  }, []);

  const change = async (patch: Partial<SettingsValues>) => {
    try {
      setSettings(await window.api.setSettings(patch));
    } catch {
      // The unlock runs out after a few minutes: ask for the password again.
      onLocked();
    }
  };

  if (!settings) return null;

  return (
    <section className="setup-card" aria-label="Options">
      <h2 className="card-title">Focus</h2>
      <label className="check">
        <input
          type="checkbox"
          checked={settings.focusLock}
          onChange={(e) => void change({ focusLock: e.target.checked })}
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
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Could not change the password.' });
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
