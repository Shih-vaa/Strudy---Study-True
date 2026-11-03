import { useEffect, useState } from 'react';
import type { AppInfo, OpenDialogKind } from '../../shared/types';
import { baseName, formatTime } from '../player/format';
import { useSessionStore } from '../state/useSessionStore';

export default function Library() {
  const playlist = useSessionStore((s) => s.playlist);
  const openMedia = useSessionStore((s) => s.openMedia);
  const playAt = useSessionStore((s) => s.playAt);

  const [notice, setNotice] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    void window.api.getAppInfo().then(setInfo);
  }, []);

  // Saved resume positions for the listed videos.
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      playlist.map(async (path) => [path, await window.api.getPosition(path)] as const),
    ).then((entries) => {
      if (!cancelled) setPositions(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [playlist]);

  const open = async (kind: OpenDialogKind) => {
    setNotice(null);
    const opened = await openMedia(kind);
    if (!opened) {
      setNotice('No video opened. Choose a video file, or a folder with .mp4, .mkv, .webm, .mov or .m4v files.');
    }
  };

  return (
    <main className="library">
      <header>
        <h1>Strudy</h1>
        <p className="tagline">True Study. A focused lecture player.</p>
      </header>

      <div className="open-actions">
        <button className="btn primary" onClick={() => void open('file')}>
          Open video
        </button>
        <button className="btn" onClick={() => void open('folder')}>
          Open folder
        </button>
      </div>

      {notice && <p className="notice">{notice}</p>}

      {playlist.length > 0 && (
        <section aria-label="Playlist">
          <h2 className="section-title">Playlist &middot; {playlist.length} videos</h2>
          <ol className="playlist">
            {playlist.map((path, i) => (
              <li key={path}>
                <button onClick={() => playAt(i)}>
                  <span className="playlist-index">{i + 1}</span>
                  <span className="playlist-name" title={path}>
                    {baseName(path)}
                  </span>
                  {(positions[path] ?? 0) > 0 && (
                    <span className="playlist-resume">Resume {formatTime(positions[path] ?? 0)}</span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="library-footer">
        {info ? `${info.name} ${info.version} · Electron ${info.electron}` : ' '}
      </footer>
    </main>
  );
}
