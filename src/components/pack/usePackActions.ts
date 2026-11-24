import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import type { Order } from '../../../shared/domain';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { setOrderStatus } from '../../api/client';
import { packOrder } from '../../api/kitchen';
import { orderPatched } from '../../api/kitchenOrders';
import { readyTarget } from './packModel';

// Plan 132: the one pack action the order detail uses now and Kitchen -> Pack will use. Save sends the
// ticks only. Ready sends the ticks and Packed, then, for a pickup order, sets Ready for pickup (the
// customer gets the usual message). A delivery order is only marked Packed: no status change, no message.

export type PackResult =
  | { ok: true; order: Order }
  /** Packed with items not ticked and no `force`: the caller asks "Ready anyway?" (D-062). */
  | { ok: false; reason: 'unticked' }
  | { ok: false; reason: 'error' };

export async function savePack(order: Order, ticked: ReadonlyArray<string>): Promise<PackResult> {
  const result = await packOrder(
    order.code,
    { ticked: [...ticked] },
    undefined,
    currentSellerSlug(),
  );
  return result.ok ? { ok: true, order: result.data.order } : { ok: false, reason: 'error' };
}

export async function readyPack(
  order: Order,
  ticked: ReadonlyArray<string>,
  force: boolean,
  /** Told as soon as the pack request is saved, before the status step. */
  onPacked?: (saved: Order) => void,
): Promise<PackResult> {
  const slug = currentSellerSlug();
  const packed = await packOrder(
    order.code,
    { ticked: [...ticked], packed: true, ...(force ? { force } : {}) },
    undefined,
    slug,
  );
  if (!packed.ok) {
    return packed.status === 409 && packed.warning?.code === 'items_unticked'
      ? { ok: false, reason: 'unticked' }
      : { ok: false, reason: 'error' };
  }
  let latest = packed.data.order;
  onPacked?.(latest);
  const target = readyTarget(latest);
  if (target) {
    const moved = await setOrderStatus(latest.code, target, undefined, slug);
    if (!moved.ok) return { ok: false, reason: 'error' };
    latest = moved.data.order;
  }
  return { ok: true, order: latest };
}

/** The two actions, each putting the saved order into the Orders list on success. */
export function usePackActions() {
  const dispatch = useDispatch();
  const save = useCallback(
    async (order: Order, ticked: ReadonlyArray<string>) => {
      const result = await savePack(order, ticked);
      if (result.ok) dispatch(orderPatched(result.order));
      return result;
    },
    [dispatch],
  );
  const ready = useCallback(
    async (order: Order, ticked: ReadonlyArray<string>, force: boolean) => {
      const result = await readyPack(order, ticked, force, (saved) =>
        dispatch(orderPatched(saved)),
      );
      if (result.ok) dispatch(orderPatched(result.order));
      return result;
    },
    [dispatch],
  );
  return { save, ready };
}
