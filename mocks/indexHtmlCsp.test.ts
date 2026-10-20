import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from '../worker/securityHeaders';

// Plan 115: the live Content-Security-Policy allows no inline script and no inline handler, so
// index.html must have neither (they would be blocked: no splash removal, no theme).
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

describe('index.html under the production CSP', () => {
  it('has no inline <script> and no on* attribute', () => {
    const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, attributes] of scripts) expect(attributes).toMatch(/\bsrc=/);
    const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
    expect(withoutComments).not.toMatch(/<[a-z][^>]*\s on[a-z]+\s*=/i);
  });

  it('loads /splash.js from our own origin, which script-src allows', () => {
    expect(html).toMatch(/<script src="\/splash\.js"[^>]*><\/script>/);
    const csp = contentSecurityPolicy('https://order.example', false, 'abc');
    expect(csp).toMatch(/script-src 'self' /);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(readFileSync(resolve(process.cwd(), 'public/splash.js'), 'utf8')).toContain('splash');
  });
});
