// Plan 087: placing a customer order, with the optional Remember me session. A valid full session
// makes the order "confirmed" with the account's per-kitchen code; no cookie, a bad or expired one,
// or a phone that only joined by code (setup) places the order normally. It never refuses.
import type { CreateOrderRequest } from '../../shared/orderContract';
import type { SellerOrder } from '../../shared/domain';
import { customerTokenOf } from '../auth/customerCookie';
import type { Repository, SellerRepository, StoreResult } from '../repo/Repository';

export async function placeCustomerOrder(
  store: Repository,
  sellerStore: SellerRepository,
  request: Request,
  input: CreateOrderRequest,
): Promise<StoreResult<SellerOrder>> {
  const token = customerTokenOf(request);
  const caller = token ? await store.customers.resolve(token) : undefined;
  if (!caller || caller.setup) return sellerStore.createOrder(input);
  const me = await store.customers.me(caller, sellerStore.seller.id);
  const created = await sellerStore.createOrder(
    me.customerCode ? { ...input, customerCode: me.customerCode } : input,
  );
  if (!created.ok) return created;
  const confirmed = await store.customers.confirmOrder(caller, created.value);
  return confirmed ? { ok: true, value: confirmed } : created;
}
