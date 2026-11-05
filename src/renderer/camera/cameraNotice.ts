// The one-time notice that tells the person studying what the camera check does. Which notice has
// been shown is remembered in this app's own local storage. It is a courtesy, not a lock: if the
// storage is cleared, or unavailable, the notice simply shows again.
//
// There are two levels. "presence" says the camera only looks for a face. "attention" also says it
// reads the eyes and the head direction, so switching that on later shows the notice again.

const KEY = 'strudy.cameraNoticeSeen';

export type NoticeLevel = 'presence' | 'attention';

function seenLevel(): NoticeLevel | null {
  try {
    const value = window.localStorage.getItem(KEY);
    // "1" is what the first version stored: that notice was the presence one.
    if (value === '1' || value === 'presence') return 'presence';
    return value === 'attention' ? 'attention' : null;
  } catch {
    return null;
  }
}

/** Has the person already read the notice for this level (or a fuller one)? */
export function hasSeenCameraNotice(level: NoticeLevel): boolean {
  const seen = seenLevel();
  if (seen === 'attention') return true;
  return seen === 'presence' && level === 'presence';
}

export function markCameraNoticeSeen(level: NoticeLevel): void {
  try {
    window.localStorage.setItem(KEY, level);
  } catch {
    // Storage unavailable: the notice will show again next time, which is the safe direction.
  }
}
