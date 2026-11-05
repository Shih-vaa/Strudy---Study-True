import { describe, expect, it } from 'vitest';
import { wrapFaceTask, type FaceTask } from './faceDetectorTask';

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
    expect(await wrapFaceTask(fakeTask([{}]).task, fakeCanvasFactory().makeCanvas).hasFace(video())).toBe(true);
    expect(await wrapFaceTask(fakeTask([{}, {}]).task, fakeCanvasFactory().makeCanvas).hasFace(video())).toBe(true);
    expect(await wrapFaceTask(fakeTask([]).task, fakeCanvasFactory().makeCanvas).hasFace(video())).toBe(false);
  });

  it('shows the task the frame on a canvas of the same size as the video, not the video itself', async () => {
    const { task, seen } = fakeTask([{}]);
    const frame = video(320, 240);
    const factory = fakeCanvasFactory();
    await wrapFaceTask(task, factory.makeCanvas).hasFace(frame);
    expect(seen).toEqual([{ drawn: 1, width: 320, height: 240 }]);
    expect(factory.made[0]?.drawn).toEqual([frame]);
  });

  it('empties the canvas straight after looking, so the picture is not kept', async () => {
    const factory = fakeCanvasFactory();
    await wrapFaceTask(fakeTask([{}]).task, factory.makeCanvas).hasFace(video());
    expect(factory.made).toHaveLength(1);
    expect(factory.made[0]).toMatchObject({ width: 0, height: 0 });
  });

  it('uses a fresh canvas for every look, so nothing carries over from one frame to the next', async () => {
    const factory = fakeCanvasFactory();
    const detector = wrapFaceTask(fakeTask([]).task, factory.makeCanvas);
    await detector.hasFace(video());
    await detector.hasFace(video());
    expect(factory.made).toHaveLength(2);
    expect(factory.made[0]).not.toBe(factory.made[1]);
  });

  it('does not run the task, or make a canvas, before the camera has a picture', async () => {
    const { task, seen } = fakeTask([{}]);
    const factory = fakeCanvasFactory();
    const detector = wrapFaceTask(task, factory.makeCanvas);
    expect(await detector.hasFace(video(0, 0))).toBe(false);
    expect(await detector.hasFace(video(320, 0))).toBe(false);
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
    expect(() => wrapFaceTask(task, factory.makeCanvas).hasFace(video())).toThrow('wasm crashed');
    expect(factory.made[0]).toMatchObject({ width: 0, height: 0 });
  });

  it('reports a canvas that cannot be drawn on, and empties it', async () => {
    const factory = fakeCanvasFactory({ context: false });
    await expect(wrapFaceTask(fakeTask([{}]).task, factory.makeCanvas).hasFace(video())).rejects.toThrow(/canvas/i);
    expect(factory.made[0]).toMatchObject({ width: 0, height: 0 });
  });
});
