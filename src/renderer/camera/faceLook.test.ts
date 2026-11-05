import { describe, expect, it } from 'vitest';
import {
  blinkScore,
  DEFAULT_LIMITS,
  FACE,
  headAnglesDeg,
  interpretLandmarker,
  interpretMeasure,
  lookToSample,
  measureFace,
  NO_FACE,
  type Limits,
  type LandmarkerOutput,
} from './faceLook';

/** A column-major 4 x 4 matrix for a head turned by `yaw` and tipped by `pitch` (degrees). */
function matrix(yawDeg: number, pitchDeg: number): number[] {
  const y = (yawDeg * Math.PI) / 180;
  const p = (pitchDeg * Math.PI) / 180;
  const cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(p), sp = Math.sin(p);
  // R = Ry(yaw) * Rx(pitch), row by row
  const r = [
    [cy, sy * sp, sy * cp],
    [0, cp, -sp],
    [-sy, cy * sp, cy * cp],
  ];
  const out = new Array<number>(16).fill(0);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) out[col * 4 + row] = r[row]![col]!;
  out[15] = 1;
  return out;
}

const blink = (left: number, right: number) => [
  { categoryName: 'eyeBlinkLeft', score: left },
  { categoryName: 'eyeBlinkRight', score: right },
  { categoryName: 'jawOpen', score: 0.9 },
];

const output = (opts: { faces?: number; left?: number; right?: number; yaw?: number; pitch?: number } = {}): LandmarkerOutput => ({
  faceLandmarks: Array.from({ length: opts.faces ?? 1 }, () => []),
  faceBlendshapes: (opts.faces ?? 1) === 0 ? [] : [{ categories: blink(opts.left ?? 0.05, opts.right ?? 0.05) }],
  facialTransformationMatrixes: (opts.faces ?? 1) === 0 ? [] : [{ data: matrix(opts.yaw ?? 0, opts.pitch ?? 0) }],
});

const limits: Limits = { eyesClosedAt: 0.5, readingPitchDeg: 16, yawDeg: 40, pitchDownDeg: 35, pitchUpDeg: 30 };

describe('blinkScore', () => {
  it('averages the left and right eye-blink scores and ignores other blendshapes', () => {
    expect(blinkScore(blink(0.2, 0.6))).toBeCloseTo(0.4);
  });

  it('is null when either eye is missing', () => {
    expect(blinkScore([{ categoryName: 'eyeBlinkLeft', score: 1 }])).toBeNull();
    expect(blinkScore([])).toBeNull();
  });
});

describe('headAnglesDeg', () => {
  it('reads no turn and no tip for an upright matrix', () => {
    const a = headAnglesDeg(matrix(0, 0))!;
    expect(a.yawDeg).toBeCloseTo(0);
    expect(a.pitchDeg).toBeCloseTo(0);
  });

  it.each([
    [30, 0],
    [-30, 0],
    [0, 25],
    [0, -25],
    [45, 10],
    [-20, -15],
  ])('reads a head turned %d and tipped %d degrees back', (yaw, pitch) => {
    const a = headAnglesDeg(matrix(yaw, pitch))!;
    expect(a.yawDeg).toBeCloseTo(yaw, 3);
    expect(a.pitchDeg).toBeCloseTo(pitch, 3);
  });

  it('is null for anything that is not 16 finite numbers', () => {
    expect(headAnglesDeg([])).toBeNull();
    expect(headAnglesDeg(new Array(15).fill(0))).toBeNull();
    expect(headAnglesDeg([...matrix(0, 0).slice(0, 15), Number.NaN])).toBeNull();
    expect(headAnglesDeg([...matrix(0, 0).slice(0, 15), Number.POSITIVE_INFINITY])).toBeNull();
  });

  it('accepts a typed array (that is what the library gives)', () => {
    expect(headAnglesDeg(Float32Array.from(matrix(20, 0)))!.yawDeg).toBeCloseTo(20, 3);
  });
});

describe('measureFace', () => {
  it('is null when there is no face', () => {
    expect(measureFace(output({ faces: 0 }))).toBeNull();
  });

  it('collects the blink score and the head angles', () => {
    const m = measureFace(output({ left: 0.1, right: 0.3, yaw: 15, pitch: -10 }))!;
    expect(m.blink).toBeCloseTo(0.2);
    expect(m.yawDeg).toBeCloseTo(15, 3);
    expect(m.pitchDeg).toBeCloseTo(-10, 3);
  });

  it('keeps going with what is there when blendshapes or the matrix are missing', () => {
    const m = measureFace({ faceLandmarks: [[]], faceBlendshapes: [], facialTransformationMatrixes: [] })!;
    expect(m).toEqual({ blink: null, yawDeg: null, pitchDeg: null });
  });
});

