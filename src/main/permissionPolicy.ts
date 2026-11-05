// Which browser permissions the app's page may have. Pure, so it can be tested without Electron.
//
// Strudy asks for nothing but the camera, and only when the owner has switched the camera check
// on in Settings (which needs the exit password). The microphone, location, notifications and
// every other permission are always refused. Electron's default is to grant everything, so this
// is an allow-list, not a block-list.

export interface PermissionRequest {
  /** Electron's permission name: 'media' for the camera or microphone, others for the rest. */
  permission: string;
  /**
   * What the page asked to capture. A request has a list ('video', 'audio'); a check has one
   * value, where 'unknown' is used for listing devices (no capture, only names).
   */
  mediaTypes: readonly string[];
  /** The request comes from Strudy's own page, not from anything else that got loaded. */
  fromApp: boolean;
  /** Settings has the camera check switched on. */
  cameraCheckOn: boolean;
}

export function isPermissionAllowed(request: PermissionRequest): boolean {
  if (!request.fromApp || !request.cameraCheckOn) return false;
  if (request.permission !== 'media') return false;
  const { mediaTypes } = request;
  if (mediaTypes.length === 0) return false;
  // Video only. A request that includes audio is refused whole, so the microphone never opens.
  return mediaTypes.every((type) => type === 'video' || type === 'unknown');
}
