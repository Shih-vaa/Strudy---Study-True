import Library from './screens/Library';
import Player from './screens/Player';
import { useSessionStore } from './state/useSessionStore';
import { usePowerState } from './timer/usePowerState';
import { useSessionPersistence } from './timer/useSessionPersistence';

export default function App() {
  const screen = useSessionStore((s) => s.screen);
  usePowerState();
  useSessionPersistence();
  return screen === 'player' ? <Player /> : <Library />;
}
