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
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT';
  body?: unknown;
  /** Seller calls only; becomes the X-Actor header until real auth exists (phase 4). */
  actor?: StaffActor;
};

/** The only place in the app that calls fetch for the API. */
export async function request<T>(
  path: string,
  parse: (input: unknown) => T | null,
  { method = 'GET', body, actor }: RequestOptions = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (actor) headers['X-Actor'] = `${actor.role}:${actor.name}`;
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    return { ok: false, error: 'network', status: 0, message: 'Network error' };
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    json = undefined;
  }
  if (!response.ok) {
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
