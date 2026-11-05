// The one-time notice that tells the person studying the camera check is on. Whether it has been
// shown is remembered in this app's own local storage. It is a courtesy, not a lock: if the
// storage is cleared, or unavailable, the notice simply shows again.

const KEY = 'strudy.cameraNoticeSeen';
const VERSION = '1';

export function hasSeenCameraNotice(): boolean {
  try {
    return window.localStorage.getItem(KEY) === VERSION;
  } catch {
    return false;
  }
}

export function markCameraNoticeSeen(): void {
  try {
    window.localStorage.setItem(KEY, VERSION);
  } catch {
    // Storage unavailable: the notice will show again next time, which is the safe direction.
  }
}
