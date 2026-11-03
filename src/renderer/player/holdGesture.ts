/** Press and hold longer than this to boost; a shorter press is a tap. */
export const HOLD_THRESHOLD_MS = 250;

export interface HoldGestureHandlers {
  /** The pointer has been held past the threshold. */
  onBoostStart: () => void;
  /** A boost that was running has ended (released or interrupted). */
  onBoostEnd: () => void;
  /** The pointer was pressed and released before the threshold. */
  onTap: () => void;
}

export interface HoldGestureTimers {
  set: (callback: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

const browserTimers: HoldGestureTimers = {
  set: (callback, ms) => globalThis.setTimeout(callback, ms),
  clear: (handle) => globalThis.clearTimeout(handle as number),
};

export interface HoldGesture {
  /** The pointer went down on the video. */
  press: () => void;
  /** The pointer came up on the video: a tap if it was short, otherwise ends the boost. */
  release: () => void;
  /** The gesture was interrupted (pointer left, window blurred, unmounted): never a tap. */
  cancel: () => void;
}

/**
 * Tap vs hold-to-boost. Pure: timing comes from injected timers so it can be tested
 * without a DOM. It never touches playback itself; it only reports what happened.
 */
export function createHoldGesture(
  handlers: HoldGestureHandlers,
  thresholdMs: number = HOLD_THRESHOLD_MS,
  timers: HoldGestureTimers = browserTimers,
): HoldGesture {
  let pressed = false;
  let boosting = false;
  let timer: unknown = null;

  /** Back to idle. Returns whether a boost was running. */
  const reset = (): boolean => {
    if (timer !== null) {
      timers.clear(timer);
      timer = null;
    }
    const wasBoosting = boosting;
    pressed = false;
    boosting = false;
    return wasBoosting;
  };

  return {
    press() {
      if (pressed) return;
      pressed = true;
      timer = timers.set(() => {
        timer = null;
        boosting = true;
        handlers.onBoostStart();
      }, thresholdMs);
    },

    release() {
      if (!pressed) return;
      if (reset()) handlers.onBoostEnd();
      else handlers.onTap();
    },

    cancel() {
      if (!pressed) return;
      if (reset()) handlers.onBoostEnd();
    },
  };
}
