import wasmLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import type { FaceDetector } from './faceDetector';
import { wrapFaceTask } from './faceDetectorTask';
import modelUrl from './models/blaze_face_short_range.tflite?url';

/**
 * Loads Google's MediaPipe face detector (BlazeFace short range). Everything it needs is part of
 * the app: the engine (WebAssembly) and the model come from files shipped inside it, so loading
 * never touches the network. It runs on the CPU, which needs no graphics context.
 *
 * The library is loaded on demand, so it costs nothing unless the camera check is switched on.
 *
 * Known: the library has a usage logger that tries to POST statistics to a Google address, with no
 * option to turn it off. It never gets through: the page's Content Security Policy (src/shared/csp.ts)
 * and the main process's request guard both refuse everything that is not local. No frame is ever
 * part of what it would send.
 */
export async function loadFaceDetector(): Promise<FaceDetector> {
  const { FaceDetector: MediaPipeFaceDetector } = await import('@mediapipe/tasks-vision');
  const task = await MediaPipeFaceDetector.createFromOptions(
    { wasmLoaderPath: wasmLoaderUrl, wasmBinaryPath: wasmBinaryUrl },
    {
      baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' },
      runningMode: 'VIDEO',
      // Higher than MediaPipe's default of 0.5: at 0.5 the detector found "faces" in a plain
      // test pattern (a moving disc) about every other second. Real faces at laptop distance score
      // well above this.
      minDetectionConfidence: 0.7,
    },
  );
  return wrapFaceTask(task, () => performance.now());
}
