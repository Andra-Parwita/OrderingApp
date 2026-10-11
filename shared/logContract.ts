// Plan 026: the client error log. What an entry holds, and nothing else (D-007): no names, notes,
// order codes, tokens, IPs or cookies. The client scrubs before sending and the server scrubs again.
import { isOneOf, isRecord } from './parse';
import { isValidSlug } from './seller';

export const LOG_APPS = ['seller', 'customer', 'admin'] as const;
export const LOG_KINDS = ['api_error', 'js_error', 'unhandled_rejection', 'passkey_error'] as const;
export type LogApp = (typeof LOG_APPS)[number];
export type LogKind = (typeof LOG_KINDS)[number];

/** The newest entries kept on the server. */
export const LOG_KEEP = 500;
/** Largest request body, and entries per request. */
export const LOG_BODY_MAX_BYTES = 2048;
export const LOG_ENTRIES_PER_CALL = 5;
/** Entries one page load may send. */
export const LOG_PER_PAGE_LOAD = 20;
/** Per client: this many calls in this many seconds. */
export const LOG_RATE_MAX = 20;
export const LOG_RATE_WINDOW_SECONDS = 600;

export const LOG_MESSAGE_MAX = 300;
const VERSION_MAX = 40;
const PATH_MAX = 80;
const CODE_MAX = 40;
const AGENT_MAX = 40;

/** One entry as sent by a device (the server adds the time). */
export type LogEntryInput = {
  app: LogApp;
  version: string;
  slug: string | null;
  path: string;
  kind: LogKind;
  code: string;
  message: string;
  agent: string;
  standalone: boolean;
};
export type LogRequest = { entries: Array<LogEntryInput> };

/** An entry as stored. */
export type LogEntry = LogEntryInput & { id: number; at: string };

const EMAIL = /[^\s@]+@[^\s@]+/g;
const TOKEN_PARAM = /token=[\s\S]*/gi;
// A phone-like run: 7 or more digits, with the usual separators between them.
const DIGITS = /\+?\d(?:[\s().-]?\d){6,}/g;
// Long opaque strings (tokens, keys): 20 or more letters, digits, - or _ containing a digit.
const OPAQUE = /\b(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{20,}\b/g;

/** A free-text message with emails, phone-like digit runs, tokens and anything after `token=` removed. */
export function scrubMessage(text: string): string {
  return text
    .replace(TOKEN_PARAM, 'token=*')
    .replace(EMAIL, '*')
    .replace(OPAQUE, '*')
    .replace(DIGITS, '*')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LOG_MESSAGE_MAX);
}

const ORDER_CODE_SHAPE = /^[A-HJ-NP-Z2-9]{3}-?[A-HJ-NP-Z2-9]{3}$/;

// A page path with tokens and order codes removed: "/o/<token>/qr" becomes "/o/*/qr"; query and hash dropped.
export function scrubPath(path: string): string {
  const bare = (path.split(/[?#]/)[0] ?? '').slice(0, 200);
  const parts = bare.split('/');
  const out = parts.map((part, index) => {
    if (index === 2 && parts[1] === 'o') return '*';
    // Order codes (ABC-DEF): the segment after "orders", and any segment shaped like a code.
    if (index > 0 && parts[index - 1] === 'orders' && part !== '') return '*';
    if (ORDER_CODE_SHAPE.test(part)) return '*';
    return /^[A-Za-z0-9_-]{20,}$/.test(part) || /^[0-9]{6,}$/.test(part) ? '*' : part;
  });
  return out.join('/').slice(0, PATH_MAX);
}

const short = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value !== '' ? value.slice(0, max) : null;

/** Cleans one entry, or null when it is not an entry. Applied on the device and again on the server. */
export function cleanEntry(input: unknown): LogEntryInput | null {
  if (!isRecord(input)) return null;
  const { app, kind, slug, standalone } = input;
  if (!isOneOf(LOG_APPS, app) || !isOneOf(LOG_KINDS, kind) || typeof standalone !== 'boolean')
    return null;
  const version = short(input['version'], VERSION_MAX);
  const path = typeof input['path'] === 'string' ? scrubPath(input['path']) : null;
  const code = short(input['code'], CODE_MAX);
  const agent = short(input['agent'], AGENT_MAX);
  if (!version || !path || !code || !agent || typeof input['message'] !== 'string') return null;
  return {
    app,
    version,
    slug: isValidSlug(slug) ? slug : null,
    path,
    kind,
    code: scrubMessage(code),
    message: scrubMessage(input['message']),
    agent: scrubMessage(agent),
    standalone,
  };
}

/** Up to 5 cleaned entries, or null when the body is not `{ entries: [...] }` with 1 to 5 entries. */
export function parseLogRequest(input: unknown): LogRequest | null {
  if (!isRecord(input) || !Array.isArray(input['entries'])) return null;
  const raw = input['entries'] as Array<unknown>;
  if (raw.length === 0 || raw.length > LOG_ENTRIES_PER_CALL) return null;
  const entries: Array<LogEntryInput> = [];
  for (const item of raw) {
    const entry = cleanEntry(item);
    if (entry) entries.push(entry);
  }
  return { entries };
}

/** Entries the admin page shows. */
export const LOG_ADMIN_LIMIT = 50;
/** GET /api/admin/log: the newest entries, newest first. */
export type LogListResponse = { entries: Array<LogEntry>; total: number };
/** The admin's filters and page: GET /api/admin/log?app=&slug=&offset= (50 per page). */
export type LogQuery = { app?: LogApp; slug?: string; offset: number };

/** Reads the query string; a bad value is ignored (no filter, offset 0). */
export function parseLogQuery(params: URLSearchParams): LogQuery {
  const app = params.get('app');
  const slug = params.get('slug');
  const offset = Number(params.get('offset') ?? 0);
  return {
    ...(isOneOf(LOG_APPS, app) ? { app } : {}),
    ...(slug && isValidSlug(slug) ? { slug } : {}),
    offset: Number.isInteger(offset) && offset >= 0 && offset <= 100_000 ? offset : 0,
  };
}

function parseLogEntry(input: unknown): LogEntry | null {
  if (!isRecord(input)) return null;
  const { id, at, slug } = input;
  const base = cleanEntry(input);
  if (!base || typeof id !== 'number' || typeof at !== 'string') return null;
  return { ...base, slug: typeof slug === 'string' ? slug : null, id, at };
}

export function parseLogListResponse(input: unknown): LogListResponse | null {
  if (!isRecord(input) || !Array.isArray(input['entries'])) return null;
  const entries: Array<LogEntry> = [];
  for (const item of input['entries'] as Array<unknown>) {
    const entry = parseLogEntry(item);
    if (!entry) return null;
    entries.push(entry);
  }
  const total = input['total'];
  return { entries, total: typeof total === 'number' ? total : entries.length };
}
