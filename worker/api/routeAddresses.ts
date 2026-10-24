// Delivery addresses on the order answers (plan 071, D-099): the customer's narrowed view, the
// encrypted store write, and the team-side decoration. Split out of routes.ts (plan 098 C1).
import type { CustomerOrder, OrderAddress, SellerOrder } from '../../shared/domain';
import { parseDeliveryAddress, type DeliveryAddress } from '../../shared/address';
import { toCustomerOrder, type CustomerOrderResponse } from '../../shared/orderContract';
import { isRecord } from '../../shared/parse';
import { decryptAddress, encryptAddress } from '../db/address';
import type { SellerRepository, StoreResult } from '../repo/Repository';
import { refusal, safeParse, type RouteContext } from './routeKit';

/**
 * Customer endpoints return the narrowed view (with the seller), never the seller-only fields. Plan
 * 071: whether the kitchen holds an address for the order (`addressState`), never the address.
 */
export async function customerResult(
  result: StoreResult<SellerOrder>,
  repo: SellerRepository,
  context: RouteContext,
  status = 200,
  /** What `storeAddress` just wrote (`null` = no address): known, so it is not read back. */
  justStored?: string | null,
): Promise<Response> {
  if (!result.ok) return refusal(result);
  const order = toCustomerOrder(result.value, repo.seller);
  const stored =
    justStored !== undefined
      ? (justStored ?? undefined)
      : (await repo.orderAddresses([result.value.code])).get(result.value.code);
  let addressState: CustomerOrder['addressState'];
  if (stored !== undefined) {
    addressState =
      (await decryptAddress(context.addressKey ?? null, stored)) === null ? 'unreadable' : 'saved';
  }
  const body: CustomerOrderResponse = {
    order: {
      ...order,
      ...(addressState ? { addressState } : {}),
      ...(result.value.addressChanged
        ? { addressChange: result.value.addressChanged === 'seen' ? 'seen' : 'waiting' }
        : {}),
    },
  };
  return Response.json(body, { status });
}

/**
 * Plan 071: keeps (or clears) an order's encrypted delivery address after a write. Only a delivery
 * order has one; without the key nothing is stored. An empty string deletes it. Answers what it
 * wrote: `stored` is the address now held (null = none), `edited` is true when it marked the order
 * as changed by the customer; nothing is answered when nothing was written.
 */
export async function storeAddress(
  repo: SellerRepository,
  context: RouteContext,
  result: StoreResult<SellerOrder>,
  address: DeliveryAddress | null | undefined,
  customerEdit = false,
): Promise<{ stored: string | null; edited: boolean } | undefined> {
  if (!result.ok) return undefined;
  const order = result.value;
  if (order.fulfilment !== 'delivery') {
    if (address !== undefined || order.changed) {
      await repo.setOrderAddress(order.id, null);
      return { stored: null, edited: false };
    }
    return undefined;
  }
  if (address === undefined) return undefined;
  if (address === null) {
    await repo.setOrderAddress(order.id, null);
    return { stored: null, edited: false };
  }
  if (context.addressKey) {
    // A customer's change shows the seller "Address changed", but only when it really differs. The old
    // address is compared and dropped, never kept (D-099).
    let edited = false;
    if (customerEdit) {
      const before = (await repo.orderAddresses([order.code])).get(order.code);
      const old = before === undefined ? null : await decryptAddress(context.addressKey, before);
      edited =
        old !== null &&
        JSON.stringify(parseDeliveryAddress(safeParse(old))) !== JSON.stringify(address);
    }
    const cipher = await encryptAddress(context.addressKey, JSON.stringify(address));
    await repo.setOrderAddress(order.id, cipher, edited);
    return { stored: cipher, edited };
  }
  return undefined;
}

/** Plan 071: the team's view of a stored address, decrypted; an unreadable one says so. */
async function readAddress(
  context: RouteContext,
  stored: string | undefined,
): Promise<OrderAddress | undefined> {
  if (stored === undefined) return undefined;
  const json = await decryptAddress(context.addressKey ?? null, stored);
  const address = json === null ? null : parseDeliveryAddress(safeParse(json));
  return address === null ? { unavailable: true } : { address };
}

/**
 * Adds each order's address to a seller-side answer that carries `order` or `orders`. Only the
 * signed-in team of that kitchen gets here; the customer routes never call it.
 */
export async function withAddresses(
  response: Response,
  repo: SellerRepository,
  context: RouteContext,
): Promise<Response> {
  if (!response.ok || !(response.headers.get('Content-Type') ?? '').includes('json')) {
    return response;
  }
  const body: unknown = await response.clone().json();
  if (!isRecord(body)) return response;
  const one = body['order'];
  const many = body['orders'];
  const decorate = (orders: Array<unknown>, stored: Map<string, string>): Promise<Array<unknown>> =>
    Promise.all(
      orders.map(async (order) => {
        if (!isRecord(order) || typeof order['code'] !== 'string') return order;
        const address = await readAddress(context, stored.get(order['code']));
        return address ? { ...order, address } : order;
      }),
    );
  if (isRecord(one) && typeof one['code'] === 'string') {
    const [order] = await decorate([one], await repo.orderAddresses([one['code']]));
    return Response.json({ ...body, order }, { status: response.status });
  }
  if (Array.isArray(many)) {
    const orders = await decorate(many as Array<unknown>, await repo.orderAddresses());
    return Response.json({ ...body, orders }, { status: response.status });
  }
  return response;
}
