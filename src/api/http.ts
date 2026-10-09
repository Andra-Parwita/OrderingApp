import { parseApiError, type ApiErrorCode } from '../../shared/apiError';
import type { StaffActor } from '../../shared/domain';

export type ApiFailure = {
  ok: false;
  /** `network`: no response; `bad_response`: a body that does not match the contract. */
  error: ApiErrorCode | 'network' | 'bad_response';
  status: number;
  message: string;
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
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (actor) headers['X-Actor'] = `${actor.role}:${actor.name}`;
  if (seller) headers['X-Seller'] = seller;
  try {
    const response = await fetch(path, {
      method,
      headers,
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
  return apiError
    ? { ok: false, error: apiError.error, status: response.status, message: apiError.message }
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
