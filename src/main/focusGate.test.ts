import { describe, expect, it } from 'vitest';
import { createFocusGate } from './focusGate';

describe('createFocusGate', () => {
  it('is not held until a prompt opens, and not held again once it closes', () => {
    const gate = createFocusGate();
    expect(gate.held).toBe(false);
    const release = gate.hold();
    expect(gate.held).toBe(true);
    expect(release()).toBe(true);
    expect(gate.held).toBe(false);
  });

  it('stays held until the last of several prompts closes, and only that one says it was the last', () => {
    const gate = createFocusGate();
    const first = gate.hold();
    const second = gate.hold();
    expect(first()).toBe(false);
    expect(gate.held).toBe(true);
    expect(second()).toBe(true);
    expect(gate.held).toBe(false);
  });

  it('ignores a prompt being released twice, so a double release cannot unbalance it', () => {
    const gate = createFocusGate();
    const first = gate.hold();
    const second = gate.hold();
    expect(first()).toBe(false);
    expect(first()).toBe(false);
    expect(gate.held).toBe(true);
    expect(second()).toBe(true);
    expect(second()).toBe(false);
    expect(gate.held).toBe(false);
  });

  it('can be held again after it has been released', () => {
    const gate = createFocusGate();
    gate.hold()();
    expect(gate.held).toBe(false);
    const again = gate.hold();
    expect(gate.held).toBe(true);
    expect(again()).toBe(true);
  });
});
