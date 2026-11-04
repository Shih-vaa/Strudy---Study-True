/**
 * A rejected IPC call arrives as "Error invoking remote method 'x': Error: message".
 * Returns just the message, for showing to the user.
 */
export function ipcErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.replace(/^Error invoking remote method '[^']*': (?:Error: )?/, '').trim();
  return message === '' ? fallback : message;
}
