import type { Session } from '../../shared/types';

/** 3_725_000 -> "01:02:05". Always HH:MM:SS; negative or non-finite input reads as zero. */
export function formatClock(ms: number): string {
  const totalSeconds = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

export function startOfLocalDay(epochMs: number): number {
  const date = new Date(epochMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Study time already recorded today by sessions other than `excludeId`. A session counts
 * toward the local day it started on.
 */
export function todayStudyMs(sessions: readonly Session[], nowMs: number, excludeId?: string): number {
  const today = startOfLocalDay(nowMs);
  return sessions
    .filter((s) => s.id !== excludeId && startOfLocalDay(s.startedAt) === today)
    .reduce((total, s) => total + s.studyMs, 0);
}
