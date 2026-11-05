// Wraps a MediaPipe face-detector task as a FaceDetector. Kept apart from the code that loads the
// library so it can be tested with a stand-in task.
import type { FaceDetector } from './faceDetector';

/** The one thing we use from MediaPipe's FaceDetector (in its "image" mode: each call stands alone). */
export interface FaceTask {
  detect(image: HTMLCanvasElement): { detections: readonly unknown[] };
  close(): void;
}

/**
 * Looks at one frame at a time through a throwaway canvas.
 *
 * Why a canvas and not the <video> itself: handed the video element directly, the detector scored a
 * real face at about 0.15 in Electron on a Mac, and the very same frame at about 0.95 when it was
 * copied to a canvas first. So the frame is drawn onto a canvas, looked at, and the canvas is
 * emptied (made 0 x 0) straight away, so the picture is not kept: no frame outlives the call.
 */
export function wrapFaceTask(task: FaceTask, makeCanvas: () => HTMLCanvasElement): FaceDetector {
  return {
    hasFace(video) {
      // No picture yet (the camera is still warming up): there is nothing to look at.
      if (video.videoWidth === 0 || video.videoHeight === 0) return Promise.resolve(false);
      const canvas = makeCanvas();
      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context) return Promise.reject(new Error('No canvas to look at the picture with.'));
        context.drawImage(video, 0, 0);
        return Promise.resolve(task.detect(canvas).detections.length > 0);
      } finally {
        // Throw the picture away, whatever happened.
        canvas.width = 0;
        canvas.height = 0;
      }
    },
    close() {
      task.close();
    },
  };
}
