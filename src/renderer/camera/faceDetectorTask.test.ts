import { describe, expect, it } from 'vitest';
import { wrapFaceTask, wrapLandmarkerTask, type FaceTask, type LandmarkerTask } from './faceDetectorTask';
import { FACE, NO_FACE, type LandmarkerOutput } from './faceLook';

const video = (width = 320, height = 240) => ({ videoWidth: width, videoHeight: height }) as HTMLVideoElement;

/** A canvas stand-in that records what was drawn on it and what size it had when it was looked at. */
function fakeCanvasFactory(options: { context?: boolean } = {}) {
  const made: { width: number; height: number; drawn: unknown[]; widthWhenLookedAt?: number }[] = [];
  const makeCanvas = () => {
    const canvas = {
      width: 300,
      height: 150,
      drawn: [] as unknown[],
      getContext: () =>
        options.context === false ? null : { drawImage: (source: unknown) => canvas.drawn.push(source) },
    };
    made.push(canvas);
    return canvas as unknown as HTMLCanvasElement;
  };
  return { makeCanvas, made };
}

function fakeTask(detections: readonly unknown[] = []) {
  const seen: { drawn: number; width: number; height: number }[] = [];
  let closed = 0;
  const task: FaceTask = {
    detect: (image) => {
      const c = image as unknown as { drawn: unknown[]; width: number; height: number };
      seen.push({ drawn: c.drawn.length, width: c.width, height: c.height });
      return { detections };
    },
    close: () => {
      closed++;
    },
  };
  return { task, seen, closed: () => closed };
}

describe('wrapFaceTask', () => {
  it('says yes when the task found a face, and no when it found none', async () => {
    expect(await wrapFaceTask(fakeTask([{}]).task, fakeCanvasFactory().makeCanvas).look(video())).toEqual(FACE);
    expect(await wrapFaceTask(fakeTask([{}, {}]).task, fakeCanvasFactory().makeCanvas).look(video())).toEqual(FACE);
    expect(await wrapFaceTask(fakeTask([]).task, fakeCanvasFactory().makeCanvas).look(video())).toEqual(NO_FACE);
  });

  it('shows the task the frame on a canvas of the same size as the video, not the video itself', async () => {
    const { task, seen } = fakeTask([{}]);
    const frame = video(320, 240);
    const factory = fakeCanvasFactory();
    await wrapFaceTask(task, factory.makeCanvas).look(frame);
    expect(seen).toEqual([{ drawn: 1, width: 320, height: 240 }]);
    expect(factory.made[0]?.drawn).toEqual([frame]);
  });

  it('empties the canvas straight after looking, so the picture is not kept', async () => {
    const factory = fakeCanvasFactory();
    await wrapFaceTask(fakeTask([{}]).task, factory.makeCanvas).look(video());
    expect(factory.made).toHaveLength(1);
    expect(factory.made[0]).toMatchObject({ width: 0, height: 0 });
  });

  it('uses a fresh canvas for every look, so nothing carries over from one frame to the next', async () => {
    const factory = fakeCanvasFactory();
    const detector = wrapFaceTask(fakeTask([]).task, factory.makeCanvas);
    await detector.look(video());
    await detector.look(video());
    expect(factory.made).toHaveLength(2);
    expect(factory.made[0]).not.toBe(factory.made[1]);
  });

  it('does not run the task, or make a canvas, before the camera has a picture', async () => {
    const { task, seen } = fakeTask([{}]);
    const factory = fakeCanvasFactory();
    const detector = wrapFaceTask(task, factory.makeCanvas);
    expect(await detector.look(video(0, 0))).toEqual(NO_FACE);
    expect(await detector.look(video(320, 0))).toEqual(NO_FACE);
    expect(seen).toEqual([]);
    expect(factory.made).toEqual([]);
  });

  it('closes the task', () => {
    const { task, closed } = fakeTask();
    wrapFaceTask(task, fakeCanvasFactory().makeCanvas).close();
    expect(closed()).toBe(1);
  });

  it('still empties the canvas when the task fails, and passes the failure on', () => {
    const factory = fakeCanvasFactory();
    const task: FaceTask = {
      detect: () => {
        throw new Error('wasm crashed');
      },
      close: () => undefined,
    };
    expect(() => wrapFaceTask(task, factory.makeCanvas).look(video())).toThrow('wasm crashed');
    expect(factory.made[0]).toMatchObject({ width: 0, height: 0 });
  });

  it('reports a canvas that cannot be drawn on, and empties it', async () => {
    const factory = fakeCanvasFactory({ context: false });
    await expect(wrapFaceTask(fakeTask([{}]).task, factory.makeCanvas).look(video())).rejects.toThrow(/canvas/i);
    expect(factory.made[0]).toMatchObject({ width: 0, height: 0 });
  });
});

describe('wrapLandmarkerTask', () => {
  const upright = { data: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] };
  const result = (blink: number, matrix = upright): LandmarkerOutput => ({
    faceLandmarks: [[]],
    faceBlendshapes: [{ categories: [{ categoryName: 'eyeBlinkLeft', score: blink }, { categoryName: 'eyeBlinkRight', score: blink }] }],
    facialTransformationMatrixes: [matrix],
  });

  function landmarker(output: LandmarkerOutput) {
    const seen: { drawn: number }[] = [];
    let closed = 0;
    const task: LandmarkerTask = {
      detect: (image) => {
        seen.push({ drawn: (image as unknown as { drawn: unknown[] }).drawn.length });
        return output;
      },
      close: () => {
        closed++;
      },
    };
    return { task, seen, closed: () => closed };
  }

  it('reads a face with open eyes and a straight head', async () => {
    const { task, seen } = landmarker(result(0.05));
    expect(await wrapLandmarkerTask(task, fakeCanvasFactory().makeCanvas).look(video())).toEqual(FACE);
    expect(seen).toEqual([{ drawn: 1 }]);
  });

  it('reads closed eyes', async () => {
    const look = await wrapLandmarkerTask(landmarker(result(0.9)).task, fakeCanvasFactory().makeCanvas).look(video());
    expect(look).toEqual({ face: true, eyesClosed: true, headAway: false });
  });

  it('reads no face', async () => {
    const none: LandmarkerOutput = { faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: [] };
    expect(await wrapLandmarkerTask(landmarker(none).task, fakeCanvasFactory().makeCanvas).look(video())).toEqual(NO_FACE);
  });

  it('applies the limits it is given', async () => {
    const strict = { eyesClosedAt: 0.2, readingPitchDeg: 16, yawDeg: 40, pitchDownDeg: 35, pitchUpDeg: 30 };
    const look = await wrapLandmarkerTask(landmarker(result(0.3)).task, fakeCanvasFactory().makeCanvas, strict).look(video());
    expect(look.eyesClosed).toBe(true);
  });

  it('also empties its canvas straight after looking, and does nothing before the camera has a picture', async () => {
    const factory = fakeCanvasFactory();
    const { task, seen } = landmarker(result(0.05));
    const detector = wrapLandmarkerTask(task, factory.makeCanvas);
    await detector.look(video());
    expect(factory.made[0]).toMatchObject({ width: 0, height: 0 });
    expect(await detector.look(video(0, 0))).toEqual(NO_FACE);
    expect(seen).toHaveLength(1);
  });

  it('closes the task', () => {
    const { task, closed } = landmarker(result(0));
    wrapLandmarkerTask(task, fakeCanvasFactory().makeCanvas).close();
    expect(closed()).toBe(1);
  });
});
