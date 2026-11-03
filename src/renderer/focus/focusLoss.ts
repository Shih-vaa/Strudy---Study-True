import type { Session } from '../../shared/types';

/** One stretch of the window being away; `returnedAt` is null while it still is. */
export interface FocusLoss {
  lostAt: number;
  returnedAt: number | null;
}

/** Counts the loss and logs a focus_lost event stamped with when it happened. */
export function recordFocusLost(session: Session, at: number): Session {
  return {
    ...session,
    focusLostCount: session.focusLostCount + 1,
    events: [...session.events, { type: 'focus_lost', timestamp: at }],
  };
}

export function awaySeconds(loss: FocusLoss): number | null {
  if (loss.returnedAt === null) return null;
  return Math.max(0, Math.round((loss.returnedAt - loss.lostAt) / 1000));
}

/** When focus comes back, note how long it was away on the matching focus_lost event. */
export function recordFocusReturned(session: Session, loss: FocusLoss): Session {
  const seconds = awaySeconds(loss);
  if (seconds === null) return session;
  let index = -1;
  for (let i = session.events.length - 1; i >= 0; i--) {
    const event = session.events[i];
    if (event && event.type === 'focus_lost' && event.timestamp === loss.lostAt) {
      index = i;
      break;
    }
  }
  if (index === -1) return session;
  return {
    ...session,
    events: session.events.map((event, i) => (i === index ? { ...event, detail: `away ${seconds}s` } : event)),
  };
}
