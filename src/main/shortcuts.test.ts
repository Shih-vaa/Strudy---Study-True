import { describe, expect, it } from 'vitest';
import { isBlockedShortcut } from './shortcuts';

const key = (
  code: string,
  mods: Partial<{ control: boolean; alt: boolean; shift: boolean; meta: boolean }> = {},
  type: 'keyDown' | 'keyUp' = 'keyDown',
) => ({ type, code, control: false, alt: false, shift: false, meta: false, ...mods });

describe('reload shortcuts are blocked', () => {
  it.each([
    ['Cmd+R', key('KeyR', { meta: true })],
    ['Cmd+Shift+R', key('KeyR', { meta: true, shift: true })],
    ['Ctrl+R', key('KeyR', { control: true })],
    ['Ctrl+Shift+R', key('KeyR', { control: true, shift: true })],
    ['F5', key('F5')],
    ['Ctrl+F5', key('F5', { control: true })],
    ['Shift+F5', key('F5', { shift: true })],
  ])('%s', (_name, input) => {
    expect(isBlockedShortcut(input)).toBe(true);
  });
});

describe('DevTools shortcuts are blocked', () => {
  it.each([
    ['Cmd+Option+I (macOS)', key('KeyI', { meta: true, alt: true })],
    ['Cmd+Option+J (macOS console)', key('KeyJ', { meta: true, alt: true })],
    ['Cmd+Option+C (macOS inspect)', key('KeyC', { meta: true, alt: true })],
    ['Ctrl+Shift+I', key('KeyI', { control: true, shift: true })],
    ['Ctrl+Shift+J', key('KeyJ', { control: true, shift: true })],
    ['Ctrl+Shift+C', key('KeyC', { control: true, shift: true })],
    ['F12', key('F12')],
  ])('%s', (_name, input) => {
    expect(isBlockedShortcut(input)).toBe(true);
  });
});

describe('everything else still works', () => {
  it.each([
    ['plain R (the replay key)', key('KeyR')],
    ['Shift+R', key('KeyR', { shift: true })],
    ['Cmd+C (copy)', key('KeyC', { meta: true })],
    ['Ctrl+C (copy)', key('KeyC', { control: true })],
    ['Cmd+V (paste)', key('KeyV', { meta: true })],
    ['Cmd+A (select all)', key('KeyA', { meta: true })],
    ['Cmd+Z (undo)', key('KeyZ', { meta: true })],
    ['Cmd+I on its own', key('KeyI', { meta: true })],
    ['Ctrl+I on its own', key('KeyI', { control: true })],
    ['Option+I on its own', key('KeyI', { alt: true })],
    ['Cmd+Option+R (not reload)', key('KeyR', { meta: true, alt: true })],
    ['Space (play/pause)', key('Space')],
    ['Arrow keys', key('ArrowRight')],
    ['F4', key('F4')],
    ['F6', key('F6')],
    ['Enter', key('Enter')],
  ])('%s', (_name, input) => {
    expect(isBlockedShortcut(input)).toBe(false);
  });

  it('only looks at key presses, not releases', () => {
    expect(isBlockedShortcut(key('KeyR', { meta: true }, 'keyUp'))).toBe(false);
    expect(isBlockedShortcut(key('F12', {}, 'keyUp'))).toBe(false);
  });
});

describe('it goes by the physical key, so a Mac Option+I that types another character is still caught', () => {
  it('matches on code, not on the typed character', () => {
    // On a Mac, Cmd+Option+I types "ˆ" but the physical key is still KeyI.
    expect(isBlockedShortcut({ ...key('KeyI', { meta: true, alt: true }) })).toBe(true);
  });
});
