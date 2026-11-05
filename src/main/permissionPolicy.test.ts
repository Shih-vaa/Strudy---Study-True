import { describe, expect, it } from 'vitest';
import { isPermissionAllowed, type PermissionRequest } from './permissionPolicy';

const camera: PermissionRequest = {
  permission: 'media',
  mediaTypes: ['video'],
  fromApp: true,
  cameraCheckOn: true,
};

describe('isPermissionAllowed', () => {
  it('lets the app use the camera when the camera check is on', () => {
    expect(isPermissionAllowed(camera)).toBe(true);
  });

  it('lets the app list devices (no capture) when the camera check is on', () => {
    expect(isPermissionAllowed({ ...camera, mediaTypes: ['unknown'] })).toBe(true);
  });

  it('refuses the camera when the owner has not switched the camera check on', () => {
    expect(isPermissionAllowed({ ...camera, cameraCheckOn: false })).toBe(false);
  });

  it('refuses anything that does not come from the app page', () => {
    expect(isPermissionAllowed({ ...camera, fromApp: false })).toBe(false);
  });

  it('never opens the microphone, alone or together with the camera', () => {
    expect(isPermissionAllowed({ ...camera, mediaTypes: ['audio'] })).toBe(false);
    expect(isPermissionAllowed({ ...camera, mediaTypes: ['video', 'audio'] })).toBe(false);
    expect(isPermissionAllowed({ ...camera, mediaTypes: ['audio', 'video'] })).toBe(false);
  });

  it('refuses a media request that says nothing about what it captures', () => {
    expect(isPermissionAllowed({ ...camera, mediaTypes: [] })).toBe(false);
  });

  it.each([
    'geolocation',
    'notifications',
    'clipboard-read',
    'display-capture',
    'midi',
    'openExternal',
    'fullscreen',
    'pointerLock',
    'idle-detection',
    'hid',
    'serial',
  ])('refuses %s, whatever else is true', (permission) => {
    expect(isPermissionAllowed({ ...camera, permission })).toBe(false);
  });
});
