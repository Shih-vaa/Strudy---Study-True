// The application menu. Without a menu of our own, Electron supplies a default one that has
// Reload and Toggle Developer Tools in it, which would be a way around the lock. Pure (only a
// type comes from electron) so it can be tested.
import type { MenuItemConstructorOptions } from 'electron';

/**
 * `devTools` is true only when running from source. The installed app gets no View menu at all.
 * Edit stays because copy, paste and select-all in the password fields need it on a Mac.
 */
export function buildMenuTemplate(devTools: boolean): MenuItemConstructorOptions[] {
  const template: MenuItemConstructorOptions[] = [
    { label: 'Strudy', submenu: [{ role: 'quit', label: 'Exit Strudy' }] },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ];

  if (devTools) {
    template.push({
      label: 'View',
      submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }],
    });
  }

  // Closing goes through the same blocked path as the red button: it opens the exit dialog.
  template.push({ label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }] });
  return template;
}
