// Runtime helpers for sessions, shared by main (validation) and renderer (creation).
import type { Session, StudyEvent, StudyEventType } from './types';

const EVENT_TYPES: readonly StudyEventType[] = ['focus_lost', 'presence_missed', 'auth_failed'];

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
