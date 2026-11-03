export const MIN_SPEED = 0.5;
/** Hard cap: playback never goes faster than this, including hold-to-boost. */
export const MAX_SPEED = 2;
export const SPEED_STEP = 0.25;

export const SPEEDS: readonly number[] = Array.from(
  { length: Math.round((MAX_SPEED - MIN_SPEED) / SPEED_STEP) + 1 },
  (_, i) => MIN_SPEED + i * SPEED_STEP,
);

/** Snap to the nearest step and keep within [MIN_SPEED, MAX_SPEED]. */
export function clampSpeed(speed: number): number {
  const snapped = Math.round(speed / SPEED_STEP) * SPEED_STEP;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, snapped));
}

export function nextSpeed(current: number, direction: 1 | -1): number {
  return clampSpeed(current + direction * SPEED_STEP);
}

export function formatSpeed(speed: number): string {
  return `${speed}x`;
}
