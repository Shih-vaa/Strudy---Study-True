// Plain-language reasons for why the camera could not be used, shown in the player and written to
// the session log. Pure: it only looks at the error's name.

export function describeCameraError(error: unknown): string {
  const name =
    typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was denied. Allow Strudy under System Settings, Privacy & Security, Camera.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is being used by another app.';
    case 'AbortError':
      return 'The camera stopped before it could start.';
    default:
      return 'The camera could not be used.';
  }
}
