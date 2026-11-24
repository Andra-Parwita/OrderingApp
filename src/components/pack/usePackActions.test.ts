// Plan 132: the pack action. Save sends the ticks only; Ready sends ticks + packed, then the Ready step.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '../../../shared/domain';

const packOrder = vi.fn();
const setOrderStatus = vi.fn();
vi.mock('../../api/kitchen', () => ({
  packOrder: (...args: Array<unknown>): unknown => packOrder(...args),
}));
vi.mock('../../api/client', () => ({
  setOrderStatus: (...args: Array<unknown>): unknown => setOrderStatus(...args),
}));
vi.mock('../../api/device/sellerContext', () => ({ currentSellerSlug: () => 'home' }));

import { readyPack, savePack } from './usePackActions';

const order = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 'o1',
    code: 'K7F2QX',
    status: 'confirmed',
    fulfilment: 'pickup',
    paid: false,
    lines: [
      { itemId: 'a', qty: 1, priceCents: 100 },
      { itemId: 'b', qty: 1, priceCents: 100 },
    ],
    ...overrides,
  }) as unknown as Order;

beforeEach(() => {
  packOrder.mockReset();
  setOrderStatus.mockReset();
});

describe('savePack', () => {
  it('sends the ticks only: no packed, no status', async () => {
    packOrder.mockResolvedValue({ ok: true, data: { order: order() } });
    const result = await savePack(order(), ['a']);
    expect(result.ok).toBe(true);
    expect(packOrder).toHaveBeenCalledWith('K7F2QX', { ticked: ['a'] }, undefined, 'home');
    expect(setOrderStatus).not.toHaveBeenCalled();
  });

  it('reports an error', async () => {
    packOrder.mockResolvedValue({ ok: false, error: 'network', status: 0, message: '' });
    expect(await savePack(order(), [])).toEqual({ ok: false, reason: 'error' });
  });
});

describe('readyPack', () => {
  it('sends ticks + packed, then sets Ready for pickup', async () => {
    packOrder.mockResolvedValue({ ok: true, data: { order: order({ packed: true }) } });
    setOrderStatus.mockResolvedValue({
      ok: true,
      data: { order: order({ packed: true, status: 'ready_for_pickup' }) },
    });
    const result = await readyPack(order(), ['a', 'b'], false);
    expect(packOrder).toHaveBeenCalledWith(
      'K7F2QX',
      { ticked: ['a', 'b'], packed: true },
      undefined,
      'home',
    );
    expect(setOrderStatus).toHaveBeenCalledWith('K7F2QX', 'ready_for_pickup', undefined, 'home');
    expect(result.ok && result.order.status).toBe('ready_for_pickup');
  });

  it('only marks a delivery order Packed: no status change', async () => {
    const delivery = order({ fulfilment: 'delivery' });
    packOrder.mockResolvedValue({ ok: true, data: { order: delivery } });
    const result = await readyPack(delivery, ['a', 'b'], false);
    expect(packOrder).toHaveBeenCalledWith(
      'K7F2QX',
      { ticked: ['a', 'b'], packed: true },
      undefined,
      'home',
    );
    expect(setOrderStatus).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });

  it('asks again with force after the warning, and sends force', async () => {
    packOrder.mockResolvedValueOnce({
      ok: false,
      error: 'items_unticked',
      status: 409,
      message: '',
      warning: { code: 'items_unticked' },
    });
    const first = await readyPack(order(), ['a'], false);
    expect(first).toEqual({ ok: false, reason: 'unticked' });
    expect(setOrderStatus).not.toHaveBeenCalled();

    packOrder.mockResolvedValueOnce({ ok: true, data: { order: order({ packed: true }) } });
    setOrderStatus.mockResolvedValueOnce({ ok: true, data: { order: order({ packed: true }) } });
    await readyPack(order(), ['a'], true);
    expect(packOrder).toHaveBeenLastCalledWith(
      'K7F2QX',
      { ticked: ['a'], packed: true, force: true },
      undefined,
      'home',
    );
    expect(setOrderStatus).toHaveBeenCalledTimes(1);
  });

  it('does not touch the status when the order is already Ready', async () => {
    const ready = order({ status: 'ready_for_pickup' });
    packOrder.mockResolvedValue({ ok: true, data: { order: ready } });
    const result = await readyPack(ready, ['a', 'b'], false);
    expect(result.ok).toBe(true);
    expect(setOrderStatus).not.toHaveBeenCalled();
  });
});
