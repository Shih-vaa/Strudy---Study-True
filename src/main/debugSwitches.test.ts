import { describe, expect, it } from 'vitest';
import { findDebugSwitch } from './debugSwitches';

describe('findDebugSwitch', () => {
  it.each([
    '--remote-debugging-port=9222',
    '--remote-debugging-pipe',
    '--remote-debugging-address=0.0.0.0',
    '--remote-allow-origins=*',
    '--inspect',
    '--inspect=9229',
    '--inspect-brk',
    '--inspect-brk=9229',
    '--inspect-wait',
    '--debug-port=5858',
  ])('finds %s', (arg) => {
    expect(findDebugSwitch(['/Applications/Strudy.app/Contents/MacOS/Strudy', arg])).toBe(arg);
  });

  it('finds it anywhere in the arguments and returns the first one', () => {
    expect(findDebugSwitch(['strudy', '--foo', '--inspect=1', '--remote-debugging-port=2'])).toBe('--inspect=1');
  });

  it('is null for an ordinary launch', () => {
    expect(findDebugSwitch(['/Applications/Strudy.app/Contents/MacOS/Strudy'])).toBeNull();
    expect(findDebugSwitch([])).toBeNull();
  });

  it('leaves harmless switches and paths alone', () => {
    expect(
      findDebugSwitch(['strudy', '--user-data-dir=/tmp/profile', '--disable-gpu', '/Users/me/inspect/lecture.mp4', '-psn_0_12345']),
    ).toBeNull();
  });

  it('does not match a switch that merely contains the word', () => {
    expect(findDebugSwitch(['strudy', '--my-inspect', '--no-remote-debugging-port'])).toBeNull();
  });
});
