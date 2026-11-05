// What the camera check needs from a face detector. The rest of the camera code only knows this
// interface, so the detector can be replaced without touching it (the real ones are made in
// loadFaceDetector.ts).
//
// Privacy rule for every implementation: look at the current frame, answer, keep nothing. No
// copying frames into canvases that outlive the call, no saving, no sending.
import type { FaceLook } from './faceLook';

export interface FaceDetector {
  /**
   * One look at the video's current frame: is a face in view, are the eyes closed, is the head
   * turned away. A detector that only finds faces always says the eyes are open and the head
   * straight. The frame is not kept.
   */
  look(video: HTMLVideoElement): Promise<FaceLook>;
  /** Releases the detector's resources. */
  close(): void;
}
