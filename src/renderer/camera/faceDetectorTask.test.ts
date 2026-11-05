import { describe, expect, it } from 'vitest';
import { wrapFaceTask, type FaceTask } from './faceDetectorTask';

const video = (width = 320, height = 240) => ({ videoWidth: width, videoHeight: height }) as HTMLVideoElement;

function fakeTask(detections: readonly unknown[] = []) {
  const calls: number[] = [];
  let closed = 0;
  const task: FaceTask = {
    detectForVideo: (_video, timestampMs) => {
      calls.push(timestampMs);
      return { detections };
    },
    close: () => {
      closed++;
    },
  };
  return { task, calls, closed: () => closed };
}

describe('wrapFaceTask', () => {
  it('says yes when the task found a face, and no when it found none', async () => {
    expect(await wrapFaceTask(fakeTask([{}]).task, () => 1000).hasFace(video())).toBe(true);
    expect(await wrapFaceTask(fakeTask([{}, {}]).task, () => 1000).hasFace(video())).toBe(true);
    expect(await wrapFaceTask(fakeTask([]).task, () => 1000).hasFace(video())).toBe(false);
  });

  it('does not run the task before the camera has a picture', async () => {
    const { task, calls } = fakeTask([{}]);
    const detector = wrapFaceTask(task, () => 1000);
    expect(await detector.hasFace(video(0, 0))).toBe(false);
    expect(await detector.hasFace(video(320, 0))).toBe(false);
    expect(calls).toEqual([]);
  });

  it('gives the task timestamps that always go up, even if the clock stands still or goes back', async () => {
    const { task, calls } = fakeTask();
    const times = [1000, 1000, 999, 2500.4, 2500.4];
    let i = 0;
    const detector = wrapFaceTask(task, () => times[i++] ?? 0);
    for (let n = 0; n < times.length; n++) await detector.hasFace(video());
    expect(calls).toEqual([1000, 1001, 1002, 2500, 2501]);
    for (let n = 1; n < calls.length; n++) expect(calls[n]!).toBeGreaterThan(calls[n - 1]!);
  });

  it('closes the task', () => {
    const { task, closed } = fakeTask();
    wrapFaceTask(task, () => 0).close();
    expect(closed()).toBe(1);
  });

  it('passes a failure of the task on, so the camera check can report it', async () => {
    const task: FaceTask = {
      detectForVideo: () => {
        throw new Error('wasm crashed');
      },
      close: () => undefined,
    };
    // hasFace is synchronous inside, so it throws before returning the promise: callers await it in a try.
    expect(() => wrapFaceTask(task, () => 1).hasFace(video())).toThrow('wasm crashed');
  });
});
