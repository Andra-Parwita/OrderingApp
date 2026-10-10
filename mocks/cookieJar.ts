// A tiny cookie jar for screen and client tests (stage 8.2). The app's session is an HttpOnly
// cookie; a real browser keeps it, but the test fetch (Node's, under MSW) does not. This wraps
// `fetch` to remember `Set-Cookie` and send `Cookie` back, so a sign-in in one call is seen by
// the next. Scripts in the page cannot read the cookie, and neither can the app code under test:
// only tests read it, through `sessionCookie()`.
let jar = new Map<string, string>();

function remember(response: Response): void {
  for (const line of response.headers.getSetCookie()) {
    const [pair = '', ...attributes] = line.split(';').map((part) => part.trim());
    const index = pair.indexOf('=');
    if (index < 1) continue;
    const name = pair.slice(0, index);
    const value = pair.slice(index + 1);
    const gone = attributes.some((a) => /^max-age=0$/i.test(a)) || value === '';
    if (gone) jar.delete(name);
    else jar.set(name, value);
  }
}

/** Starts the jar; call the returned function to put the real fetch back. */
export function installCookieJar(): () => void {
  jar = new Map();
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : {}));
    if (jar.size > 0) {
      headers.set('Cookie', [...jar].map(([name, value]) => `${name}=${value}`).join('; '));
    }
    const response = await original(input, { ...init, headers });
    remember(response);
    return response;
  };
  return () => {
    globalThis.fetch = original;
  };
}

/** Forgets every cookie (a fresh browser). */
export function clearCookies(): void {
  jar = new Map();
}

/** The session token the browser would hold, or null. Tests only. */
export function sessionCookie(): string | null {
  return jar.get('__Host-session') ?? null;
}
