// Things that must be saved before the app quits (the resume position, the timer's last
// partial second). Components register a flusher while mounted; the exit dialog awaits them
// all before asking main to verify the password and quit.

type Flusher = () => void | Promise<unknown>;

const flushers = new Set<Flusher>();

/** Returns a function that unregisters the flusher. */
export function registerExitFlush(flusher: Flusher): () => void {
  flushers.add(flusher);
  return () => {
    flushers.delete(flusher);
  };
}

/** Runs every flusher; a failing one never stops the others or the exit. */
export async function flushForExit(): Promise<void> {
  await Promise.all(
    [...flushers].map(async (flusher) => {
      try {
        await flusher();
      } catch {
        /* best effort */
      }
    }),
  );
}
