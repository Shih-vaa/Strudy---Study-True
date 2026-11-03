import type { StrudyApi } from '../shared/types';

declare global {
  interface Window {
    /** Exposed by the preload script via contextBridge. */
    api: StrudyApi;
  }
}
