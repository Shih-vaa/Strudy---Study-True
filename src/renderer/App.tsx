import Library from './screens/Library';
import Player from './screens/Player';
import { useSessionStore } from './state/useSessionStore';

export default function App() {
  const screen = useSessionStore((s) => s.screen);
  return screen === 'player' ? <Player /> : <Library />;
}
