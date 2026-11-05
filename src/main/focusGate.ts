// A counter for "a macOS system prompt that Strudy itself opened is up". While one is, the window
// losing focus is the prompt taking it, not the person leaving, so it must not be reported as
// leaving. Pure, so it can be tested without Electron.

export interface FocusGate {
  /** True while at least one prompt is open. */
  readonly held: boolean;
  /**
   * A prompt opens. Returns a function to call when it closes (calling it twice does nothing); that
   * function says whether this was the last open prompt.
   */
  hold: () => () => boolean;
}

export function createFocusGate(): FocusGate {
  let open = 0;
  return {
    get held() {
      return open > 0;
    },
    hold() {
      open += 1;
      let released = false;
      return () => {
        if (released) return false;
        released = true;
        open -= 1;
        return open === 0;
      };
    },
  };
}
