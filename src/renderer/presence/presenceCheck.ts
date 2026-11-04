// Pure logic of the "Still studying?" check. No DOM, no clock of its own: times are passed in.
// Intervals are measured in *study* time (the session's studyMs), so a check can never come
// up while the video is paused or the window is away.
import type { PresenceConfig } from '../../shared/types';

export type PresenceState =
  | { phase: 'idle' }
  /** Shown; the video keeps playing but the study clock is stopped until a click. */
  | { phase: 'pending'; shownAt: number }
  /** Not answered in time: the video was paused and a miss logged. Still waiting for a click. */
  | { phase: 'missed'; shownAt: number };

export const IDLE_PRESENCE: PresenceState = { phase: 'idle' };

/** The study time (ms) at which the next check is due: a random gap after `afterStudyMs`. */
export function nextDueMs(
  afterStudyMs: number,
  config: Pick<PresenceConfig, 'minMs' | 'maxMs'>,
  random: () => number,
): number {
  return afterStudyMs + Math.round(config.minMs + random() * (config.maxMs - config.minMs));
}

/** A check that was scheduled for later than the (possibly changed) maximum is pulled in. */
export function clampDueMs(dueMs: number, studyMs: number, maxMs: number): number {
  return Math.min(dueMs, studyMs + maxMs);
}

export function isCheckDue(studyMs: number, dueMs: number | null): boolean {
  return dueMs !== null && studyMs >= dueMs;
}

/** Only an idle state can start a check. `now` is a monotonic time (performance.now). */
export function startCheck(state: PresenceState, now: number): PresenceState {
  return state.phase === 'idle' ? { phase: 'pending', shownAt: now } : state;
}

/** After `responseMs` without a click, a pending check becomes a miss (reported once). */
export function advancePresence(
  state: PresenceState,
  now: number,
  responseMs: number,
): { state: PresenceState; missed: boolean } {
  if (state.phase === 'pending' && now - state.shownAt >= responseMs) {
    return { state: { phase: 'missed', shownAt: state.shownAt }, missed: true };
  }
  return { state, missed: false };
}

/** Whole seconds left to answer, for the countdown; null when there is nothing to count down. */
export function secondsToAnswer(state: PresenceState, now: number, responseMs: number): number | null {
  if (state.phase !== 'pending') return null;
  return Math.max(0, Math.ceil((responseMs - (now - state.shownAt)) / 1000));
}

/** Condition 4 of the study timer: no check is pending or failed. */
export function isPresenceOk(state: PresenceState): boolean {
  return state.phase === 'idle';
}
