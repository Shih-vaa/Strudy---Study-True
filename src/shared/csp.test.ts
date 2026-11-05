import { describe, expect, it } from 'vitest';
import { CSP, CSP_DIRECTIVES } from './csp';

describe('the renderer Content Security Policy', () => {
  it('never names a remote host, a scheme that reaches one, or a wildcard', () => {
    expect(CSP).not.toMatch(/https?:|wss?:|ftp:|\*/);
    expect(CSP).not.toMatch(/\/\//);
    expect(CSP).not.toMatch(/\.(com|net|org|io|dev)\b/);
  });

  it('lets the page connect only to its own files', () => {
    expect(CSP_DIRECTIVES['connect-src']).toBe("'self'");
  });

  it('allows WebAssembly to compile but not eval() or inline script', () => {
    expect(CSP_DIRECTIVES['script-src']).toBe("'self' 'wasm-unsafe-eval'");
    expect(CSP).not.toContain('unsafe-inline');
    expect(CSP.replace(/wasm-unsafe-eval/g, '')).not.toContain('unsafe-eval');
  });

  it('keeps everything else closed', () => {
    expect(CSP_DIRECTIVES['default-src']).toBe("'self'");
    expect(CSP_DIRECTIVES['object-src']).toBe("'none'");
    expect(CSP_DIRECTIVES['form-action']).toBe("'none'");
    expect(CSP_DIRECTIVES['base-uri']).toBe("'none'");
  });

  it('is written as one header-style string', () => {
    expect(CSP.startsWith("default-src 'self'; ")).toBe(true);
    expect(CSP.endsWith("form-action 'none'")).toBe(true);
  });
});
