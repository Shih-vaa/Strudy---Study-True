// What the camera check needs from a face detector. The rest of the camera code only knows this
// interface, so the detector can be replaced without touching it (the real one is in
// loadFaceDetector.ts).
//
// Privacy rule for every implementation: look at the current frame, answer yes or no, keep
// nothing. No copying frames into canvases that outlive the call, no saving, no sending.

export interface FaceDetector {
  /** Is a face in the video's current frame? The frame is not kept. */
  hasFace(video: HTMLVideoElement): Promise<boolean>;
  /** Releases the detector's resources. */
  close(): void;
}
