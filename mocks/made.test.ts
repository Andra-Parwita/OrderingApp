// @vitest-environment node
// Plan 035 stage 4: made counts shared by every device of a kitchen. Runs against a local D1.
import { beforeEach, describe, expect, it } from 'vitest';
import type { LiveSignal } from '../shared/liveContract';
import { devApi, useWorld, type World } from './impl';

const A = 'onde-onde';
const B = 'dapur-demo';
const NOW = new Date('2026-10-07T10:00:00Z');

describe('made counts', () => {
  const create = useWorld('made');
  let world: World;
  const sent: Array<LiveSignal> = [];
  const live = {
    notify: (_sellerId: string, signal: LiveSignal) => {
      sent.push(signal);
      return Promise.resolve();
    },
    connect: () => Promise.resolve(new Response('room')),
    connectCustomer: () => Promise.resolve(new Response('room')),
  };

  async function call(method: string, seller: string, body?: unknown) {
    const response = await devApi(
      world.repo,
      new Request('https://delave.test/api/seller/made', {
        method,
        headers: { 'X-Seller': seller, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
      { live },
    );
    return { status: response?.status, body: (await response?.json()) as unknown };
  }

  beforeEach(async () => {
    sent.length = 0;
    world = await create({ now: () => NOW });
  });

  it('counts two taps at once, and another session reads the total', async () => {
    const taps = await Promise.all([
      call('POST', A, { itemId: 'pesmol', delta: 1 }),
      call('POST', A, { itemId: 'pesmol', delta: 1 }),
    ]);
    expect(taps.map((tap) => tap.status)).toEqual([200, 200]);
    expect((await call('GET', A)).body).toEqual({ made: { pesmol: 2 } });
  });

  it('never goes below zero, and a minus moves it back', async () => {
    await call('POST', A, { itemId: 'pesmol', delta: 3 });
    expect((await call('POST', A, { itemId: 'pesmol', delta: -1 })).body).toEqual({
      made: { pesmol: 2 },
    });
    expect((await call('POST', A, { itemId: 'pesmol', delta: -50 })).body).toEqual({ made: {} });
  });

  it('keeps each kitchen to itself', async () => {
    await call('POST', A, { itemId: 'pesmol', delta: 1 });
    expect((await call('GET', B)).body).toEqual({ made: {} });
  });

  it('tells the live room after a write, and refuses a bad body', async () => {
    await call('POST', A, { itemId: 'pesmol', delta: 1 });
    expect(sent).toEqual([{ type: 'order.changed' }]);
    expect((await call('POST', A, { itemId: 'pesmol', delta: 0 })).status).toBe(400);
    expect(sent).toHaveLength(1);
  });
});
