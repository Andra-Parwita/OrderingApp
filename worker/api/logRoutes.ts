// POST /api/log (plan 026 stage 2): devices send a few short, scrubbed error entries. The body is
// capped, every entry is cleaned again here (never trust the client), and a client address is only
// kept as a hash for the rate limit. It always answers 204, even when it drops what was sent.
import {
  LOG_ADMIN_LIMIT,
  LOG_BODY_MAX_BYTES,
  LOG_RATE_MAX,
  LOG_RATE_WINDOW_SECONDS,
  parseLogQuery,
  parseLogRequest,
  type LogListResponse,
} from '../../shared/logContract';
import type { Repository } from '../repo/Repository';
import { requireSession } from './authRoutes';
import { error } from './respond';

const NO_CONTENT = () => new Response(null, { status: 204 });

/** Null when the path is not the log's. */
export async function handleLog(store: Repository, request: Request): Promise<Response | null> {
  if (new URL(request.url).pathname !== '/api/log') return null;
  if (request.method !== 'POST') return null;
  // Same-site only, as for the signed-in areas (worker/auth/origin.ts).
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    return error('bad_origin', 'This request did not come from this site');
  }
  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > LOG_BODY_MAX_BYTES) return NO_CONTENT();
  const text = await request.text();
  if (new TextEncoder().encode(text).length > LOG_BODY_MAX_BYTES) return NO_CONTENT();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return NO_CONTENT();
  }
  const parsed = parseLogRequest(json);
  if (!parsed || parsed.entries.length === 0) return NO_CONTENT();
  const client = await store.auth.ipKey(request.headers.get('CF-Connecting-IP'));
  const wait = await store.auth.rateLimit(`log:${client}`, LOG_RATE_MAX, LOG_RATE_WINDOW_SECONDS);
  if (wait > 0) return NO_CONTENT();
  await store.log.record(parsed.entries);
  return NO_CONTENT();
}

/**
 * GET /api/admin/log?app=&slug=&offset=: one page (50) of the newest entries for the admin's page.
 * DELETE /api/admin/log: clears the log. Admin session only.
 */
export async function handleAdminLog(store: Repository, request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'DELETE') {
    return error('not_found', 'Not found');
  }
  const session = await requireSession(store, request);
  if ('response' in session) return session.response;
  if (session.caller.role !== 'admin') return error('forbidden', 'Admins only');
  if (request.method === 'DELETE') {
    await store.log.clear();
    return Response.json({ ok: true });
  }
  const page = await store.log.list(
    parseLogQuery(new URL(request.url).searchParams),
    LOG_ADMIN_LIMIT,
  );
  return Response.json(page satisfies LogListResponse);
}
