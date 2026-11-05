// Runtime helpers for sessions, shared by main (validation) and renderer (creation).
import type { Session, StudyEvent, StudyEventType } from './types';

const EVENT_TYPES: readonly StudyEventType[] = [
  'focus_lost',
  'presence_missed',
  'auth_failed',
  'password_reset',
  'person_away',
  'person_returned',
  'camera_unavailable',
];

export function createSession(id: string, startedAt: number): Session {
  return {
    id,
    startedAt,
    endedAt: null,
    studyMs: 0,
    videosWatched: [],
    focusLostCount: 0,
    presenceMissedCount: 0,
    pauseCount: 0,
    events: [],
  };
}

/**
 * Inserts the session, or replaces the stored one with the same id (sessions autosave over
 * and over). A session that has ended stays ended: a stale, still-open copy, such as an
 * autosave landing while the app is closing, never reopens it.
 */
export function upsertSession(sessions: readonly Session[], incoming: Session): Session[] {
  const index = sessions.findIndex((s) => s.id === incoming.id);
  if (index === -1) return [...sessions, incoming];
  const existing = sessions[index];
  if (existing && existing.endedAt !== null && incoming.endedAt === null) return [...sessions];
  return sessions.map((s, i) => (i === index ? incoming : s));
}

/** "Still studying?" went unanswered: count it and log a presence_missed event. */
export function recordPresenceMissed(session: Session, at: number): Session {
  return {
    ...session,
    presenceMissedCount: session.presenceMissedCount + 1,
    events: [...session.events, { type: 'presence_missed', timestamp: at }],
  };
}

/** The exit password was reset with the recovery key: the owner should be able to see that. */
export function recordPasswordReset(session: Session, at: number): Session {
  return { ...session, events: [...session.events, { type: 'password_reset', timestamp: at }] };
}

/** Logs a wrong password attempt; `detail` says where it was typed (exit, settings...). */
export function recordAuthFailed(session: Session, at: number, detail?: string): Session {
  const event: StudyEvent =
    detail === undefined
      ? { type: 'auth_failed', timestamp: at }
      : { type: 'auth_failed', timestamp: at, detail };
  return { ...session, events: [...session.events, event] };
}

/** 52_000 -> "52 s", 192_000 -> "3 min 12 s", 3_720_000 -> "1 h 2 min". */
export function formatSpan(ms: number): string {
  const total = Number.isFinite(ms) ? Math.max(0, Math.round(ms / 1000)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min ${seconds} s`;
  return `${seconds} s`;
}

/** The camera check saw no one for longer than the grace period, so the study clock stopped. */
export function recordPersonAway(session: Session, at: number, absentMs: number): Session {
  const detail = `no one seen for ${formatSpan(absentMs)}`;
  return { ...session, events: [...session.events, { type: 'person_away', timestamp: at, detail }] };
}

/** Someone is in front of the camera again; `awayMs` is how long the camera check saw no one. */
export function recordPersonReturned(session: Session, at: number, awayMs: number): Session {
  const detail = `away for ${formatSpan(awayMs)}`;
  return { ...session, events: [...session.events, { type: 'person_returned', timestamp: at, detail }] };
}

/** The camera check is on, but the camera could not be used; `reason` says why. */
export function recordCameraUnavailable(session: Session, at: number, reason: string): Session {
  return { ...session, events: [...session.events, { type: 'camera_unavailable', timestamp: at, detail: reason }] };
}

const isTime = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isCount = (value: unknown): value is number => isTime(value) && Number.isInteger(value);

function isStudyEvent(value: unknown): value is StudyEvent {
  if (typeof value !== 'object' || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    EVENT_TYPES.includes(event.type as StudyEventType) &&
    isTime(event.timestamp) &&
    (event.detail === undefined || typeof event.detail === 'string')
  );
}

/** Runtime check for data arriving over IPC, where the static types cannot be trusted. */
export function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    s.id.length > 0 &&
    isTime(s.startedAt) &&
    (s.endedAt === null || isTime(s.endedAt)) &&
    isTime(s.studyMs) &&
    Array.isArray(s.videosWatched) &&
    s.videosWatched.every((v) => typeof v === 'string') &&
    isCount(s.focusLostCount) &&
    isCount(s.presenceMissedCount) &&
    isCount(s.pauseCount) &&
    Array.isArray(s.events) &&
    s.events.every(isStudyEvent)
  );
}
