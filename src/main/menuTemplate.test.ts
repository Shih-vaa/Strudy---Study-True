import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it } from 'vitest';
import { buildMenuTemplate } from './menuTemplate';

/** Every role in the menu, however deeply nested. */
function roles(items: readonly MenuItemConstructorOptions[]): string[] {
  return items.flatMap((item) => [
    ...(item.role ? [item.role] : []),
    ...(Array.isArray(item.submenu) ? roles(item.submenu) : []),
  ]);
}

const labels = (items: readonly MenuItemConstructorOptions[]) => items.map((item) => item.label);

describe('the installed app menu (no dev tools)', () => {
  const template = buildMenuTemplate(false);

  it('has no way to reload or open DevTools', () => {
    const all = roles(template);
    for (const forbidden of ['reload', 'forceReload', 'toggleDevTools']) expect(all).not.toContain(forbidden);
  });

  it('has no View menu at all', () => {
    expect(labels(template)).not.toContain('View');
  });

  it('keeps copy, paste and select-all for the password fields', () => {
    const all = roles(template);
    for (const needed of ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll']) expect(all).toContain(needed);
  });

  it('keeps Quit and Close, which go through the exit-password dialog', () => {
    const all = roles(template);
    expect(all).toContain('quit');
    expect(all).toContain('close');
  });

  it('does not offer Hide, which would be a way out of sight', () => {
    expect(roles(template)).not.toContain('hide');
    expect(roles(template)).not.toContain('hideOthers');
  });
});

describe('the development menu (running from source)', () => {
  const template = buildMenuTemplate(true);

  it('adds a View menu with reload and DevTools', () => {
    expect(labels(template)).toContain('View');
    const all = roles(template);
    for (const wanted of ['reload', 'forceReload', 'toggleDevTools']) expect(all).toContain(wanted);
  });

  it('is otherwise the same as the installed one', () => {
    const withoutView = template.filter((item) => item.label !== 'View');
    expect(withoutView).toEqual(buildMenuTemplate(false));
  });
});
