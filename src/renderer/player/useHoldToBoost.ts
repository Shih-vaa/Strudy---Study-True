import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createHoldGesture } from './holdGesture';

export interface HoldToBoost {
  /** True while the pointer is held past the threshold. */
  boosting: boolean;
  /** Spread onto the element that should react to the gesture. */
  handlers: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
    onLostPointerCapture: () => void;
  };
}

/**
 * Press-and-hold boosts; a short press calls `onTap`. The hook only reports `boosting`:
 * the caller decides what rate that means, so the user's selected speed is never touched
 * and "restore" is exact by construction.
 */
export function useHoldToBoost(onTap: () => void): HoldToBoost {
  const [boosting, setBoosting] = useState(false);

  const tapRef = useRef(onTap);
  useEffect(() => {
    tapRef.current = onTap;
  });

  const [gesture] = useState(() =>
    createHoldGesture({
      onBoostStart: () => setBoosting(true),
      onBoostEnd: () => setBoosting(false),
      onTap: () => tapRef.current(),
    }),
  );

  useEffect(() => {
    // The mouse-up may never arrive if the window loses focus mid-hold.
    const cancel = () => gesture.cancel();
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('blur', cancel);
      gesture.cancel();
    };
  }, [gesture]);

  return {
    boosting,
    handlers: {
      onPointerDown: (event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        // Capture so the release is seen even if the pointer drifts off the video.
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.press();
      },
      onPointerUp: (event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
        const inside =
          event.clientX >= left && event.clientX <= right && event.clientY >= top && event.clientY <= bottom;
        // Released somewhere else: not a click on the video, but still end any boost.
        if (inside) gesture.release();
        else gesture.cancel();
      },
      onPointerCancel: () => gesture.cancel(),
      onLostPointerCapture: () => gesture.cancel(),
    },
  };
}
