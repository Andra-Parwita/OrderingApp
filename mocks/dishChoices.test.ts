/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any -- loose JSON reply bodies in a test */
// @vitest-environment node
// Plan 111 (D-112): a dish with choices (a name and a limit each), copied onto the menu with the dish,
// sold out per choice and for the whole dish, ordered per choice, with a note per order line.
import { beforeEach, describe, expect, it } from 'vitest';
import { devApi, useWorld, type World } from './impl';

const START = Date.parse('2026-10-07T10:00:00Z');
const ADDRESS = { street: '5 Rose Street', suburb: 'Norwood', postcode: '5067' };

describe('dish choices and line notes (plan 111)', () => {
  const create = useWorld('dish-choices');
  let world: World;
  let tokens = 0;

  type Reply = { status: number; body: any };
  async function call(method: string, path: string, body?: unknown): Promise<Reply> {
    const headers: Record<string, string> = { 'X-Seller': 'onde-onde' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://choices.test${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    );
    const text = response ? await response.text() : '';
    try {
      return { status: response?.status ?? -1, body: JSON.parse(text) };
    } catch {
      return { status: response?.status ?? -1, body: text };
    }
  }

  beforeEach(async () => {
    tokens = 0;
    world = await create({
      now: () => new Date(START),
      newToken: () => `token-${String(++tokens)}-padding-padding`,
    });
  });

  const kinds = [
    { name: { en: 'Cheese', id: 'Keju' }, limit: 2 },
    { name: { en: 'Sweet', id: '' }, limit: null },
    { name: { en: 'Spicy', id: 'Pedas' }, limit: null },
  ];
  const makeDish = async (choices: unknown = kinds) => {
    const reply = await call('POST', '/api/seller/dishes', {
      name: { en: 'Dry snacks', id: 'Aneka snack kering' },
      priceCents: 600,
      size: { en: 'pack', id: 'bungkus' },
      choices,
    });
    expect(reply.status).toBe(201);
    return reply.body.dish as { id: string; choices: Array<{ id: string; name: unknown }> };
  };
  const onMenu = async (dishId: string) => {
    const reply = await call('POST', '/api/seller/menus/current/items', { dishId });
    expect(reply.status).toBe(201);
    const items = (await call('GET', '/api/seller/menu')).body.items as Array<any>;
    const parent = items.find((item) => item.name.en === 'Dry snacks');
    return { parent, choices: items.filter((item) => item.groupId === parent.id), items };
  };
  const order = (lines: Array<unknown>) =>
    call('POST', '/api/s/onde-onde/orders', {
      firstName: 'Lenni',
      language: 'en',
      fulfilment: 'delivery',
      address: ADDRESS,
      lines,
    });

  it('creates, updates and deletes a dish with choices; choices are not listed as dishes', async () => {
    const dish = await makeDish();
    expect(dish.choices.map((c) => c.name)).toEqual(kinds.map((k) => k.name));
    const before = (await call('GET', '/api/seller/dishes')).body.dishes as Array<any>;
    expect(before.some((d) => d.id === dish.choices[0]?.id)).toBe(false);
    expect(before.find((d) => d.id === dish.id).choices).toHaveLength(3);

    const kept = dish.choices[1] as { id: string };
    const updated = await call('PATCH', `/api/seller/dishes/${dish.id}`, {
      priceCents: 700,
      choices: [{ id: kept.id, name: { en: 'Sweet!', id: 'Manis' }, limit: 5 }, kinds[2]],
    });
    expect(updated.status).toBe(200);
    expect(updated.body.dish.choices).toHaveLength(2);
    expect(updated.body.dish.choices[0]).toEqual({
      id: kept.id,
      name: { en: 'Sweet!', id: 'Manis' },
      limit: 5,
    });
    const rows = await world.db.all<{ price_cents: number }>(
      'SELECT price_cents FROM dishes WHERE group_id = ?',
      dish.id,
    );
    expect(rows.map((r) => r.price_cents)).toEqual([700, 700]);

    const direct = await call('PATCH', `/api/seller/dishes/${kept.id}`, { priceCents: 1 });
    expect(direct.status).toBe(404);
    const tooMany = Array.from({ length: 31 }, (_, i) => ({
      name: { en: `K${String(i)}`, id: '' },
      limit: null,
    }));
    const many = await call('PATCH', `/api/seller/dishes/${dish.id}`, { choices: tooMany });
    expect(many.status).toBe(400);

    expect((await call('DELETE', `/api/seller/dishes/${dish.id}`)).status).toBe(200);
    expect(
      await world.db.first('SELECT COUNT(*) AS n FROM dishes WHERE group_id IS NOT NULL'),
    ).toEqual({ n: 0 });
  });

  it('copies the choices onto the menu right after the dish; a later edit leaves that menu alone', async () => {
    const dish = await makeDish();
    const { parent, choices, items } = await onMenu(dish.id);
    expect(choices.map((c) => c.name.en as string)).toEqual(['Cheese', 'Sweet', 'Spicy']);
    expect(items.indexOf(choices[0])).toBe(items.indexOf(parent) + 1);
    expect(choices[0]).toMatchObject({ priceCents: 600, limit: 2, groupId: parent.id });

    await call('PATCH', `/api/seller/dishes/${dish.id}`, { choices: [kinds[0]] });
    const again = (await call('GET', '/api/seller/menu')).body.items as Array<any>;
    expect(again.filter((item) => item.groupId === parent.id)).toHaveLength(3);

    const customer = (await call('GET', '/api/s/onde-onde/menu')).body.items as Array<any>;
    expect(customer.filter((item) => item.groupId === parent.id)).toHaveLength(3);
  });

  it('orders a choice with a note; the dish itself cannot be ordered', async () => {
    const { parent, choices } = await onMenu((await makeDish()).id);
    const refused = await order([{ itemId: parent.id, qty: 1 }]);
    expect([refused.status, refused.body.error]).toEqual([400, 'pick_choice']);

    const placed = await order([
      { itemId: choices[1].id, qty: 2, note: '  extra crispy ' },
      { itemId: choices[2].id, qty: 1, note: '   ' },
    ]);
    expect(placed.status).toBe(201);
    const [sweet, spicy] = placed.body.order.lines;
    expect(sweet).toMatchObject({
      name: { en: 'Dry snacks · Sweet', id: 'Aneka snack kering · Sweet' },
      size: { en: 'pack', id: 'bungkus' },
      priceCents: 600,
      qty: 2,
      note: 'extra crispy',
    });
    expect(spicy.note).toBeUndefined();
    expect(spicy.name.id).toBe('Aneka snack kering · Pedas');
    const mine = await call('GET', `/api/orders/${String(placed.body.order.token)}`);
    expect(mine.body.order.lines[0].note).toBe('extra crispy');
  });

  it('limits and Sold out work per choice; the dish cascades', async () => {
    const { parent, choices } = await onMenu((await makeDish()).id);
    const [cheese, sweet, spicy] = choices;
    expect((await order([{ itemId: cheese.id, qty: 3 }])).body.error).toBe('exceeds_remaining');
    expect((await order([{ itemId: cheese.id, qty: 2 }])).status).toBe(201);
    expect((await order([{ itemId: cheese.id, qty: 1 }])).body.error).toBe('sold_out');
    const seen = (await call('GET', '/api/s/onde-onde/menu')).body.items as Array<any>;
    expect(seen.find((i) => i.id === cheese.id)).toMatchObject({ remaining: 0, soldOut: true });
    expect(seen.find((i) => i.id === parent.id).soldOut).toBe(false);

    // a choice only takes a limit and Sold out
    const price = await call('PATCH', `/api/seller/menu/items/${String(sweet.id)}`, {
      priceCents: 1,
    });
    expect(price.status).toBe(400);
    const flagged = await call('PATCH', `/api/seller/menu/items/${String(sweet.id)}`, {
      soldOut: true,
    });
    expect(flagged.body.item).toMatchObject({ soldOut: true, manualSoldOut: true });
    expect((await order([{ itemId: sweet.id, qty: 1 }])).body.error).toBe('sold_out');
    await call('PATCH', `/api/seller/menu/items/${String(spicy.id)}`, { soldOut: true });
    const all = (await call('GET', '/api/seller/menu')).body.items as Array<any>;
    expect(all.find((i) => i.id === parent.id).soldOut).toBe(true);

    // the dish's own switch sells out every choice; a price change moves to them
    await call('PATCH', `/api/seller/menu/items/${String(sweet.id)}`, { soldOut: false });
    await call('PATCH', `/api/seller/menu/items/${String(spicy.id)}`, { soldOut: false });
    await call('PATCH', `/api/seller/menu/items/${String(parent.id)}`, {
      soldOut: true,
      priceCents: 650,
    });
    const after = (await call('GET', '/api/s/onde-onde/menu')).body.items as Array<any>;
    expect(after.filter((i) => i.groupId === parent.id).every((i) => i.soldOut)).toBe(true);
    expect(after.find((i) => i.id === sweet.id).priceCents).toBe(650);
    expect((await order([{ itemId: spicy.id, qty: 1 }])).body.error).toBe('sold_out');
  });

  it('a seller edit keeps line notes unless the request changes them', async () => {
    const { choices } = await onMenu((await makeDish()).id);
    const [, sweet, spicy] = choices;
    const placed = await order([{ itemId: sweet.id, qty: 1, note: 'no nuts' }]);
    const code = String(placed.body.order.code);
    const kept = await call('PATCH', `/api/seller/orders/${code}`, {
      notify: false,
      lines: [
        { itemId: sweet.id, qty: 3 },
        { itemId: spicy.id, qty: 1, note: 'hot' },
      ],
    });
    expect(kept.status).toBe(200);
    expect(
      (kept.body.order.lines as Array<any>).map((l) => [l.qty as number, l.note as string]),
    ).toEqual([
      [3, 'no nuts'],
      [1, 'hot'],
    ]);
    const noteOnly = await call('PATCH', `/api/seller/orders/${code}`, {
      notify: false,
      lines: [
        { itemId: sweet.id, qty: 3, note: 'with nuts' },
        { itemId: spicy.id, qty: 1, note: '' },
      ],
    });
    expect(
      (noteOnly.body.order.lines as Array<any>).map((l) => l.note as string | undefined),
    ).toEqual(['with nuts', undefined]);
    const stored = await world.db.all<{ note: string | null }>(
      'SELECT note FROM order_lines WHERE order_id = ? ORDER BY position',
      placed.body.order.id as string,
    );
    expect(stored.map((r) => r.note)).toEqual(['with nuts', null]);
  });

  it('a customer update replaces the line notes', async () => {
    const { choices } = await onMenu((await makeDish()).id);
    const placed = await order([{ itemId: choices[1].id, qty: 1, note: 'first' }]);
    const token = String(placed.body.order.token);
    const changed = await call('PATCH', `/api/orders/${token}`, {
      lines: [{ itemId: choices[1].id, qty: 1, note: 'second' }],
    });
    expect(changed.status).toBe(200);
    expect(changed.body.order.lines[0].note).toBe('second');
    const cleared = await call('PATCH', `/api/orders/${token}`, {
      lines: [{ itemId: choices[1].id, qty: 1 }],
    });
    expect(cleared.body.order.lines[0].note).toBeUndefined();
  });
});
