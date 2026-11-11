// @vitest-environment node
// Plan 129: the customer route refuses a name that does not look real; the seller route does not.
import { describe, expect, it } from 'vitest';
import { handleApiRequest } from '../worker/api/routes';
import { useWorld } from './impl';

describe('first name check (plan 129)', () => {
  const create = useWorld('first-name-check');
  const body = (firstName: string) => ({
    firstName,
    language: 'en',
    fulfilment: 'pickup',
    lines: [{ itemId: 'pesmol', qty: 1 }],
  });

  it('refuses Bshsh from a customer with 400 and accepts a real name', async () => {
    const world = await create({ now: () => new Date('2026-10-07T10:00:00Z') });
    const post = async (firstName: string, ip: string) =>
      (
        await handleApiRequest(
          world.repo,
          new Request('https://delave.test/api/s/onde-onde/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
            body: JSON.stringify(body(firstName)),
          }),
          {},
        )
      )?.status;
    expect(await post('Bshsh', '203.0.113.61')).toBe(400);
    expect(await post('Rianti', '203.0.113.62')).toBe(201);
  });

  it('lets the seller enter an order for any name', async () => {
    const world = await create({ now: () => new Date('2026-10-07T10:00:00Z') });
    const onde = await world.repo.sellerBySlug('onde-onde');
    const made = await onde?.createSellerOrder(
      body('Bshsh') as never,
      {
        role: 'seller',
        name: 'Rina',
      } as never,
    );
    expect(made?.ok).toBe(true);
  });
});
