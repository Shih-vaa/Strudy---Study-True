import { describe, expect, it } from 'vitest';
import { ipcErrorMessage } from './ipcError';

describe('ipcErrorMessage', () => {
  it('strips the IPC wrapper and keeps the message', () => {
    const error = new Error("Error invoking remote method 'store:setSettings': Error: Settings are locked");
    expect(ipcErrorMessage(error)).toBe('Settings are locked');
  });

  it('leaves an ordinary error message alone', () => {
    expect(ipcErrorMessage(new Error('Use at least 6 characters.'))).toBe('Use at least 6 characters.');
  });

  it('falls back for things that are not errors, and for empty messages', () => {
    expect(ipcErrorMessage('nope')).toBe('Something went wrong.');
    expect(ipcErrorMessage(new Error(''), 'Try again.')).toBe('Try again.');
    expect(ipcErrorMessage(undefined, 'Try again.')).toBe('Try again.');
  });
});
