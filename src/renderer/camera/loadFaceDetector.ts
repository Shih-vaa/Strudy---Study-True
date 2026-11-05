import wasmLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import type { FaceDetector } from './faceDetector';
import { wrapFaceTask, wrapLandmarkerTask } from './faceDetectorTask';
import { DEFAULT_LIMITS } from './faceLook';
import landmarkerModelUrl from './models/face_landmarker.task?url';
import modelUrl from './models/blaze_face_short_range.tflite?url';

/**
 * How sure the detector must be that something is a face. MediaPipe's default is 0.5, which found
 * "faces" in a plain test pattern (Chromium's fake camera scores up to 0.70 even in the better
 * canvas mode). A real face, seen the way this app shows it to the detector, scored 0.91 to 0.97 on
 * a MacBook camera. 0.8 sits between the two.
 */
const DETECTION_CONFIDENCE = 0.8;

export interface LoadOptions {
  /**
   * Also read the eyes and the head direction (the owner's "eyes and head" switch). That loads the
   * larger Face Landmarker model; without it only the small face-finding model is loaded.
   */
  attention: boolean;
}

/**
 * Loads Google's MediaPipe face detector (BlazeFace short range), or, with `attention`, the Face
 * Landmarker, which finds the face and also reads the eyelids and the head's direction. Everything
 * it needs is part of the app: the engine (WebAssembly) and the models come from files shipped
 * inside it, so loading never touches the network. It runs on the CPU, which needs no graphics
 * context.
 *
 * The library is loaded on demand, so it costs nothing unless the camera check is switched on.
 *
 * Known: the library has a usage logger that tries to POST statistics to a Google address, with no
 * option to turn it off. It never gets through: the page's Content Security Policy (src/shared/csp.ts)
 * and the main process's request guard both refuse everything that is not local. No frame is ever
 * part of what it would send.
 */
export async function loadFaceDetector({ attention }: LoadOptions): Promise<FaceDetector> {
  const vision = await import('@mediapipe/tasks-vision');
  const files = { wasmLoaderPath: wasmLoaderUrl, wasmBinaryPath: wasmBinaryUrl };
  const makeCanvas = () => document.createElement('canvas');

  if (attention) {
    const task = await vision.FaceLandmarker.createFromOptions(files, {
      // "Image" mode: every look stands alone on a canvas (see faceDetectorTask.ts).
      baseOptions: { modelAssetPath: landmarkerModelUrl, delegate: 'CPU' },
      runningMode: 'IMAGE',
      numFaces: 1,
      minFaceDetectionConfidence: DETECTION_CONFIDENCE,
      minFacePresenceConfidence: 0.5,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
    return wrapLandmarkerTask(task, makeCanvas, DEFAULT_LIMITS);
  }

  const task = await vision.FaceDetector.createFromOptions(files, {
    baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' },
    runningMode: 'IMAGE',
    minDetectionConfidence: DETECTION_CONFIDENCE,
  });
  return wrapFaceTask(task, makeCanvas);
}
