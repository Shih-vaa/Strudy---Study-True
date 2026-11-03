import { useEffect } from 'react';
import { useSessionStore } from '../state/useSessionStore';

/** Mirrors the machine's sleep/lock state (from Electron's powerMonitor) into the store. */
export function usePowerState(): void {
  useEffect(() => {
    const { setSystemActive } = useSessionStore.getState();
    const offSuspend = window.api.onEvent('power:suspend', () => setSystemActive(false));
    const offResume = window.api.onEvent('power:resume', () => setSystemActive(true));
    return () => {
      offSuspend();
      offResume();
    };
  }, []);
}
