import { parseApiError, type ApiErrorCode, type ApiWarning } from '../../shared/apiError';
import type { StaffActor } from '../../shared/domain';
import { dropLegacySessionToken, setSessionHint } from './device/session';

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
  const sent = await send(path, options);
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
  const sent = await send(path, options);
  if ('ok' in sent) return sent;
  const { response } = sent;
  if (!response.ok) return failureOf(response);
  // ignoreBOM keeps the BOM in the text, so a saved file still opens right in Excel.
  const bytes = await response.arrayBuffer();
  return { ok: true, data: new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes) };
}
