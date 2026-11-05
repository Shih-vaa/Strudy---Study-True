// Wraps MediaPipe tasks as FaceDetectors. Kept apart from the code that loads the library so it can
// be tested with stand-in tasks.
import type { FaceDetector } from './faceDetector';
import { DEFAULT_LIMITS, FACE, interpretLandmarker, NO_FACE, type LandmarkerOutput, type Limits } from './faceLook';

/** The one thing we use from MediaPipe's FaceDetector (in its "image" mode: each call stands alone). */
export interface FaceTask {
  detect(image: HTMLCanvasElement): { detections: readonly unknown[] };
  close(): void;
}

/** The one thing we use from MediaPipe's FaceLandmarker (also in "image" mode). */
export interface LandmarkerTask {
  detect(image: HTMLCanvasElement): LandmarkerOutput;
  close(): void;
}

/**
 * Looks at one frame through a throwaway canvas, then empties the canvas (makes it 0 x 0), even if
 * the look fails, so the picture is not kept: no frame outlives the call.
 *
 * Why a canvas and not the <video> itself: handed the video element directly, the detector scored a
 * real face at about 0.15 in Electron on a Mac, and the very same frame at about 0.95 when it was
 * copied to a canvas first.
 */
function lookThroughCanvas(
  video: HTMLVideoElement,
  makeCanvas: () => HTMLCanvasElement,
  read: (canvas: HTMLCanvasElement) => ReturnType<FaceDetector['look']> extends Promise<infer T> ? T : never,
) {
  // No picture yet (the camera is still warming up): there is nothing to look at.
  if (video.videoWidth === 0 || video.videoHeight === 0) return Promise.resolve(NO_FACE);
  const canvas = makeCanvas();
  try {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return Promise.reject(new Error('No canvas to look at the picture with.'));
    context.drawImage(video, 0, 0);
    return Promise.resolve(read(canvas));
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** Finds faces only: eyes are always reported open and the head straight. */
export function wrapFaceTask(task: FaceTask, makeCanvas: () => HTMLCanvasElement): FaceDetector {
  return {
    look: (video) => lookThroughCanvas(video, makeCanvas, (canvas) => (task.detect(canvas).detections.length > 0 ? FACE : NO_FACE)),
    close: () => task.close(),
  };
}

/** Finds a face and reads its eyes and head direction. */
export function wrapLandmarkerTask(
  task: LandmarkerTask,
  makeCanvas: () => HTMLCanvasElement,
  limits: Limits = DEFAULT_LIMITS,
): FaceDetector {
  return {
    look: (video) => lookThroughCanvas(video, makeCanvas, (canvas) => interpretLandmarker(task.detect(canvas), limits)),
    close: () => task.close(),
  };
}
