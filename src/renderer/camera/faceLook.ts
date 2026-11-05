// What the camera check learns from one look at the face, and how raw numbers from the face
// landmarker become "eyes closed" and "head turned away". Pure: no camera, no library, no DOM.
//
// Only two things are read from the face besides "is it there": how closed the eyes are and which
// way the head points. Where on the screen she looks is NOT tracked (too unreliable on a laptop
// camera, and looking down at a notebook would look the same as looking at a phone).

export interface FaceLook {
  /** A face is in view. */
  face: boolean;
  /** Both eyes are closed (only ever true when a face is in view). */
  eyesClosed: boolean;
  /** The head is turned well away from the screen (only ever true when a face is in view). */
  headAway: boolean;
}

export const NO_FACE: FaceLook = { face: false, eyesClosed: false, headAway: false };
export const FACE: FaceLook = { face: true, eyesClosed: false, headAway: false };

/** Why a face in view does not count as someone studying. */
export type AttentionIssue = 'eyes_closed' | 'looking_away';

/** Everything that stops the clock: nobody there, or someone there who is not attending. */
export type MissingKind = 'no_face' | AttentionIssue;

export interface Limits {
  /** Average of the two eye-blink scores (0 open, 1 closed) at or above which the eyelids count as closed. */
  eyesClosedAt: number;
  /**
   * A head tipped down by more than this many degrees is reading or writing, and lowered eyelids
   * then are not "closed eyes". (Looking down at a desk scored as high on the eyelid scale as
   * really closed eyes did: only the head's tip tells them apart.)
   */
  readingPitchDeg: number;
  /** Head turned left or right by more than this many degrees counts as looking away. */
  yawDeg: number;
  /** Head tipped down by more than this many degrees (a phone in the lap) counts as looking away. */
  pitchDownDeg: number;
  /** Head tipped up by more than this many degrees (the ceiling) counts as looking away. */
  pitchUpDeg: number;
}

/**
 * Set from measurements on a real camera (a MacBook's FaceTime camera, one person, 2026-11-05):
 * facing the screen: eyelids 0.08, yaw -3 to -5, pitch 3 to 8; looking down at a desk: eyelids 0.55,
 * pitch 24; eyes closed, head upright: eyelids 0.60, pitch 9; head turned left about +41, right about
 * -50; looking at the ceiling: pitch about -40. Pitch is positive when the head tips down.
 */
export const DEFAULT_LIMITS: Limits = {
  eyesClosedAt: 0.5,
  readingPitchDeg: 16,
  yawDeg: 30,
  pitchDownDeg: 32,
  pitchUpDeg: 25,
};

/** The raw numbers for one face, before any limit is applied. */
export interface FaceMeasure {
  /** Average of the eye-blink scores, 0 (open) to 1 (closed); null if the model gave none. */
  blink: number | null;
  /** Head turn left/right in degrees (sign depends on the camera); null if there was no matrix. */
  yawDeg: number | null;
  /** Head tip in degrees, positive when it tips down; null if there was no matrix. */
  pitchDeg: number | null;
}

interface Category {
  categoryName: string;
  score: number;
}

/** The parts of the landmarker's result that are used (a subset of MediaPipe's own type). */
export interface LandmarkerOutput {
  faceLandmarks: readonly unknown[];
  faceBlendshapes: readonly { categories: readonly Category[] }[];
  facialTransformationMatrixes: readonly { data: ArrayLike<number> }[];
}

/** The average of the left and right eye-blink scores, or null if either is missing. */
export function blinkScore(categories: readonly Category[]): number | null {
  const left = categories.find((c) => c.categoryName === 'eyeBlinkLeft')?.score;
  const right = categories.find((c) => c.categoryName === 'eyeBlinkRight')?.score;
  if (left === undefined || right === undefined) return null;
  return (left + right) / 2;
}

const DEGREES = 180 / Math.PI;

/**
 * Head turn and tip, in degrees, from the 4 x 4 transformation matrix (16 numbers, column by
 * column). The rotation is read as yaw (around the vertical axis) and pitch (around the side-to-side
 * axis). Null if the matrix is not 16 finite numbers.
 */
export function headAnglesDeg(data: ArrayLike<number>): { yawDeg: number; pitchDeg: number } | null {
  if (data.length !== 16) return null;
  for (let i = 0; i < 16; i++) if (!Number.isFinite(data[i])) return null;
  // Element at row r, column c of a column-major 4 x 4 matrix.
  const m = (r: number, c: number): number => data[c * 4 + r] as number;
  const yaw = Math.asin(Math.max(-1, Math.min(1, -m(2, 0))));
  const pitch = Math.atan2(m(2, 1), m(2, 2));
  return { yawDeg: yaw * DEGREES, pitchDeg: pitch * DEGREES };
}

/** Raw numbers for the first face in the result, or null when there is no face. */
export function measureFace(output: LandmarkerOutput): FaceMeasure | null {
  if (output.faceLandmarks.length === 0) return null;
  const blendshapes = output.faceBlendshapes[0];
  const matrix = output.facialTransformationMatrixes[0];
  const angles = matrix ? headAnglesDeg(matrix.data) : null;
  return {
    blink: blendshapes ? blinkScore(blendshapes.categories) : null,
    yawDeg: angles?.yawDeg ?? null,
    pitchDeg: angles?.pitchDeg ?? null,
  };
}

/** Applies the limits. A number that is missing never counts against the person. */
export function interpretMeasure(measure: FaceMeasure | null, limits: Limits): FaceLook {
  if (measure === null) return NO_FACE;
  const pitch = measure.pitchDeg;
  const tippedDown = pitch !== null && pitch > limits.readingPitchDeg;
  const eyesClosed = measure.blink !== null && measure.blink >= limits.eyesClosedAt && !tippedDown;
  const headAway =
    (measure.yawDeg !== null && Math.abs(measure.yawDeg) > limits.yawDeg) ||
    (pitch !== null && (pitch > limits.pitchDownDeg || pitch < -limits.pitchUpDeg));
  return { face: true, eyesClosed, headAway };
}

export function interpretLandmarker(output: LandmarkerOutput, limits: Limits = DEFAULT_LIMITS): FaceLook {
  return interpretMeasure(measureFace(output), limits);
}

/**
 * The camera check's view of one look: is someone there and attending? `attention` is the owner's
 * switch for the eyes-and-head check; with it off, any face in view counts.
 */
export function lookToSample(
  look: FaceLook,
  attention: boolean,
): { faceSeen: boolean; why?: AttentionIssue } {
  if (!look.face) return { faceSeen: false };
  if (attention && look.eyesClosed) return { faceSeen: false, why: 'eyes_closed' };
  if (attention && look.headAway) return { faceSeen: false, why: 'looking_away' };
  return { faceSeen: true };
}
