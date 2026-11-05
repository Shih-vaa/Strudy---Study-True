// Wraps a MediaPipe face-detector task as a FaceDetector. Kept apart from the code that loads the
// library so it can be tested with a stand-in task.
import type { FaceDetector } from './faceDetector';

/** The two things we use from MediaPipe's FaceDetector. */
export interface FaceTask {
  detectForVideo(video: HTMLVideoElement, timestampMs: number): { detections: readonly unknown[] };
  close(): void;
}

/**
 * MediaPipe wants a timestamp that always goes up, one per frame. The clock is injected, and the
 * wrapper bumps the value if two calls would otherwise get the same (or an earlier) one.
 */
export function wrapFaceTask(task: FaceTask, now: () => number): FaceDetector {
  let last = -1;
  return {
    hasFace(video) {
      // No picture yet (the camera is still warming up): there is nothing to look at.
      if (video.videoWidth === 0 || video.videoHeight === 0) return Promise.resolve(false);
      last = Math.max(Math.round(now()), last + 1);
      return Promise.resolve(task.detectForVideo(video, last).detections.length > 0);
    },
    close() {
      task.close();
    },
  };
}
