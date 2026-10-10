// Shared by the API route files: error bodies with their HTTP status, and JSON body reading.
import type { ApiErrorBody, ApiErrorCode, ApiWarning } from '../../shared/apiError';
import type { AuthFail } from '../repo/Repository';

const STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  unknown_item: 400,
  not_found: 404,
  seller_not_found: 404,
  cutoff_passed: 409,
  week_not_published: 409,
  sold_out: 409,
  exceeds_remaining: 409,
  invalid_status: 409,
  order_locked: 409,
  ordering_closed: 409,
  item_has_orders: 409,
  limit_reached: 409,
  no_items: 409,
  confirm_required: 409,
  week_not_draft: 409,
  week_closed: 409,
  unknown_chef: 400,
  image_type: 400,
  image_too_big: 400,
  image_ratio: 400,
  invalid_backup: 400,
  pickup_place_limit: 409,
  menu_in_progress: 409,
  menu_not_live: 409,
  unauthorized: 401,
  forbidden: 403,
  invalid_credentials: 401,
  locked_out: 429,
  slug_taken: 409,
  admin_exists: 409,
  password_exists: 409,
  passkey_exists: 409,
  bad_origin: 403,
};

export function error(
  code: ApiErrorCode,
  message: string,
  extra: { triesLeft?: number; retryAfterSeconds?: number; warning?: ApiWarning } = {},
): Response {
  const body: ApiErrorBody = { error: code, message, ...extra };
  return Response.json(body, { status: STATUS[code] });
}

export function authError(failure: AuthFail): Response {
  return error(failure.error, failure.message, {
    ...(failure.triesLeft !== undefined ? { triesLeft: failure.triesLeft } : {}),
    ...(failure.retryAfterSeconds !== undefined
      ? { retryAfterSeconds: failure.retryAfterSeconds }
      : {}),
  });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    const body: unknown = await request.json();
    return body;
  } catch {
    return undefined;
  }
}
