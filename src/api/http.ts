import { parseApiError, type ApiErrorCode, type ApiWarning } from '../../shared/apiError';
import type { StaffActor } from '../../shared/domain';
import { reportApiFailure } from './clientLog';
import { DEVICE_ID_HEADER } from '../../shared/liveContract';
import { sellerDeviceId } from './deviceId';
import { dropLegacySessionToken, setSessionHint } from './device/session';
import { setMaintenanceBlocked } from './maintenanceState';
import { recordOutcome } from './netState';
import { isRetryable, retryCount, retryDelayMs } from './retryPolicy';

export type ApiFailure = {
  ok: false;
  /**
   * `network`: no response; `bad_response`: a body that does not match the contract;
   * `passkey_cancelled`: the person closed (or let time out) the browser's passkey prompt;
   * `passkey_failed`: the browser could not make or use a passkey.
   */
  error: ApiErrorCode | 'network' | 'bad_response' | 'passkey_cancelled' | 'passkey_failed';
  status: number;
  message: string;
  /** On `invalid_credentials`: tries left before the lockout. */
  triesLeft?: number;
  /** On `locked_out`: seconds until sign-in works again. */
  retryAfterSeconds?: number;
  /** On a 409 the seller can override (D-062): what is wrong; send the call again with force: true. */
  warning?: ApiWarning;
};

export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Seller calls only; becomes the X-Actor header until real auth exists (phase 4). */
  actor?: StaffActor;
  /** Seller calls only; becomes the X-Seller header (dev; phase 4 uses the session). */
  seller?: string;
};

async function send(
  path: string,
  { method = 'GET', body, actor, seller }: RequestOptions,
): Promise<{ response: Response } | ApiFailure> {
  // Before stage 8.2 the session token sat in localStorage. It is not used any more: forget it.
  dropLegacySessionToken();
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (actor) headers['X-Actor'] = `${actor.role}:${actor.name}`;
  if (seller) headers['X-Seller'] = seller;
  // Plan 074: lets this tab recognise the live event its own write causes.
  if (method !== 'GET' && path.startsWith('/api/seller/'))
    headers[DEVICE_ID_HEADER] = sellerDeviceId();
  try {
    // The session is an HttpOnly cookie the browser sends by itself (same site only); a session
    // always wins over the dev headers above.
    const response = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { response };
  } catch {
    return { ok: false, error: 'network', status: 0, message: 'Network error' };
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** `send`, repeated for a GET that got no answer, a 5xx or a 429 (retryPolicy.ts); the final result is recorded. */
async function sendWithRetry(
  path: string,
  options: RequestOptions,
): Promise<{ response: Response } | ApiFailure> {
  const method = options.method ?? 'GET';
  let sent = await send(path, options);
  for (let retry = 0; retry < retryCount(); retry += 1) {
    const status = 'ok' in sent ? sent.status : sent.response.status;
    // Plan 046: a maintenance 503 is an answer, not a fault; asking again would only add load.
    if (!('ok' in sent) && sent.response.headers.get('X-Maintenance')) break;
    if (!isRetryable(method, status)) break;
    const header = 'ok' in sent ? null : sent.response.headers.get('Retry-After');
    await wait(retryDelayMs(retry, header));
    sent = await send(path, options);
  }
  const maintenance = !('ok' in sent) && sent.response.headers.get('X-Maintenance') !== null;
  if (maintenance) setMaintenanceBlocked(true);
  // The server answered: this is not "server isn't answering" (a 409 is also an answer).
  recordOutcome(method, maintenance ? 409 : 'ok' in sent ? sent.status : sent.response.status);
  return sent;
}

async function failureOf(response: Response): Promise<ApiFailure> {
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    json = undefined;
  }
  const apiError = parseApiError(json);
  // The server no longer knows this session (expired, signed out elsewhere, revoked): forget the hint.
  if (apiError?.error === 'unauthorized') setSessionHint(false);
  if (apiError?.error !== 'maintenance') {
    reportApiFailure(response.url, response.status, apiError?.error ?? 'bad_response');
  }
  return apiError
    ? {
        ok: false,
        error: apiError.error,
        status: response.status,
        message: apiError.message,
        ...(apiError.triesLeft !== undefined ? { triesLeft: apiError.triesLeft } : {}),
        ...(apiError.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: apiError.retryAfterSeconds }
          : {}),
        ...(apiError.warning ? { warning: apiError.warning } : {}),
      }
    : {
        ok: false,
        error: 'bad_response',
        status: response.status,
        message: 'Unexpected error body',
      };
}

/** The only place in the app that calls fetch for the API. */
export async function request<T>(
  path: string,
  parse: (input: unknown) => T | null,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const sent = await sendWithRetry(path, options);
  if ('ok' in sent) return sent;
  const { response } = sent;
  if (!response.ok) return failureOf(response);
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    json = undefined;
  }
  const data = parse(json);
  return data === null
    ? {
        ok: false,
        error: 'bad_response',
        status: response.status,
        message: 'Unexpected response body',
      }
    : { ok: true, data };
}

/** Like request, for a plain-text answer such as the orders CSV. */
export async function requestText(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<string>> {
  const sent = await sendWithRetry(path, options);
  if ('ok' in sent) return sent;
  const { response } = sent;
  if (!response.ok) return failureOf(response);
  // ignoreBOM keeps the BOM in the text, so a saved file still opens right in Excel.
  const bytes = await response.arrayBuffer();
  return { ok: true, data: new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes) };
}
