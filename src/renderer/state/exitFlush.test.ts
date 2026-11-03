import { describe, expect, it } from 'vitest';
import { flushForExit, registerExitFlush } from './exitFlush';

describe('exit flush registry', () => {
  it('runs every registered flusher and waits for async ones', async () => {
    const done: string[] = [];
    const offA = registerExitFlush(() => {
      done.push('sync');
    });
    const offB = registerExitFlush(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      done.push('async');
    });
    await flushForExit();
    expect(done.sort()).toEqual(['async', 'sync']);
    offA();
    offB();
  });

  it('stops running a flusher once it is unregistered', async () => {
    let calls = 0;
    const off = registerExitFlush(() => {
      calls += 1;
    });
    await flushForExit();
    off();
    await flushForExit();
    expect(calls).toBe(1);
  });

  it('keeps going when a flusher throws or rejects', async () => {
    let reached = false;
    const offBad = registerExitFlush(() => {
      throw new Error('boom');
    });
    const offReject = registerExitFlush(() => Promise.reject(new Error('nope')));
    const offGood = registerExitFlush(() => {
      reached = true;
    });
    await expect(flushForExit()).resolves.toBeUndefined();
    expect(reached).toBe(true);
    offBad();
    offReject();
    offGood();
  });

  it('is fine with nothing registered', async () => {
    await expect(flushForExit()).resolves.toBeUndefined();
  });
});