describe('interpretMeasure', () => {
  it('says nothing is there when there is no measure', () => {
    expect(interpretMeasure(null, limits)).toEqual(NO_FACE);
  });

  it('is a plain face when the eyes are open and the head is straight', () => {
    expect(interpretMeasure({ blink: 0.05, yawDeg: 3, pitchDeg: -4 }, limits)).toEqual(FACE);
  });

  it('calls the eyes closed from the limit up, not below it', () => {
    expect(interpretMeasure({ blink: 0.49, yawDeg: 0, pitchDeg: 0 }, limits).eyesClosed).toBe(false);
    expect(interpretMeasure({ blink: 0.5, yawDeg: 0, pitchDeg: 0 }, limits).eyesClosed).toBe(true);
  });

  it('calls the head away only beyond the limits: turned either way, tipped far down, tipped up', () => {
    const look = (yaw: number, pitch: number) => interpretMeasure({ blink: 0, yawDeg: yaw, pitchDeg: pitch }, limits).headAway;
    expect(look(40, 0)).toBe(false);
    expect(look(41, 0)).toBe(true);
    expect(look(-41, 0)).toBe(true);
    expect(look(0, 35)).toBe(false);
    expect(look(0, 36)).toBe(true);
    expect(look(0, -30)).toBe(false);
    expect(look(0, -31)).toBe(true);
  });

  it('does not call lowered eyelids "closed" while the head is tipped down: that is reading or writing', () => {
    const look = (pitch: number) => interpretMeasure({ blink: 0.6, yawDeg: 0, pitchDeg: pitch }, limits);
    expect(look(10).eyesClosed).toBe(true); // upright head, shut eyes: asleep or resting
    expect(look(16).eyesClosed).toBe(true); // at the limit still counts
    expect(look(17).eyesClosed).toBe(false); // tipped down: looking at a notebook
    expect(look(24)).toEqual({ face: true, eyesClosed: false, headAway: false }); // the measured desk case
    expect(look(36)).toEqual({ face: true, eyesClosed: false, headAway: true }); // far down: a phone in the lap
  });

  it('still calls closed eyes closed when the head is tipped up or turned', () => {
    expect(interpretMeasure({ blink: 0.6, yawDeg: 0, pitchDeg: -10 }, limits).eyesClosed).toBe(true);
    expect(interpretMeasure({ blink: 0.6, yawDeg: 20, pitchDeg: 0 }, limits).eyesClosed).toBe(true);
  });

  it('never counts a missing number against the person', () => {
    expect(interpretMeasure({ blink: null, yawDeg: null, pitchDeg: null }, limits)).toEqual(FACE);
    expect(interpretMeasure({ blink: 0.9, yawDeg: null, pitchDeg: null }, limits).eyesClosed).toBe(true);
  });
});

describe('interpretLandmarker', () => {
  it('uses the default limits unless given others', () => {
    const closed = interpretLandmarker(output({ left: 0.9, right: 0.9 }));
    expect(closed).toEqual({ face: true, eyesClosed: true, headAway: false });
    expect(DEFAULT_LIMITS.eyesClosedAt).toBeLessThan(0.9);
  });

  // The numbers measured on a real camera (see DEFAULT_LIMITS): each situation must read as it should.
  it.each([
    ['facing the screen', { left: 0.08, right: 0.08, yaw: -4, pitch: 3 }, { face: true, eyesClosed: false, headAway: false }],
    ['reading the screen, leaning in', { left: 0.1, right: 0.1, yaw: -5, pitch: 10 }, { face: true, eyesClosed: false, headAway: false }],
    ['looking down at a notebook on the desk', { left: 0.55, right: 0.55, yaw: -5, pitch: 24 }, { face: true, eyesClosed: false, headAway: false }],
    ['eyes shut, head upright', { left: 0.6, right: 0.6, yaw: -4, pitch: 9 }, { face: true, eyesClosed: true, headAway: false }],
    ['head turned to the left wall', { left: 0.05, right: 0.05, yaw: 41, pitch: 1 }, { face: true, eyesClosed: false, headAway: true }],
    ['head turned to the right wall', { left: 0.1, right: 0.1, yaw: -50, pitch: -5 }, { face: true, eyesClosed: false, headAway: true }],
    ['looking up at the ceiling', { left: 0.44, right: 0.44, yaw: 4, pitch: -40 }, { face: true, eyesClosed: false, headAway: true }],
    ['a normal blink', { left: 0.6, right: 0.6, yaw: -4, pitch: 3 }, { face: true, eyesClosed: true, headAway: false }],
  ])('with the default limits, %s', (_label, input, expected) => {
    expect(interpretLandmarker(output(input))).toEqual(expected);
  });

  it('reads a turned head', () => {
    expect(interpretLandmarker(output({ yaw: 60 }), limits)).toEqual({ face: true, eyesClosed: false, headAway: true });
  });

  it('reads no face', () => {
    expect(interpretLandmarker(output({ faces: 0 }), limits)).toEqual(NO_FACE);
  });
});

describe('lookToSample', () => {
  it('counts any face as someone there when the eyes-and-head check is off', () => {
    expect(lookToSample({ face: true, eyesClosed: true, headAway: true }, false)).toEqual({ faceSeen: true });
  });

  it('counts nothing as no one there, with the check on or off', () => {
    expect(lookToSample(NO_FACE, false)).toEqual({ faceSeen: false });
    expect(lookToSample(NO_FACE, true)).toEqual({ faceSeen: false });
  });

  it('with the check on: a plain face is someone studying', () => {
    expect(lookToSample(FACE, true)).toEqual({ faceSeen: true });
  });

  it('with the check on: closed eyes and a turned head say why', () => {
    expect(lookToSample({ face: true, eyesClosed: true, headAway: false }, true)).toEqual({ faceSeen: false, why: 'eyes_closed' });
    expect(lookToSample({ face: true, eyesClosed: false, headAway: true }, true)).toEqual({ faceSeen: false, why: 'looking_away' });
  });

  it('with both wrong, closed eyes are reported first', () => {
    expect(lookToSample({ face: true, eyesClosed: true, headAway: true }, true).why).toBe('eyes_closed');
  });
});
