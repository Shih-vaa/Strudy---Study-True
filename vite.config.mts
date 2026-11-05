import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { CSP } from './src/shared/csp';

// The strict CSP (src/shared/csp.ts) is applied at build time only: the dev server needs
// inline scripts and a websocket for hot reload.
const injectCsp = (): Plugin => ({
  name: 'strudy-inject-csp',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
      injectTo: 'head-prepend',
    },
  ],
});

export default defineConfig({
  root: resolve(import.meta.dirname, 'src/renderer'),
  base: './',
  plugins: [react(), injectCsp()],
  server: { port: 5173, strictPort: true },
  build: {
    outDir: resolve(import.meta.dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
});
