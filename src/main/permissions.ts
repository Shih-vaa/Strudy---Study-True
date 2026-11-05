import { session, systemPreferences } from 'electron';
import { devSwitchOn } from './devFlags';
import { holdFocusEvents } from './focusLock';
import { isPermissionAllowed } from './permissionPolicy';

/**
 * Development only (STRUDY_CAMERA_FAKE=1, ignored in packaged builds): Chromium supplies a
 * synthetic test-pattern camera, so the camera check can be tried without a real camera, without
 * the macOS permission prompt and without the camera light.
 */
export const fakeCameraRequested = (): boolean => devSwitchOn('STRUDY_CAMERA_FAKE');

function isFromApp(url: string | undefined, isAppUrl: (url: string) => boolean): boolean {
  if (!url) return false;
  try {
    return isAppUrl(url);
  } catch {
    return false;
  }
}

/**
 * Allow-list for page permissions (Electron grants everything by default). Only the camera is ever
 * allowed, only for the app's own page, and only while Settings has the camera check on.
 * On macOS the system's own camera prompt follows, the first time.
 */
export function registerPermissionHandlers(
  isAppUrl: (url: string) => boolean,
  cameraCheckOn: () => boolean,
): void {
  const ses = session.defaultSession;

  ses.setPermissionRequestHandler((_contents, permission, callback, details) => {
    const mediaTypes = 'mediaTypes' in details && details.mediaTypes ? details.mediaTypes : [];
    const allowed = isPermissionAllowed({
      permission,
      mediaTypes,
      fromApp: isFromApp(details.requestingUrl, isAppUrl),
      cameraCheckOn: cameraCheckOn(),
    });
    if (!allowed) {
      callback(false);
      return;
    }
    if (process.platform === 'darwin' && !fakeCameraRequested()) {
      // Ask macOS itself. A "no" there (now or earlier) comes back as false, and the page then
      // reports that the camera cannot be used.
      // The prompt takes the window's focus: that is not the person leaving.
      const promptClosed = holdFocusEvents();
      systemPreferences
        .askForMediaAccess('camera')
        .then(callback, () => callback(false))
        .finally(promptClosed);
      return;
    }
    callback(true);
  });

  ses.setPermissionCheckHandler((_contents, permission, _origin, details) =>
    isPermissionAllowed({
      permission,
      mediaTypes: 'mediaType' in details && details.mediaType ? [details.mediaType] : [],
      fromApp: isFromApp(details.requestingUrl, isAppUrl),
      cameraCheckOn: cameraCheckOn(),
    }),
  );
}
