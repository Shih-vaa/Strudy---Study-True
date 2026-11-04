import { useEffect, useMemo, useState } from 'react';
import type { Session, StudyEvent } from '../../shared/types';
import { ipcErrorMessage } from '../ipcError';
import { useSessionStore } from '../state/useSessionStore';
import {
  barHeights,
  formatStudyTime,
  lastDays,
  sessionRows,
  wholeMinutes,
  withCurrentSession,
  type DaySummary,
  type SessionRow,
} from '../summary/summary';
import { startOfLocalDay } from '../timer/clock';

const EVENT_LABELS: Record<StudyEvent['type'], string> = {
  focus_lost: 'Left the app',
  presence_missed: 'Missed a "Still studying?" check',
  auth_failed: 'Wrong password',
  password_reset: 'Password reset with the recovery key',
};

const timeOf = (ms: number): string =>
  new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const startedOf = (ms: number): string =>
  new Date(ms).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Summary() {
  const showLibrary = useSessionStore((s) => s.showLibrary);
  const current = useSessionStore((s) => s.session);
  const [stored, setStored] = useState<Session[] | null>(null);
  const [now] = useState(() => Date.now());
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void window.api.listSessions().then(setStored);
  }, []);

  const sessions = useMemo(() => (stored ? withCurrentSession(stored, current) : null), [stored, current]);
  const days = useMemo(() => (sessions ? lastDays(sessions, now) : []), [sessions, now]);
  const rows = useMemo(() => (sessions ? sessionRows(sessions, current?.id ?? null) : []), [sessions, current]);
  const today = days[days.length - 1];

  const exportCsv = async () => {
    setExporting(true);
    setExportMessage(null);
    try {
      // Save the running session first so the file has its latest numbers.
      if (current) await window.api.saveSession(current);
      const path = await window.api.exportSessionsCsv();
      if (path) setExportMessage({ ok: true, text: `Saved to ${path}` });
    } catch (e) {
      setExportMessage({ ok: false, text: ipcErrorMessage(e, 'Could not save the file.') });
    }
    setExporting(false);
  };

  return (
    <main className="summary">
      <header className="settings-header">
        <h1>Summary</h1>
        <div className="header-actions">
          <button className="btn" onClick={() => void exportCsv()} disabled={exporting || !sessions || sessions.length === 0}>
            Export CSV
          </button>
          <button className="btn" onClick={showLibrary}>
            Back
          </button>
        </div>
      </header>
      {exportMessage && (
        <p className={exportMessage.ok ? 'form-ok' : 'form-error'} role="status">
          {exportMessage.text}
        </p>
      )}

      {!sessions || !today ? null : (
        <>
          <section aria-label="Today" className="stat-grid">
            <Stat label="Studied today" value={formatStudyTime(today.studyMs)} note={`${wholeMinutes(today.studyMs)} minutes`} />
            <Stat label="Left the app" value={String(today.focusLost)} note={today.focusLost === 1 ? 'time today' : 'times today'} />
            <Stat label="Missed checks" value={String(today.presenceMissed)} note="today" />
            <Stat label="Sessions" value={String(today.sessions)} note="today" />
          </section>

          <section aria-label="Last 7 days" className="panel">
            <h2 className="card-title">Last 7 days, minutes studied</h2>
            <Chart days={days} todayStart={startOfLocalDay(now)} />
          </section>

          <section aria-label="Sessions" className="panel">
            <h2 className="card-title">Sessions</h2>
            {rows.length === 0 ? (
              <p className="setup-lead">No sessions yet. Play a video and your study time shows up here.</p>
            ) : (
              <ol className="session-list">
                {rows.map((row) => (
                  <SessionItem key={row.id} row={row} />
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-note">{note}</span>
    </div>
  );
}

const CHART_WIDTH = 560;
const CHART_HEIGHT = 210;
const BASELINE = 168;
const MAX_BAR = 124;

function Chart({ days, todayStart }: { days: DaySummary[]; todayStart: number }) {
  const minutes = days.map((d) => wholeMinutes(d.studyMs));
  // Never scale below 30 minutes, so a few minutes does not fill the whole chart.
  const heights = barHeights(minutes, MAX_BAR, 30);
  const slot = CHART_WIDTH / days.length;
  const barWidth = 44;

  const label = (d: DaySummary) =>
    d.dayStart === todayStart
      ? 'Today'
      : new Date(d.dayStart).toLocaleDateString(undefined, { weekday: 'short' });
  const description = days.map((d, i) => `${label(d)} ${minutes[i]} minutes`).join(', ');

  return (
    <svg className="chart" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label={`Minutes studied per day: ${description}`}>
      <line className="chart-axis" x1="0" x2={CHART_WIDTH} y1={BASELINE} y2={BASELINE} />
      {days.map((d, i) => {
        const x = i * slot + (slot - barWidth) / 2;
        const height = heights[i] ?? 0;
        const isToday = d.dayStart === todayStart;
        return (
          <g key={d.dayStart}>
            <title>{`${label(d)}: ${minutes[i]} min`}</title>
            {height > 0 && (
              <rect className={isToday ? 'chart-bar today' : 'chart-bar'} x={x} y={BASELINE - height} width={barWidth} height={height} rx="5" />
            )}
            <text className="chart-value" x={x + barWidth / 2} y={BASELINE - height - 7} textAnchor="middle">
              {minutes[i]}
            </text>
            <text className={isToday ? 'chart-label today' : 'chart-label'} x={x + barWidth / 2} y={BASELINE + 20} textAnchor="middle">
              {label(d)}
            </text>
            <text className="chart-sub" x={x + barWidth / 2} y={BASELINE + 36} textAnchor="middle">
              {new Date(d.dayStart).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function SessionItem({ row }: { row: SessionRow }) {
  const status = row.running
    ? { text: 'Running now', className: 'status-running' }
    : row.endedAt !== null
      ? { text: `Ended ${timeOf(row.endedAt)}`, className: '' }
      : { text: 'Not closed properly', className: 'status-warn' };

  return (
    <li className="session-item">
      <div className="session-main">
        <span className="session-when">{startedOf(row.startedAt)}</span>
        <span className="session-study">{formatStudyTime(row.studyMs)}</span>
        <span className="session-meta">
          {row.videoCount} {row.videoCount === 1 ? 'video' : 'videos'}
        </span>
        <span className="session-meta">Left {row.focusLost}×</span>
        <span className="session-meta">Missed {row.presenceMissed}</span>
        <span className={`session-status ${status.className}`}>{status.text}</span>
      </div>
      {row.events.length > 0 && (
        <details className="session-events">
          <summary>
            {row.events.length} {row.events.length === 1 ? 'event' : 'events'}
          </summary>
          <ul>
            {row.events.map((event, i) => (
              <li key={`${event.timestamp}-${i}`}>
                <span className="event-time">{timeOf(event.timestamp)}</span>{' '}
                {EVENT_LABELS[event.type]}
                {event.detail ? <span className="event-detail"> ({event.detail})</span> : null}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}
