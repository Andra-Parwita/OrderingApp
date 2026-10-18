// The few request-dependent permissions left after roles became an allow-list (plan 098 C2).
// Each is a `only: { chef | helper }` check on one route. They read the STORED dish or item, never
// the body, to decide whose it is. Plan 030 (chef dishes) and plan 028 (helper).
import { isRecord } from '../../shared/parse';
import type { SellerCall } from './sellerRoute';

async function bodyOf(call: SellerCall): Promise<unknown> {
  return call.request
    .clone()
    .json()
    .catch(() => null);
}

/** A chef adds or imports a dish: the handler forces chef = self, so any signed-in chef may. */
export const chefIsKnown = (call: SellerCall): boolean => !!call.chefId;

/** A chef edits a dish (or its picture) only when the STORED dish is theirs, and never reassigns it. */
export async function chefOwnsDish(call: SellerCall): Promise<boolean> {
  const { chefId, b, store } = call;
  if (!chefId) return false;
  const body = await bodyOf(call);
  if (isRecord(body) && body['chefId'] !== undefined && body['chefId'] !== chefId) return false;
  return (await store.listDishes()).find((d) => d.id === b)?.chefId === chefId;
}

/** A chef sells out / edits a menu item only when the STORED item is theirs, and never reassigns it. */
export async function chefOwnsItem(call: SellerCall): Promise<boolean> {
  const { chefId, c, store } = call;
  if (!chefId) return false;
  const body = await bodyOf(call);
  if (isRecord(body) && body['chefId'] !== undefined && body['chefId'] !== chefId) return false;
  return (await store.getSellerMenu()).items.find((i) => i.id === c)?.chefId === chefId;
}

/** D-094: a chef appends her own library dish to the current menu. */
export async function chefAddsOwnDish(call: SellerCall): Promise<boolean> {
  const { chefId, store } = call;
  if (!chefId) return false;
  const body = await bodyOf(call);
  const dishId = isRecord(body) ? body['dishId'] : undefined;
  return (
    typeof dishId === 'string' &&
    (await store.listDishes()).find((d) => d.id === dishId)?.chefId === chefId
  );
}

/** The item PATCH also edits name and price: a helper may send the sold-out switch alone. */
export async function helperSoldOutOnly(call: SellerCall): Promise<boolean> {
  const body = await bodyOf(call);
  return isRecord(body) && Object.keys(body).length === 1 && typeof body['soldOut'] === 'boolean';
}
