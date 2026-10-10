// @vitest-environment node
// Plan 009 stage 3 (D-075): a lost order back by code and first name, in one kitchen. Two wrong
// tries lock it for 15 minutes per client and per kitchen-and-code; every miss answers alike.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseCustomerOrderResponse } from '../shared/orderContract';
import { runAttemptSweep } from '../worker/api/scheduled';
import { devApi, useWorld, type World } from './impl';

const START = new Date('2026-10-07T10:00:00Z');

describe('find an order by code and first name', () => {
  const create = useWorld('orderFind');
  let world: World;
  let nowMs: number;

  async function call(path: string, body: unknown, ip: string) {
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://delave.test',
          'CF-Connecting-IP': ip,
        },
        body: JSON.stringify(body),
      }),
    );
    return { status: response?.status ?? -1, body: (await response?.json()) as unknown };
  }

  async function place(slug: string, firstName: string, item: string) {
    const reply = await call(
      `/api/s/${slug}/orders`,
      { firstName, language: 'en', fulfilment: 'pickup', lines: [{ itemId: item, qty: 1 }] },
      '203.0.113.250',
    );
    const order = parseCustomerOrderResponse(reply.body)?.order;
    if (reply.status !== 201 || !order) throw new Error(JSON.stringify(reply));
    return order;
  }

  const find = (slug: string, code: string, firstName: string, ip = '203.0.113.1') =>
    call(`/api/s/${slug}/orders/find`, { code, firstName }, ip);

  beforeEach(async () => {
    nowMs = START.getTime();
    world = await create({ now: () => new Date(nowMs) });
  });

  it('opens with the right code and name, in any case, spacing or code format', async () => {
    const order = await place('onde-onde', 'Lenny', 'pesmol');
    const dashed = `${order.code.slice(0, 3)}-${order.code.slice(3)}`.toLowerCase();
    expect((await find('onde-onde', order.code, 'Lenny')).body).toEqual({ token: order.token });
    expect((await find('onde-onde', dashed, '  lENNY ')).body).toEqual({ token: order.token });
  });

  it('answers a wrong name exactly like an unknown code, and says nothing else', async () => {
    const order = await place('onde-onde', 'Lenny', 'pesmol');
    const wrongName = await find('onde-onde', order.code, 'Someone', '203.0.113.2');
    const unknownCode = await find('onde-onde', 'ZZZZZZ', 'Lenny', '203.0.113.3');
    expect(wrongName).toEqual(unknownCode);
    expect(wrongName.status).toBe(404);
    expect(JSON.stringify(wrongName.body)).not.toContain(order.token);
  });

  it('does not find another kitchen’s order', async () => {
    const other = await place('dapur-demo', 'Lenny', 'es-teh');
    expect((await find('onde-onde', other.code, 'Lenny')).status).toBe(404);
    expect((await find('dapur-demo', other.code, 'Lenny', '203.0.113.9')).status).toBe(200);
  });

  it('locks the code after 2 wrong tries, even for the right name, from any address', async () => {
    const order = await place('onde-onde', 'Lenny', 'pesmol');
    expect((await find('onde-onde', order.code, 'Nope', '203.0.113.11')).status).toBe(404);
    // The 2nd wrong try is the one that locks, so it already says "wait".
    expect((await find('onde-onde', order.code, 'Nope', '203.0.113.12')).status).toBe(429);
    const locked = await find('onde-onde', order.code, 'Lenny', '203.0.113.13');
    expect(locked.status).toBe(429);
    expect(locked.body).toMatchObject({ error: 'locked_out' });
    expect(JSON.stringify(locked.body)).not.toContain(order.token);
  });

  const codes = 'ABCDEFGHJK'.split('').map((letter) => letter.repeat(6));

  it('3 wrong tries from one address on 3 codes do not lock it', async () => {
    const order = await place('onde-onde', 'Lenny', 'pesmol');
    for (const code of codes.slice(0, 3)) {
      expect((await find('onde-onde', code, 'x', '203.0.113.20')).status).toBe(404);
    }
    expect((await find('onde-onde', order.code, 'Lenny', '203.0.113.20')).status).toBe(200);
  });

  it('the 10th wrong try from one address locks it, but not other addresses', async () => {
    const order = await place('onde-onde', 'Lenny', 'pesmol');
    for (const code of codes.slice(0, 9)) {
      expect((await find('onde-onde', code, 'x', '203.0.113.22')).status).toBe(404);
    }
    expect((await find('onde-onde', codes[9] ?? '', 'x', '203.0.113.22')).status).toBe(429);
    expect((await find('onde-onde', order.code, 'Lenny', '203.0.113.22')).status).toBe(429);
    expect((await find('onde-onde', order.code, 'Lenny', '203.0.113.21')).status).toBe(200);
  });

  it('a right answer does not give the client its tries back', async () => {
    const order = await place('onde-onde', 'Lenny', 'pesmol');
    const ip = '203.0.113.30';
    for (const code of codes.slice(0, 9)) {
      expect((await find('onde-onde', code, 'x', ip)).status).toBe(404);
    }
    expect((await find('onde-onde', order.code, 'Lenny', ip)).status).toBe(200);
    // 9 wrong before + 1 wrong now = 10: locked, although a right answer came in between.
    expect((await find('onde-onde', codes[9] ?? '', 'x', ip)).status).toBe(429);
    expect((await find('onde-onde', order.code, 'Lenny', ip)).status).toBe(429);
  });

  it('the hourly sweep forgets old wrong tries and keeps a live lock', async () => {
    const order = await place('onde-onde', 'Lenny', 'pesmol');
    await find('onde-onde', codes[0] ?? '', 'x', '203.0.113.60'); // one wrong try, no lock
    await find('onde-onde', order.code, 'Nope', '203.0.113.61');
    await find('onde-onde', order.code, 'Nope', '203.0.113.61'); // locks the code
    const rows = () =>
      world.db.first<{ n: number }>(
        "SELECT COUNT(*) AS n FROM auth_attempts WHERE scope LIKE 'find:%'",
      );
    const before = (await rows())?.n ?? 0;
    expect(before).toBeGreaterThan(0);
    // Too young: nothing goes.
    expect(await runAttemptSweep({ DB: world.db.d1 }, new Date(nowMs + 5 * 60_000))).toBe(0);
    // 16 minutes on: the lock has ended and the tries are old, so every row goes.
    expect(await runAttemptSweep({ DB: world.db.d1 }, new Date(nowMs + 16 * 60_000))).toBe(before);
    expect((await rows())?.n).toBe(0);
    // A live lock stays even when its row is old enough: lock it at "now", sweep 14 minutes later.
    await find('onde-onde', order.code, 'Nope', '203.0.113.62');
    await find('onde-onde', order.code, 'Nope', '203.0.113.62');
    await world.db
      .stmt(
        "UPDATE auth_attempts SET updated_at = '2026-10-07T09:00:00.000Z' WHERE scope LIKE 'find:%'",
      )
      .run();
    // Only the unlocked address row goes; the locked code row stays.
    expect(await runAttemptSweep({ DB: world.db.d1 }, new Date(nowMs + 14 * 60_000))).toBe(1);
    expect((await rows())?.n).toBe(1);
  });

  it('works again once 15 minutes have passed', async () => {
    const order = await place('onde-onde', 'Lenny', 'pesmol');
    await find('onde-onde', order.code, 'Nope', '203.0.113.40');
    await find('onde-onde', order.code, 'Nope', '203.0.113.40');
    expect((await find('onde-onde', order.code, 'Lenny', '203.0.113.41')).status).toBe(429);
    nowMs += 16 * 60_000;
    expect((await find('onde-onde', order.code, 'Lenny', '203.0.113.41')).status).toBe(200);
  });

  it('refuses a malformed request without counting a try', async () => {
    const order = await place('onde-onde', 'Lenny', 'pesmol');
    const ip = '203.0.113.50';
    expect(
      (await call('/api/s/onde-onde/orders/find', { code: 'x', firstName: 'a' }, ip)).status,
    ).toBe(400);
    expect((await call('/api/s/onde-onde/orders/find', { code: order.code }, ip)).status).toBe(400);
    expect((await find('onde-onde', order.code, 'Lenny', ip)).status).toBe(200);
  });
});
