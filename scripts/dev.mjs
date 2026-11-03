// Dev runner: starts the Vite dev server, then launches Electron pointed at it.
// The main/preload bundles must already be built (`npm run dev` does this first).
import { spawn } from 'node:child_process';
import electronPath from 'electron';
import { createServer } from 'vite';

const server = await createServer({ clearScreen: false });
await server.listen();
server.printUrls();

const devUrl = server.resolvedUrls?.local[0];
if (!devUrl) {
  console.error('Vite did not report a local URL.');
  await server.close();
  process.exit(1);
}

// Some hosts set ELECTRON_RUN_AS_NODE, which would make Electron behave like plain Node.
const env = { ...process.env, VITE_DEV_SERVER_URL: devUrl };
delete env.ELECTRON_RUN_AS_NODE;

// Extra CLI args (e.g. `npm run dev -- --remote-debugging-port=9222`) go to Electron.
const electron = spawn(electronPath, ['.', ...process.argv.slice(2)], { stdio: 'inherit', env });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => electron.kill());
}

electron.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
