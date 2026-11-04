// Command-line switches that open a debugging door into a running app: Chromium's remote
// debugging (which would let anyone drive the page from outside) and Node's inspector. Electron's
// fuses switch off the Node ones in the installed app but cannot cover Chromium's, so the app
// itself refuses to start with any of them. Pure, so it can be tested.

const PREFIXES = ['--remote-debugging-', '--remote-allow-origins', '--inspect', '--debug'];

/** The first debugging switch in `argv`, or null if there is none. */
export function findDebugSwitch(argv: readonly string[]): string | null {
  return argv.find((arg) => PREFIXES.some((prefix) => arg.startsWith(prefix))) ?? null;
}
