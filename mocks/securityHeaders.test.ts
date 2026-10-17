// @vitest-environment node
// Browser security headers sit on a page response and on an API response alike.
import { describe, expect, it } from 'vitest';
import { withSecurityHeaders } from '../worker/securityHeaders';

const request = new Request('https://order.shaggybobo.app/anything');

describe('security headers', () => {
  const cases: Array<[string, Response]> = [
    ['an HTML page', new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } })],
    ['an API answer', Response.json({ ok: true })],
  ];
  it.each(cases)('are on %s', (_name, response) => {
    const { headers } = withSecurityHeaders(request, response, false);
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Permissions-Policy')).toContain('camera=(self)');
    const csp = headers.get('Content-Security-Policy') ?? '';
    expect(csp).toMatch(
      /script-src 'self'( 'nonce-[A-Za-z0-9+/=]{22,}')? https:\/\/static\.cloudflareinsights\.com;/,
    );
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self' wss://order.shaggybobo.app");
    expect(csp).toContain('connect-src');
    expect(csp).toContain('https://cloudflareinsights.com');
  });

  it('gives each HTML response its own script nonce, and other responses none', () => {
    const html = () =>
      withSecurityHeaders(
        request,
        new Response('<html></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
        false,
      ).headers.get('Content-Security-Policy') ?? '';
    const nonce = (csp: string) => /script-src[^;]*'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce(html())).toBeTruthy();
    expect(nonce(html())).not.toBe(nonce(html()));
    const json = withSecurityHeaders(request, Response.json({}), false).headers.get(
      'Content-Security-Policy',
    );
    expect(json).not.toContain('nonce-');
  });

  it('loosens only the script rule for local dev', () => {
    const csp = withSecurityHeaders(request, Response.json({}), true).headers.get(
      'Content-Security-Policy',
    );
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
  });
});
