import { useEffect, useState } from 'react';
import PasswordDialog from './components/PasswordDialog';
import Library from './screens/Library';
import Player from './screens/Player';
import SetupPassword from './screens/SetupPassword';
import { useSessionStore } from './state/useSessionStore';
import { usePowerState } from './timer/usePowerState';
import { useSessionPersistence } from './timer/useSessionPersistence';

type AuthState = 'loading' | 'setup' | 'ready';

export default function App() {
  const screen = useSessionStore((s) => s.screen);
  const exitDialogOpen = useSessionStore((s) => s.exitDialogOpen);
  const closeExitDialog = useSessionStore((s) => s.closeExitDialog);
  const [auth, setAuth] = useState<AuthState>('loading');

  usePowerState();
  useSessionPersistence();

  useEffect(() => {
    void window.api.isPasswordSet().then((isSet) => setAuth(isSet ? 'ready' : 'setup'));
  }, []);

  // A close, Cmd+Q or Alt+F4 was blocked in main: ask for the password instead.
  useEffect(
    () => window.api.onEvent('app:exit-requested', () => useSessionStore.getState().openExitDialog()),
    [],
  );

  if (auth === 'loading') return null;
  if (auth === 'setup') return <SetupPassword onDone={() => setAuth('ready')} />;

  return (
    <>
      {/* inert: nothing behind the dialog can be focused or clicked while it is open */}
      <div className="app-root" inert={exitDialogOpen}>
        {screen === 'player' ? <Player /> : <Library />}
      </div>
      {exitDialogOpen && <PasswordDialog onCancel={closeExitDialog} />}
    </>
  );
}
