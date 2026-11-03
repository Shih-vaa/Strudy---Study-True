import { useEffect, useState } from 'react';
import type { AppInfo } from '../shared/types';

export default function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window.api === 'undefined') {
      setError('Preload bridge (window.api) is missing.');
      return;
    }
    window.api
      .getAppInfo()
      .then(setInfo)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <main className="hello">
      <h1>Strudy</h1>
      <p className="tagline">True Study. A focused lecture player.</p>

      <section className="card" aria-label="Environment">
        <h2>Milestone 1: scaffold</h2>
        {error && <p className="status bad">IPC bridge: {error}</p>}
        {!error && !info && <p className="status">Connecting to main process…</p>}
        {info && (
          <>
            <p className="status ok">IPC bridge: connected</p>
            <dl>
              <dt>App</dt>
              <dd>
                {info.name} {info.version}
              </dd>
              <dt>Platform</dt>
              <dd>{info.platform}</dd>
              <dt>Electron</dt>
              <dd>{info.electron}</dd>
              <dt>Chromium</dt>
              <dd>{info.chrome}</dd>
              <dt>Node</dt>
              <dd>{info.node}</dd>
            </dl>
          </>
        )}
      </section>
    </main>
  );
}
