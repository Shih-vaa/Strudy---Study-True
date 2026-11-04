import { describe, expect, it } from 'vitest';
import { createSession } from './session';
import { csvField, CSV_COLUMNS, formatLocalDateTime, sessionsToCsv } from './csv';

const at = (h: number, m = 0, s = 0, day = 4) => new Date(2026, 10, day, h, m, s).getTime();

describe('csvField', () => {
  it('leaves plain text and numbers alone', () => {
    expect(csvField('hello')).toBe('hello');
    expect(csvField(42)).toBe('42');
    expect(csvField(1.5)).toBe('1.5');
  });

  it('is empty for null', () => {
    expect(csvField(null)).toBe('');
  });

  it('quotes fields with commas, quotes and line breaks, doubling inner quotes', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line1\nline2')).toBe('"line1\nline2"');
    expect(csvField('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx'])('defuses text that would run as a formula: %j', (text) => {
    expect(csvField(text).replace(/^"/, '').startsWith("'")).toBe(true);
  });

  it('defuses a formula that also needs quoting, without breaking the quoting', () => {
    expect(csvField('=HYPERLINK("http://x","y")')).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
  });

  it('does not touch text that merely contains those characters', () => {
    expect(csvField('a=b')).toBe('a=b');
    expect(csvField('Lecture - 2')).toBe('Lecture - 2');
  });
});

describe('formatLocalDateTime', () => {
  it('pads every part and uses local time', () => {
    expect(formatLocalDateTime(at(9, 5, 7))).toBe('2026-11-04 09:05:07');
    expect(formatLocalDateTime(new Date(2026, 0, 2, 3, 4, 5).getTime())).toBe('2026-01-02 03:04:05');
  });
});

describe('sessionsToCsv', () => {
  const lines = (csv: string) => csv.replace(/^\uFEFF/, '').split('\r\n');

  it('starts with a byte-order mark, has CRLF line ends and a final newline', () => {
    const csv = sessionsToCsv([]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv).not.toMatch(/[^\r]\n/);
  });

  it('is just the header for no sessions', () => {
    expect(lines(sessionsToCsv([]))).toEqual([CSV_COLUMNS.join(','), '']);
  });

  it('writes one row per session with durations, counts and files', () => {
    const session = {
      ...createSession('abc-123', at(9)),
      endedAt: at(10, 30),
      studyMs: 5_400_000, // 90 minutes
      videosWatched: ['/Users/me/Lectures/Physics 1.mp4', 'C:\\Videos\\Maths 2.mp4'],
      focusLostCount: 2,
      presenceMissedCount: 1,
    };
    const [header, row] = lines(sessionsToCsv([session]));
    expect(header).toBe(CSV_COLUMNS.join(','));
    expect(row).toBe('abc-123,2026-11-04 09:00:00,2026-11-04 10:30:00,5400,90,2,Physics 1.mp4 | Maths 2.mp4,2,1,');
  });

  it('leaves ended_at empty for a session that never ended properly', () => {
    const [, row] = lines(sessionsToCsv([createSession('open', at(9))]));
    expect(row?.split(',')[2]).toBe('');
  });

  it('rounds minutes to one decimal', () => {
    const [, row] = lines(sessionsToCsv([{ ...createSession('s', at(9)), studyMs: 100_000 }]));
    expect(row?.split(',')[3]).toBe('100');
    expect(row?.split(',')[4]).toBe('1.7');
  });

  it('writes events readably, with their time and detail', () => {
    const session = {
      ...createSession('s', at(9)),
      events: [
        { type: 'focus_lost' as const, timestamp: at(9, 12, 3), detail: 'away 42s' },
        { type: 'presence_missed' as const, timestamp: at(9, 30, 11) },
        { type: 'auth_failed' as const, timestamp: at(9, 40), detail: 'exit' },
      ],
    };
    const csv = sessionsToCsv([session]);
    expect(csv).toContain(
      'focus_lost 2026-11-04 09:12:03 (away 42s) | presence_missed 2026-11-04 09:30:11 | auth_failed 2026-11-04 09:40:00 (exit)',
    );
  });

  it('lists sessions oldest first, whatever order they come in', () => {
    const csv = sessionsToCsv([
      createSession('late', at(15)),
      createSession('early', at(8)),
      createSession('middle', at(11)),
    ]);
    expect(lines(csv).slice(1, 4).map((l) => l.split(',')[0])).toEqual(['early', 'middle', 'late']);
  });

  it('quotes video names that need it', () => {
    const csv = sessionsToCsv([{ ...createSession('s', at(9)), videosWatched: ['/a/Lecture, part 1.mp4', '/a/Two.mp4'] }]);
    expect(csv).toContain('"Lecture, part 1.mp4 | Two.mp4"');
  });

  it('defuses a video named like a formula when it starts the cell', () => {
    const csv = sessionsToCsv([{ ...createSession('s', at(9)), videosWatched: ['/a/=cmd|calc.mp4', '/a/Two.mp4'] }]);
    expect(csv).toContain("'=cmd|calc.mp4 | Two.mp4");
  });

  it('leaves a formula-like name in the middle of the cell alone: the cell does not start with it', () => {
    const csv = sessionsToCsv([{ ...createSession('s', at(9)), videosWatched: ['/a/One.mp4', '/a/=cmd|calc.mp4'] }]);
    expect(csv).toContain('One.mp4 | =cmd|calc.mp4');
  });

  it('keeps the same number of columns in every row', () => {
    const rows = lines(sessionsToCsv([createSession('a', at(9)), { ...createSession('b', at(10)), videosWatched: ['/x/y.mp4'] }])).slice(1, 3);
    for (const row of rows) expect(row.split(',').length).toBe(CSV_COLUMNS.length);
  });
});
