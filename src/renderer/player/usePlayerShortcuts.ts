import { useEffect } from 'react';
import { useSessionStore } from '../state/useSessionStore';
import { restart, SKIP_SECONDS, skip, togglePlay } from './actions';

/** Space = play/pause, Left/Right = -/+10s, Up/Down = speed step, R = replay. */
export function usePlayerShortcuts(video: HTMLVideoElement | null): void {
  useEffect(() => {
    if (!video) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      let handled = true;
      switch (event.key.toLowerCase()) {
        case ' ':
          if (!event.repeat) togglePlay(video);
          break;
        case 'arrowleft':
          skip(video, -SKIP_SECONDS);
          break;
        case 'arrowright':
          skip(video, SKIP_SECONDS);
          break;
        case 'arrowup':
          useSessionStore.getState().stepSpeed(1);
          break;
        case 'arrowdown':
          useSessionStore.getState().stepSpeed(-1);
          break;
        case 'r':
          if (!event.repeat) restart(video);
          break;
        default:
          handled = false;
      }
      if (!handled) return;

      event.preventDefault();
      // A focused button/select/slider would otherwise react to the same key too.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    };

    // Space "clicks" a focused button on keyup in some engines; swallow it.
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ') event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [video]);
}
