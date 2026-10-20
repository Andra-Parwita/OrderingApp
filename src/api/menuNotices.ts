import {
  parseMenuNoticeStatus,
  type MenuNoticeStatus,
  type MenuNoticeSubscribeRequest,
  type MenuNoticeUnsubscribeRequest,
} from '../../shared/menuNoticeContract';
import { parseOkResponse } from '../../shared/setupContract';
import { request, type ApiResult } from './http';

// New-menu notices (plan 112). Customers: per kitchen slug, no sign-in; the browser's endpoint and
// keys go to the server and are never shown or logged here. The owner: status and Send.

const path = (slug: string) => `/api/s/${encodeURIComponent(slug)}/menu-notices`;

/** Turns the notice on for this browser, or refreshes it after an order (safe to repeat). */
export async function subscribeMenuNotice(
  slug: string,
  body: MenuNoticeSubscribeRequest,
): Promise<ApiResult<true>> {
  const result = await request(path(slug), parseOkResponse, { method: 'POST', body });
  return result.ok ? { ok: true, data: true } : result;
}

export async function unsubscribeMenuNotice(
  slug: string,
  endpoint: MenuNoticeUnsubscribeRequest['endpoint'],
): Promise<ApiResult<true>> {
  const result = await request(path(slug), parseOkResponse, {
    method: 'DELETE',
    body: { endpoint } satisfies MenuNoticeUnsubscribeRequest,
  });
  return result.ok ? { ok: true, data: true } : result;
}

/** Owner only. */
export function fetchMenuNoticeStatus(seller?: string): Promise<ApiResult<MenuNoticeStatus>> {
  return request('/api/seller/menu-notices', parseMenuNoticeStatus, seller ? { seller } : {});
}

/** Owner only. A 409 means orders are closed or the menu already went out twice (`again` confirms). */
export function sendMenuNotice(
  again: boolean,
  seller?: string,
): Promise<ApiResult<MenuNoticeStatus>> {
  return request('/api/seller/menu-notices/send', parseMenuNoticeStatus, {
    method: 'POST',
    body: again ? { again: true } : {},
    ...(seller ? { seller } : {}),
  });
}
