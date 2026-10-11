// Plan 026 stage 3: a small error log the app sends to the server. Entries are scrubbed here
// (shared/logContract.ts) and again on the server; no token, name, order code or full user agent
// leaves the device (D-007). Batched (up to 5 a call), at most 20 entries a page load, repeats
// dropped. Off under test.
import { appVersion } from '../../shared/buildInfo';
import {
  cleanEntry,
  LOG_ENTRIES_PER_CALL,
  LOG_PER_PAGE_LOAD,
  type LogApp,
  type LogEntryInput,
  type LogKind,
} from '../../shared/logContract';
import { isValidSlug } from '../../shared/seller';
import { lastKitchen } from './device/lastKitchen';

export type LogReport = { kind: LogKind; code: string; message: string };

export type ClientLogDeps = {
  enabled: boolean;
  /** Sends one JSON body; failures are ignored. */
  send: (body: string) => void;
  /** The device and page facts every entry carries. */
  context: () => Omit<LogEntryInput, 'kind' | 'code' | 'message'>;
  /** Runs `flush` soon; default is a short timer. */
  later?: (flush: () => void) => void;
};

/** "Safari iOS 17", "Chrome Android 126": a browser family and OS, never the whole user agent. */
export function agentOf(userAgent: string): string {
  const major = (pattern: RegExp) => pattern.exec(userAgent)?.[1] ?? '';
  const withVersion = (name: string, v: string) => (v ? `${name} ${v}` : name);
  let os = 'other';
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    os = withVersion('iOS', major(/OS (\d+)[_\d]*/));
  } else if (/Android/.test(userAgent)) {
    os = withVersion('Android', major(/Android (\d+)/));
  } else if (/Windows/.test(userAgent)) os = 'Windows';
  else if (/Mac OS X/.test(userAgent)) os = 'macOS';
  else if (/Linux/.test(userAgent)) os = 'Linux';
  let family = 'browser';
  if (/EdgA?\/|Edg\//.test(userAgent)) family = 'Edge';
  else if (/Firefox\/|FxiOS\//.test(userAgent)) family = 'Firefox';
  else if (/CriOS\/|Chrome\//.test(userAgent)) family = 'Chrome';
  else if (/Safari\//.test(userAgent)) family = 'Safari';
  return `${family} ${os}`;
}

export function createClientLog(deps: ClientLogDeps) {
  const queue: Array<LogEntryInput> = [];
  const seen = new Set<string>();
  let accepted = 0;
  let scheduled = false;
  const later = deps.later ?? ((flush: () => void) => void setTimeout(flush, 2000));

  function flush(): void {
    scheduled = false;
    while (queue.length > 0) {
      const entries = queue.splice(0, LOG_ENTRIES_PER_CALL);
      deps.send(JSON.stringify({ entries }));
    }
  }

  function report(input: LogReport): void {
    if (!deps.enabled || accepted >= LOG_PER_PAGE_LOAD) return;
    const entry = cleanEntry({ ...deps.context(), ...input });
    if (!entry) return;
    const key = [entry.kind, entry.code, entry.path, entry.message].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    accepted += 1;
    queue.push(entry);
    if (!scheduled) {
      scheduled = true;
      later(flush);
    }
  }

  return { report, flush };
}

function pageContext(): ReturnType<ClientLogDeps['context']> {
  const path = location.pathname;
  const first = path.split('/')[1] ?? '';
  const app: LogApp = first === 'admin' ? 'admin' : first === 'seller' ? 'seller' : 'customer';
  const slug = isValidSlug(first) ? first : lastKitchen();
  const standalone =
    (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    app,
    version: appVersion(),
    slug,
    path,
    agent: agentOf(navigator.userAgent),
    standalone,
  };
}

function sendBody(body: string): void {
  try {
    const blob = new Blob([body], { type: 'application/json' });
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon('/api/log', blob))
      return;
    void fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // The log must never cause an error of its own.
  }
}

const log = createClientLog({
  enabled: import.meta.env.MODE !== 'test',
  send: sendBody,
  context: pageContext,
});

/** Hooks window errors, unhandled rejections and a page hide (flushes the batch). Call once. */
export function startClientLog(): void {
  window.addEventListener('error', (event) => {
    log.report({
      kind: 'js_error',
      code: event.error instanceof Error ? event.error.name : 'Error',
      message: event.message,
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    log.report({
      kind: 'unhandled_rejection',
      code: reason instanceof Error ? reason.name : 'Rejection',
      message: reason instanceof Error ? reason.message : String(reason),
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') log.flush();
  });
}

/**
 * An API answer that failed: status 500 or more, or `invalid_request` on a sign-in call. Only the
 * status and error code are logged; the address is not (it can hold a token).
 */
export function reportApiFailure(url: string, status: number, error: string): void {
  let pathname = '';
  try {
    pathname = new URL(url, location.origin).pathname;
  } catch {
    // no address: only the status counts
  }
  if (pathname === '/api/log') return;
  const authInvalid = error === 'invalid_request' && pathname.startsWith('/api/auth/');
  if (status < 500 && !authInvalid) return;
  log.report({ kind: 'api_error', code: error, message: `HTTP ${String(status)} ${error}` });
}

/** A passkey prompt that failed for a real reason (not a closed prompt). */
export function reportPasskeyError(name: string, message: string): void {
  log.report({ kind: 'passkey_error', code: name || 'Error', message });
}
