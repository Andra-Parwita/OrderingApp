// Plan 089 #5: a customer can only place so many orders in a short time (junk floods, a stuck
// script). 5 per 10 minutes per kitchen per client. The client is the signed-in customer's account
// (so a family on one Wi-Fi does not block each other), else the salted network key (never the raw
// address). No address at all (dev/local) means no per-network limit. An attempt counts once the
// request is well-formed, before the order is checked, so a flood of refused orders is capped too.
// Seller-entered and private orders use other routes and are not limited.
// Local dev (DEV_TOOLS=1 only; ignored in production): every request comes from one address, so the
// limit is off unless the request carries `X-Dev-Order-Limit: on`; e2e/p089-order-limit.spec.ts
// sends it to prove the real limit and its message. Other specs place many orders freely.
import type { Repository } from '../repo/Repository';
import { customerTokenOf } from '../auth/customerCookie';
import { error } from './respond';

export const ORDER_LIMIT_MAX = 5;
export const ORDER_LIMIT_WINDOW_SECONDS = 600;
export const DEV_ORDER_LIMIT_HEADER = 'X-Dev-Order-Limit';

/** The 429 `too_many_orders` response when this client is over the limit, else null. */
export async function orderLimitResponse(
  store: Repository,
  sellerId: string,
  request: Request,
  devTools = false,
): Promise<Response | null> {
  const devSwitch = devTools && request.headers.get(DEV_ORDER_LIMIT_HEADER) === 'on';
  if (devTools && !devSwitch) return null;
  const token = customerTokenOf(request);
  const caller = token ? await store.customers.resolve(token) : undefined;
  let who: string;
  if (caller) {
    who = `acct:${caller.accountId}`;
  } else {
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip && !devSwitch) return null;
    who = ip ? `ip:${await store.auth.ipKey(ip)}` : 'ip:dev';
  }
  const wait = await store.auth.rateLimit(
    `order:${sellerId}:${who}`,
    ORDER_LIMIT_MAX,
    ORDER_LIMIT_WINDOW_SECONDS,
  );
  if (wait <= 0) return null;
  return error('too_many_orders', 'Too many orders in a short time. Please wait a few minutes.', {
    retryAfterSeconds: wait,
  });
}
