// Builds the sessions CSV. Pure, so main can use it and it can be tested without a file or a dialog.
import type { Session, StudyEvent } from './types';

/** Text that spreadsheets would treat as a formula if it starts with one of these. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * One CSV field. Text is quoted when it needs to be, and text that starts like a formula gets a
 * leading ' so opening the file in a spreadsheet can never run it (a video could be named "=...").
 */
export function csvField(value: string | number | null): string {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Local time as "2026-11-04 09:05:00", which spreadsheets read as a date and time. */
export function formatLocalDateTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const fileName = (path: string): string => path.split(/[\\/]/).pop() ?? path;

function eventText(event: StudyEvent): string {
  const detail = event.detail ? ` (${event.detail})` : '';
  return `${event.type} ${formatLocalDateTime(event.timestamp)}${detail}`;
}

export const CSV_COLUMNS = [
  'session_id',
  'started_at',
  'ended_at',
  'study_seconds',
  'study_minutes',
  'videos_watched',
  'video_files',
  'focus_lost_count',
  'presence_missed_count',
  'events',
] as const;

/** One row per session, oldest first. An empty ended_at means it never ended properly. */
export function sessionsToCsv(sessions: readonly Session[]): string {
  const rows = [...sessions]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) =>
      [
        csvField(s.id),
        csvField(formatLocalDateTime(s.startedAt)),
        csvField(s.endedAt === null ? null : formatLocalDateTime(s.endedAt)),
        csvField(Math.round(s.studyMs / 1000)),
        csvField(Math.round(s.studyMs / 6000) / 10),
        csvField(s.videosWatched.length),
        csvField(s.videosWatched.map(fileName).join(' | ')),
        csvField(s.focusLostCount),
        csvField(s.presenceMissedCount),
        csvField(s.events.map(eventText).join(' | ')),
      ].join(','),
    );
  // A byte-order mark so Excel reads non-ASCII file names correctly; CRLF line ends per RFC 4180.
  return `﻿${[CSV_COLUMNS.join(','), ...rows].join('\r\n')}\r\n`;
}
