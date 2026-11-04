// Pure maths for the Summary screen: today's totals, the 7-day chart, the session list.
// A session counts toward the local day it started on, the same rule as the clock's "Today".
import { upsertSession } from '../../shared/session';
import type { Session, StudyEvent } from '../../shared/types';
import { startOfLocalDay } from '../timer/clock';

export interface DaySummary {
  /** Local midnight of the day, epoch ms. */
  dayStart: number;
  studyMs: number;
  sessions: number;
  focusLost: number;
  presenceMissed: number;
}

export function summarizeDay(sessions: readonly Session[], dayStart: number): DaySummary {
  const summary: DaySummary = { dayStart, studyMs: 0, sessions: 0, focusLost: 0, presenceMissed: 0 };
  for (const s of sessions) {
    if (startOfLocalDay(s.startedAt) !== dayStart) continue;
    summary.studyMs += s.studyMs;
    summary.sessions += 1;
    summary.focusLost += s.focusLostCount;
    summary.presenceMissed += s.presenceMissedCount;
  }
  return summary;
}

/** The last `days` days, oldest first, ending with today. Days with no sessions are zeros. */
export function lastDays(sessions: readonly Session[], nowMs: number, days = 7): DaySummary[] {
  const today = startOfLocalDay(nowMs);
  const result: DaySummary[] = [];
  for (let back = days - 1; back >= 0; back--) {
    const day = new Date(today);
    day.setDate(day.getDate() - back);
    result.push(summarizeDay(sessions, startOfLocalDay(day.getTime())));
  }
  return result;
}

/** The stored sessions with the running one (which is newer than its last save) swapped in. */
export function withCurrentSession(stored: readonly Session[], current: Session | null): Session[] {
  return current ? upsertSession(stored, current) : [...stored];
}

export interface SessionRow {
  id: string;
  startedAt: number;
  endedAt: number | null;
  studyMs: number;
  videoCount: number;
  focusLost: number;
  presenceMissed: number;
  events: StudyEvent[];
  /** This is the session in progress right now, so it has not ended yet. */
  running: boolean;
}

/** Newest first. */
export function sessionRows(sessions: readonly Session[], runningId: string | null): SessionRow[] {
  return [...sessions]
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      studyMs: s.studyMs,
      videoCount: s.videosWatched.length,
      focusLost: s.focusLostCount,
      presenceMissed: s.presenceMissedCount,
      events: s.events,
      running: s.id === runningId,
    }));
}

/**
 * Bar heights for the chart, proportional to the values. The scale is at least `minScale`, so a
 * few minutes does not fill the whole chart; any non-zero value gets a visible sliver.
 */
export function barHeights(values: readonly number[], maxHeight: number, minScale: number): number[] {
  const scale = Math.max(minScale, ...values, 1);
  return values.map((value) => (value <= 0 ? 0 : Math.max(2, (value / scale) * maxHeight)));
}

/** 3_720_000 -> "1 h 2 min", 720_000 -> "12 min", 42_000 -> "42 s". */
export function formatStudyTime(ms: number): string {
  const totalSeconds = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min`;
  return `${totalSeconds % 60} s`;
}

export function wholeMinutes(ms: number): number {
  return Math.round(Math.max(0, ms) / 60_000);
}
