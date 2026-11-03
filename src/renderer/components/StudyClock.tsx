import { useSessionStore } from '../state/useSessionStore';
import { formatClock } from '../timer/clock';

/** Session and today's study time. The dot is green only while time is being counted. */
export default function StudyClock() {
  const studyMs = useSessionStore((s) => s.session?.studyMs ?? 0);
  const todayBaseMs = useSessionStore((s) => s.todayBaseMs);
  const studying = useSessionStore((s) => s.studying);

  return (
    <div className="study-clock" role="timer" aria-label="Study time" data-active={studying}>
      <span className="study-clock-dot" aria-hidden="true" />
      <span className="study-clock-item">
        <span className="study-clock-label">Session</span>
        <span className="study-clock-session">{formatClock(studyMs)}</span>
      </span>
      <span className="study-clock-item">
        <span className="study-clock-label">Today</span>
        <span className="study-clock-today">{formatClock(todayBaseMs + studyMs)}</span>
      </span>
    </div>
  );
}
