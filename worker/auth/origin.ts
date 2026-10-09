// CSRF defence, second layer (stage 8.2): a state-changing call to the signed-in areas must say it
// came from this very site. Browsers always send `Origin` on POST/PUT/PATCH/DELETE, so a missing
// or different one is a foreign page (or a script that is not a browser) and gets 403 `bad_origin`.
// The session cookie is SameSite=Strict as well (cookie.ts). Customer endpoints (/api/<slug>,
// /api/orders) are not covered: they hold no session and customers order from a link.
import { error } from '../api/respond';

const CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const GUARDED_PREFIXES = ['/api/seller/', '/api/admin/', '/api/auth/'];
const PUSH_PATH = /^\/api\/orders\/[^/]+\/push$/;

/** The 403 to send instead of handling the request, or null when it may go on. */
export function checkOrigin(request: Request): Response | null {
  if (!CHANGING.has(request.method)) return null;
  const url = new URL(request.url);
  // Push (plan 004 stage 6) holds a browser's secrets, so it is guarded although it has no session.
  const guarded =
    GUARDED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) ||
    PUSH_PATH.test(url.pathname);
  if (!guarded) return null;
  if (request.headers.get('Origin') === url.origin) return null;
  return error('bad_origin', 'This request did not come from this site');
}
