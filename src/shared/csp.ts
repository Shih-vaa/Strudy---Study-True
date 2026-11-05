// The Content Security Policy of the packaged renderer (vite.config.mts puts it in index.html at
// build time). It lives here so a test can pin it down: it must never name a remote host.
//
// The camera check's face detector is WebAssembly, which needs 'wasm-unsafe-eval' (it allows
// compiling WebAssembly only, not eval() of text). It reads its own model and engine files with
// fetch, which needs connect-src 'self': that is this app's own files and nothing else.
//
// The detector library also has a built-in usage logger that tries to POST to a Google address
// (odml.pa.googleapis.com) and cannot be switched off. connect-src 'self' refuses it, and so does
// the main process, which cancels every request that is not local (see blockNetworkRequests).
export const CSP_DIRECTIVES: Readonly<Record<string, string>> = {
  'default-src': "'self'",
  'script-src': "'self' 'wasm-unsafe-eval'",
  'style-src': "'self'",
  'img-src': "'self' data:",
  'media-src': "'self' strudy-media:",
  'connect-src': "'self'",
  'object-src': "'none'",
  'base-uri': "'none'",
  'form-action': "'none'",
};

export const CSP = Object.entries(CSP_DIRECTIVES)
  .map(([name, value]) => `${name} ${value}`)
  .join('; ');
