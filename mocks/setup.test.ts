// @vitest-environment node
// Stage 6.1: seller setup endpoints. Every endpoint is also checked for isolation between sellers.
// Runs against a local D1; see mocks/impl.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseBackupFile } from '../shared/backup';
import { parseMenuResponse, parseSellerMenuResponse } from '../shared/menuContract';
import { parseSellerOrdersResponse } from '../shared/orderContract';
import { fakePng, pngFor } from './images';
import { devApi, useWorld, type World } from './impl';

const A = 'onde-onde';
const B = 'dapur-demo';
const A_ID = 'seller-onde-onde';

describe('seller setup', () => {
  const create = useWorld('setup');
  let now = new Date('2026-10-07T10:00:00Z');
  let world: World;
  let counter = 0;

  type Reply = { status: number; body: unknown; text: string; headers: Headers };

  async function call(
    method: string,
    path: string,
    options: { seller?: string; body?: unknown; raw?: string } = {},
  ): Promise<Reply> {
    const headers: Record<string, string> = {};
    if (options.seller) headers['X-Seller'] = options.seller;
    const body =
      options.raw ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined);
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body } : {}),
      }),
    );
    if (!response) return { status: -1, body: null, text: '', headers: new Headers() };
    // ignoreBOM: response.text() would strip the CSV's BOM.
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await response.arrayBuffer());
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    return { status: response.status, body: parsed, text, headers: response.headers };
  }

  const ERR = (status: number, error: string) => ({ status, body: { error } });

  const as = (seller: string) => ({ seller });
  const A_ = as(A);
  const B_ = as(B);

  const text = (en: string, id = '') => ({ en, id });

  async function menu(seller: string) {
    const parsed = parseSellerMenuResponse(
      (await call('GET', '/api/seller/menu', as(seller))).body,
    );
    if (!parsed) throw new Error('bad menu');
    return parsed;
  }

  async function publicMenu(slug: string) {
    const parsed = parseMenuResponse((await call('GET', `/api/s/${slug}/menu`)).body);
    if (!parsed) throw new Error('bad public menu');
    return parsed;
  }

  async function sellerOrders(seller: string) {
    return (
      parseSellerOrdersResponse((await call('GET', '/api/seller/orders', as(seller))).body)
        ?.orders ?? []
    );
  }

  const newItem = (extra = {}) => ({ name: text('Soto', 'Soto ayam'), priceCents: 1400, ...extra });

  type View = {
    menu: Record<string, unknown>;
    dishes: Array<{ id: string; dishId?: string }>;
    pickupPoints: Array<{ id: string; place: string; window: { start: string; end: string } }>;
  };
  async function view(seller: string): Promise<View> {
    return ((await call('GET', '/api/seller/menus/current', as(seller))).body as { menu: View })
      .menu;
  }
  const putMenu = (seller: string, body: unknown) =>
    call('PUT', '/api/seller/menus/current', { seller, body });

  /** Creates a dish in the library, puts it on the menu and returns the menu item id. */
  async function addItem(seller: string, extra = {}) {
    const made = await call('POST', '/api/seller/dishes', { seller, body: newItem(extra) });
    const dishId = (made.body as { dish: { id: string } }).dish.id;
    const ids = (await view(seller)).dishes.map((dish) => dish.dishId ?? '');
    await putMenu(seller, { dishIds: [...ids, dishId] });
    return (await view(seller)).dishes.find((dish) => dish.dishId === dishId)?.id ?? '';
  }

  async function order(slug: string, itemId: string, qty = 1) {
    const reply = await call('POST', `/api/s/${slug}/orders`, {
      body: { firstName: 'Rina', language: 'en', fulfilment: 'pickup', lines: [{ itemId, qty }] },
    });
    return (reply.body as { order: { code: string; token: string } }).order;
  }

  beforeEach(async () => {
    counter = 0;
    now = new Date('2026-10-07T10:00:00Z');
    world = await create({
      now: () => now,
      newId: () => `id-${String(++counter)}`,
      newToken: () => `tok-${String(++counter)}`,
    });
  });

  describe('menu settings and lifecycle', () => {
    const settings = {
      cookingDate: '2026-10-17',
      cutoffAt: '2026-10-16T21:00:00+11:00',
      places: [{ placeId: 'glen-waverley', window: { start: '10:00', end: '12:30' } }],
      delivery: { available: false, note: text('No delivery this week') },
    };

    it('reads the menu and saves its settings, keeping the pickup place id', async () => {
      expect((await view(A)).menu['state']).toBe('live');
      const saved = await putMenu(A, settings);
      expect(saved.status).toBe(200);
      const current = await view(A);
      expect(current.menu).toMatchObject({
        cookingDate: '2026-10-17',
        cutoffAt: '2026-10-16T21:00:00+11:00',
        state: 'live',
        delivery: { available: false },
      });
      expect(current.pickupPoints.map((point) => point.id)).toEqual(['glen-waverley']);
      expect(current.pickupPoints[0]?.window).toEqual({ start: '10:00', end: '12:30' });
      expect((await publicMenu(A)).week.cookingDate).toBe('2026-10-17');
    });

    it('refuses bad settings: unknown or repeated places, bad times, dates and cut-off', async () => {
      const place = settings.places[0];
      expect(await putMenu(A, { places: [{ placeId: 'nope' }] })).toMatchObject(
        ERR(404, 'not_found'),
      );
      expect(await putMenu(A, { places: [place, place] })).toMatchObject(
        ERR(400, 'invalid_request'),
      );
      expect(
        await putMenu(A, { places: [{ ...place, window: { start: '12:00', end: '10:00' } }] }),
      ).toMatchObject(ERR(400, 'invalid_request'));
      expect(await putMenu(A, { cookingDate: '2026-02-30' })).toMatchObject(
        ERR(400, 'invalid_request'),
      );
      expect(await putMenu(A, { cutoffAt: '2026-10-16 21:00' })).toMatchObject(
        ERR(400, 'invalid_request'),
      );
      expect(await putMenu(A, {})).toMatchObject(ERR(400, 'invalid_request'));
    });

    it('unpublishes (customers cannot order) and publishes again', async () => {
      const down = await call('POST', '/api/seller/menus/current/unpublish', A_);
      expect(down.status).toBe(200);
      expect((await view(A)).menu['state']).toBe('not_published');
      expect((await publicMenu(A)).week.status).not.toBe('published');
      const blocked = await call('POST', `/api/s/${A}/orders`, {
        body: {
          firstName: 'Rina',
          language: 'en',
          fulfilment: 'pickup',
          lines: [{ itemId: 'pesmol', qty: 1 }],
        },
      });
      expect(blocked).toMatchObject(ERR(409, 'week_not_published'));
      expect((await call('POST', '/api/seller/menus/current/publish', A_)).status).toBe(200);
      expect((await view(A)).menu['state']).toBe('live');
      expect((await publicMenu(A)).week.status).toBe('published');
    });

    it('warns before publishing an empty menu, and publishes it only with force (D-062)', async () => {
      await call('POST', '/api/seller/menus/current/unpublish', A_);
      await putMenu(A, { dishIds: [] });
      expect(await call('POST', '/api/seller/menus/current/publish', A_)).toMatchObject(
        ERR(409, 'no_items'),
      );
      expect((await view(A)).menu['state']).toBe('not_published');
      expect(
        await call('POST', '/api/seller/menus/current/publish', { ...A_, body: { force: true } }),
      ).toMatchObject({ status: 200 });
    });

    it('keeps the ordering switch in the settings, not in the menu', async () => {
      await call('PUT', '/api/seller/settings', {
        ...A_,
        body: {
          postGreeting: text('a'),
          postClosing: text('b'),
          orderingOpen: false,
        },
      });
      await putMenu(A, settings);
      expect((await publicMenu(A)).ordering).toEqual({ open: false, reason: 'closed_by_seller' });
    });

    it('isolates the menu between sellers', async () => {
      await putMenu(A, settings);
      await call('POST', '/api/seller/menus/current/unpublish', A_);
      const b = await view(B);
      expect(b.menu).toMatchObject({ cookingDate: '2026-10-10', state: 'live' });
      expect(JSON.stringify(b)).not.toContain('Glen Waverley');
      expect((await publicMenu(B)).week.status).toBe('published');
    });
  });

  describe('menu items', () => {
    it('creates a dish, puts it on the menu and edits the menu copy: EN/ID, size, price, limit and chef', async () => {
      const id = await addItem(A, {
        limit: 8,
        chefId: 'wati',
        description: text('turmeric broth'),
        size: text('1 bowl', '1 mangkuk'),
      });
      expect(id).not.toBe('');
      const item = (await menu(A)).items.find((x) => x.id === id);
      expect(item).toMatchObject({
        name: text('Soto', 'Soto ayam'),
        description: text('turmeric broth'),
        priceCents: 1400,
        limit: 8,
        remaining: 8,
        soldOut: false,
        chefId: 'wati',
      });
      const patched = await call('PATCH', `/api/seller/menu/items/${id}`, {
        ...A_,
        body: { priceCents: 1600, limit: null, chefId: null, name: text('', 'Soto') },
      });
      const next = (patched.body as { item: Record<string, unknown> }).item;
      expect(next).toMatchObject({ priceCents: 1600, name: text('', 'Soto'), remaining: null });
      expect(next).not.toHaveProperty('limit');
      expect(next).not.toHaveProperty('chefId');
      expect((await menu(A)).items.at(-1)?.id).toBe(id);
    });

    it('keeps the chef off the customer menu and the manual flag too', async () => {
      const id = await addItem(A, { chefId: 'wati' });
      await call('PATCH', `/api/seller/menu/items/${id}`, { ...A_, body: { soldOut: true } });
      const customer = (await publicMenu(A)).items.find((item) => item.id === id);
      expect(customer).toMatchObject({ soldOut: true });
      expect(JSON.stringify(customer)).not.toContain('chefId');
      expect(JSON.stringify(customer)).not.toContain('manualSoldOut');
      expect((await menu(A)).items.find((item) => item.id === id)).toMatchObject({
        chefId: 'wati',
        soldOut: true,
        manualSoldOut: true,
      });
    });

    it('validates input: empty name in both languages, bad price, limit, chef, unknown item', async () => {
      const post = (body: unknown) => call('POST', '/api/seller/dishes', { ...A_, body });
      expect(await post({ name: text('', ' '), priceCents: 100 })).toMatchObject(
        ERR(400, 'invalid_request'),
      );
      expect(await post({ name: text('x'), priceCents: -1 })).toMatchObject(
        ERR(400, 'invalid_request'),
      );
      expect(await post({ name: text('x'), priceCents: 10.5 })).toMatchObject(
        ERR(400, 'invalid_request'),
      );
      expect(await post({ name: text('x'), priceCents: 100, limit: 0 })).toMatchObject(
        ERR(400, 'invalid_request'),
      );
      expect(await post({ name: text('x'.repeat(81)), priceCents: 100 })).toMatchObject(
        ERR(400, 'invalid_request'),
      );
      expect(await post({ name: text('x'), priceCents: 100, chefId: 'rudi' })).toMatchObject(
        ERR(400, 'unknown_chef'),
      );
      expect(
        await call('PATCH', '/api/seller/menu/items/pesmol', { ...A_, body: {} }),
      ).toMatchObject(ERR(400, 'invalid_request'));
      expect(
        await call('PATCH', '/api/seller/menu/items/nope', { ...A_, body: { priceCents: 1 } }),
      ).toMatchObject(ERR(404, 'not_found'));
      expect(
        await call('PATCH', '/api/seller/menu/items/pesmol', { ...A_, body: { chefId: 'rudi' } }),
      ).toMatchObject(ERR(400, 'unknown_chef'));
    });

    it('allows at most 10 dishes per menu', async () => {
      while ((await menu(A)).items.length < 10) await addItem(A);
      const made = await call('POST', '/api/seller/dishes', { ...A_, body: newItem() });
      const extra = (made.body as { dish: { id: string } }).dish.id;
      const ids = (await view(A)).dishes.map((dish) => dish.dishId);
      expect(await putMenu(A, { dishIds: [...ids, extra] })).toMatchObject(
        ERR(400, 'invalid_request'),
      );
      expect((await menu(A)).items).toHaveLength(10);
      expect((await menu(B)).items).toHaveLength(3);
      await addItem(B);
      expect((await menu(B)).items).toHaveLength(4);
    });

    it('reorders: the menu follows the order of the dish ids, no foreign or unknown ids', async () => {
      const dishIds = (await view(A)).dishes.map((dish) => dish.dishId ?? '');
      const itemIds = (await menu(A)).items.map((item) => item.id);
      const ok = await putMenu(A, { dishIds: [...dishIds].reverse() });
      expect(ok.status).toBe(200);
      expect((await menu(A)).items.map((item) => item.id)).toEqual([...itemIds].reverse());
      expect(await putMenu(A, { dishIds: [...dishIds.slice(1), 'soto-ayam'] })).toMatchObject(
        ERR(400, 'unknown_item'),
      );
      expect(await putMenu(B, { dishIds })).toMatchObject(ERR(400, 'unknown_item'));
    });

    describe('D-020: edits only affect new orders; dropping an ordered item warns', () => {
      it('keeps the old price and name on an existing order', async () => {
        const placed = await order(A, 'pesmol');
        await call('PATCH', '/api/seller/menu/items/pesmol', {
          ...A_,
          body: { priceCents: 9900, name: text('Renamed', 'Diganti') },
        });
        const line = (await sellerOrders(A)).find((o) => o.code === placed.code)?.lines[0];
        expect(line).toMatchObject({
          priceCents: 1500,
          name: text('Tilapia pesmol', 'Pesmol ikan nila'),
        });
        const second = await order(A, 'pesmol');
        const newLine = (await sellerOrders(A)).find((o) => o.code === second.code)?.lines[0];
        expect(newLine).toMatchObject({ priceCents: 9900, name: text('Renamed', 'Diganti') });
      });

      it('warns when an item with an order leaves the menu, and not once the order is cancelled', async () => {
        const placed = await order(A, 'pesmol');
        const keep = (await view(A)).dishes
          .filter((dish) => dish.id !== 'pesmol')
          .map((dish) => dish.dishId ?? '');
        const dropped = await putMenu(A, { dishIds: keep });
        expect(dropped.status).toBe(200);
        expect(
          (dropped.body as { warnings: { removedWithOrders: Array<string> } }).warnings
            .removedWithOrders,
        ).toEqual(['pesmol']);
        expect((await menu(A)).items.some((item) => item.id === 'pesmol')).toBe(false);
        // The order keeps its line.
        expect((await sellerOrders(A)).find((o) => o.code === placed.code)?.lines[0]).toMatchObject(
          {
            itemId: 'pesmol',
          },
        );
        // With the order cancelled, dropping another item raises no warning.
        const second = await order(A, 'lemper');
        await call('POST', `/api/orders/${second.token}/cancel`);
        const rest = keep.filter((id) => id !== 'lemper');
        const again = await putMenu(A, { dishIds: rest });
        expect(
          (again.body as { warnings: { removedWithOrders: Array<string> } }).warnings
            .removedWithOrders,
        ).toEqual([]);
      });

      it('lets the seller mark an ordered item sold out: no new orders, existing ones stay', async () => {
        const placed = await order(A, 'pesmol', 2);
        await call('PATCH', '/api/seller/menu/items/pesmol', { ...A_, body: { soldOut: true } });
        const blocked = await call('POST', `/api/s/${A}/orders`, {
          body: {
            firstName: 'Tom',
            language: 'en',
            fulfilment: 'pickup',
            lines: [{ itemId: 'pesmol', qty: 1 }],
          },
        });
        expect(blocked).toMatchObject(ERR(409, 'sold_out'));
        // The existing order can still be edited without adding portions, but not grown.
        const keep = await call('PATCH', `/api/orders/${placed.token}`, { body: { note: 'hi' } });
        expect(keep.status).toBe(200);
        const grow = await call('PATCH', `/api/orders/${placed.token}`, {
          body: { lines: [{ itemId: 'pesmol', qty: 3 }] },
        });
        expect(grow).toMatchObject(ERR(409, 'sold_out'));
        expect((await sellerOrders(A)).find((o) => o.code === placed.code)?.lines[0]?.qty).toBe(2);
        await call('PATCH', '/api/seller/menu/items/pesmol', { ...A_, body: { soldOut: false } });
        expect((await publicMenu(A)).items.find((item) => item.id === 'pesmol')?.soldOut).toBe(
          false,
        );
      });
    });

    it('isolates items: A cannot read, edit or order B items, and A changes do not reach B', async () => {
      expect(
        await call('PATCH', '/api/seller/menu/items/soto-ayam', { ...A_, body: { priceCents: 1 } }),
      ).toMatchObject(ERR(404, 'not_found'));
      const before = JSON.stringify(await menu(B));
      await addItem(A, { name: text('A only') });
      expect(JSON.stringify(await menu(B))).toBe(before);
      expect(JSON.stringify(await publicMenu(B))).not.toContain('A only');
      const orderOnB = await call('POST', `/api/s/${A}/orders`, {
        body: {
          firstName: 'Rina',
          language: 'en',
          fulfilment: 'pickup',
          lines: [{ itemId: 'soto-ayam', qty: 1 }],
        },
      });
      expect(orderOnB.status).toBeGreaterThanOrEqual(400);
      expect((await menu(B)).items).toHaveLength(3);
    });
  });

  describe('kitchen name', () => {
    it('renames the kitchen to 60 characters and the public menu follows', async () => {
      const renamed = await call('PUT', '/api/seller/kitchen/name', {
        ...A_,
        body: { name: '  Dapur Ira  ' },
      });
      expect(renamed).toMatchObject({ status: 200, body: { name: 'Dapur Ira' } });
      expect(
        ((await call('GET', `/api/s/${A}/menu`)).body as { kitchen: { name: string } }).kitchen
          .name,
      ).toBe('Dapur Ira');
      // The other kitchen is untouched.
      expect(
        ((await call('GET', `/api/s/${B}/menu`)).body as { kitchen: { name: string } }).kitchen
          .name,
      ).not.toBe('Dapur Ira');
      for (const name of ['  ', 'x'.repeat(61)]) {
        expect(
          await call('PUT', '/api/seller/kitchen/name', { ...A_, body: { name } }),
        ).toMatchObject(ERR(400, 'invalid_request'));
      }
    });
  });

  describe('chefs', () => {
    it('lists, adds, renames and deletes; deleting unassigns their items', async () => {
      const created = await call('POST', '/api/seller/chefs', {
        ...A_,
        body: { name: '  Chef Budi ' },
      });
      expect(created.status).toBe(201);
      const chef = (created.body as { chef: { id: string; name: string; sellerId: string } }).chef;
      expect(chef.name).toBe('Chef Budi');
      expect(chef.sellerId).toBe(A_ID);
      const id = await addItem(A, { chefId: chef.id });
      expect((await call('GET', '/api/seller/chefs', A_)).body).toMatchObject({
        chefs: [{ id: 'wati' }, { id: chef.id }],
      });
      const renamed = await call('PATCH', `/api/seller/chefs/${chef.id}`, {
        ...A_,
        body: { name: 'Budi' },
      });
      expect((renamed.body as { chef: { name: string } }).chef.name).toBe('Budi');
      expect(await call('DELETE', `/api/seller/chefs/${chef.id}`, A_)).toMatchObject({
        status: 200,
      });
      const item = (await menu(A)).items.find((x) => x.id === id);
      expect(item).toBeDefined();
      expect(item).not.toHaveProperty('chefId');
      expect((await menu(A)).chefs.map((c) => c.id)).toEqual(['wati']);
    });

    it('validates the name and the id', async () => {
      expect(
        await call('POST', '/api/seller/chefs', { ...A_, body: { name: '  ' } }),
      ).toMatchObject(ERR(400, 'invalid_request'));
      expect(
        await call('POST', '/api/seller/chefs', { ...A_, body: { name: 'x'.repeat(41) } }),
      ).toMatchObject(ERR(400, 'invalid_request'));
      expect(
        await call('PATCH', '/api/seller/chefs/nope', { ...A_, body: { name: 'x' } }),
      ).toMatchObject(ERR(404, 'not_found'));
      expect(await call('DELETE', '/api/seller/chefs/nope', A_)).toMatchObject(
        ERR(404, 'not_found'),
      );
    });

    it('isolates chefs between sellers', async () => {
      expect(
        await call('PATCH', '/api/seller/chefs/rudi', { ...A_, body: { name: 'Hacked' } }),
      ).toMatchObject(ERR(404, 'not_found'));
      expect(await call('DELETE', '/api/seller/chefs/rudi', A_)).toMatchObject(
        ERR(404, 'not_found'),
      );
      expect((await call('GET', '/api/seller/chefs', A_)).text).not.toContain('Rudi');
      await call('POST', '/api/seller/chefs', { ...A_, body: { name: 'Only A' } });
      expect((await call('GET', '/api/seller/chefs', B_)).text).not.toContain('Only A');
      expect((await menu(B)).items.find((item) => item.id === 'soto-ayam')?.chefId).toBe('rudi');
      expect(
        await call('POST', '/api/seller/dishes', { ...A_, body: newItem({ chefId: 'rudi' }) }),
      ).toMatchObject(ERR(400, 'unknown_chef'));
    });
  });

  describe('saved sets', () => {
    // plan 001: each sample kitchen starts with one saved set (a list of dish ids).
    const save = (name: string, dishIds: Array<string> = ['pesmol'], seller = A) =>
      call('POST', '/api/seller/saved-sets', { seller, body: { name, dishIds } });
    type SetBody = { id: string; name: string; dishIds: Array<string>; timesUsed: number };
    const setsOf = async (seller: string) =>
      ((await call('GET', '/api/seller/saved-sets', as(seller))).body as { sets: Array<SetBody> })
        .sets;

    it('saves a set of dishes (name trimmed) and lists it after the sample set', async () => {
      expect(await setsOf(A)).toHaveLength(1);
      const saved = await save('  Mine  ', ['pesmol', 'lemper']);
      expect(saved.status).toBe(201);
      expect((saved.body as { set: SetBody }).set).toMatchObject({
        name: 'Mine',
        dishIds: ['pesmol', 'lemper'],
        timesUsed: 0,
      });
      expect((await setsOf(A)).map((set) => set.name)).toEqual(['Classic', 'Mine']);
    });

    it('allows 5 sets and refuses the 6th with limit_reached', async () => {
      for (let n = 2; n <= 5; n++) expect((await save(`Set ${String(n)}`)).status).toBe(201);
      expect(await save('Set 6')).toMatchObject(ERR(409, 'limit_reached'));
      expect(await setsOf(A)).toHaveLength(5);
    });

    it('refuses an empty name, a long name, no dishes and unknown dishes', async () => {
      expect(await save('  ')).toMatchObject(ERR(400, 'invalid_request'));
      expect(await save('x'.repeat(41))).toMatchObject(ERR(400, 'invalid_request'));
      expect(await save('Empty', [])).toMatchObject(ERR(400, 'invalid_request'));
      expect(await save('Unknown', ['nope'])).toMatchObject(ERR(400, 'unknown_item'));
    });

    it('uses a set: its dishes join the menu as new copies, and the use is counted', async () => {
      const id = ((await save('Two', ['pesmol', 'lemper'])).body as { set: SetBody }).set.id;
      await putMenu(A, { dishIds: [] });
      const used = await call('POST', `/api/seller/saved-sets/${id}/use`, A_);
      expect(used.status).toBe(200);
      expect((await menu(A)).items).toHaveLength(2);
      expect((await setsOf(A)).find((set) => set.id === id)?.timesUsed).toBe(1);
      expect(await call('POST', '/api/seller/saved-sets/nope/use', A_)).toMatchObject(
        ERR(404, 'not_found'),
      );
    });

    it('refuses to use a set on a finished menu', async () => {
      const id = ((await save('Two')).body as { set: SetBody }).set.id;
      await call('POST', '/api/seller/menus/current/finish', A_);
      expect(await call('POST', `/api/seller/saved-sets/${id}/use`, A_)).toMatchObject(
        ERR(409, 'week_closed'),
      );
    });

    it('drops a deleted chef from the dishes of a set that is used afterwards', async () => {
      const id = ((await save('Classic')).body as { set: SetBody }).set.id;
      await call('DELETE', '/api/seller/chefs/wati', A_);
      await putMenu(A, { dishIds: [] });
      await call('POST', `/api/seller/saved-sets/${id}/use`, A_);
      expect((await menu(A)).items.every((item) => item.chefId === undefined)).toBe(true);
    });

    it('isolates sets: B cannot see or use an A set, and a dish of A cannot be in a B set', async () => {
      const id = ((await save('A set')).body as { set: SetBody }).set.id;
      expect((await setsOf(B)).map((set) => set.name)).not.toContain('A set');
      expect(await call('POST', `/api/seller/saved-sets/${id}/use`, B_)).toMatchObject(
        ERR(404, 'not_found'),
      );
      expect(await save('Steal', ['pesmol'], B)).toMatchObject(ERR(400, 'unknown_item'));
      // Limits are per seller: A is full, B is not.
      for (let n = 0; n < 3; n++) await save(`A${String(n)}`);
      expect(await save('A full')).toMatchObject(ERR(409, 'limit_reached'));
      expect(await save('B first', ['soto-ayam'], B)).toMatchObject({ status: 201 });
      expect(await setsOf(A)).toHaveLength(5);
    });
  });

  describe('images', () => {
    const upload = (slot: string, dataUrl: unknown, seller = A) =>
      call('PUT', `/api/seller/images/${slot}`, { seller, body: { dataUrl } });

    it('uploads, replaces and removes each of the five slots, and serves them as data URLs', async () => {
      for (const slot of [
        'desktopBanner',
        'phoneBanner',
        'railImage',
        'railIcon',
        'bannerBackgroundImage',
      ]) {
        const url = pngFor(slot as 'railIcon');
        const reply = await upload(slot, url, B);
        expect(reply.status).toBe(200);
        expect((reply.body as { images: Record<string, string> }).images[slot]).toBe(url);
        expect((await publicMenu(B)).kitchen.images).toHaveProperty(slot, url);
      }
      const replacement = pngFor('railIcon', 10);
      await upload('railIcon', replacement, B);
      expect((await publicMenu(B)).kitchen.images?.railIcon).toBe(replacement);
      const removed = await call('DELETE', '/api/seller/images/railIcon', B_);
      expect((removed.body as { images: object }).images).not.toHaveProperty('railIcon');
      expect((await publicMenu(B)).kitchen.images?.railIcon).toBeUndefined();
      for (const slot of ['desktopBanner', 'phoneBanner', 'railImage', 'bannerBackgroundImage']) {
        await call('DELETE', `/api/seller/images/${slot}`, B_);
      }
      // Dapur Demo starts with the sample colour and alt text (D-054); no picture is left.
      expect(Object.keys((await publicMenu(B)).kitchen.images ?? {}).sort()).toEqual([
        'alt',
        'bannerBackground',
      ]);
    });

    it('refuses the wrong type, shape and size, and unknown slots', async () => {
      expect(await upload('railIcon', 'data:image/gif;base64,R0lGODlh')).toMatchObject(
        ERR(400, 'image_type'),
      );
      expect(await upload('railIcon', fakePng(128, 64))).toMatchObject(ERR(400, 'image_ratio'));
      expect(await upload('desktopBanner', fakePng(1600, 320, 600 * 1024))).toMatchObject(
        ERR(400, 'image_too_big'),
      );
      expect(await upload('logo', pngFor('railIcon'))).toMatchObject(ERR(404, 'not_found'));
      expect(await call('PUT', '/api/seller/images/railIcon', { ...A_, body: {} })).toMatchObject(
        ERR(400, 'invalid_request'),
      );
      expect((await publicMenu(A)).kitchen.images?.railIcon).toBe('/samples/rail-icon.png');
    });

    it('sets the banner colour and the alt text in both languages, and clears them', async () => {
      const put = (body: unknown, seller = A) =>
        call('PUT', '/api/seller/images', { seller, body });
      const done = await put({
        bannerBackground: '#112233',
        alt: text('Our kitchen', 'Dapur kami'),
      });
      expect((done.body as { images: Record<string, unknown> }).images).toMatchObject({
        bannerBackground: '#112233',
        alt: text('Our kitchen', 'Dapur kami'),
        desktopBanner: '/samples/banner-wide.jpg',
      });
      expect(await put({ bannerBackground: 'red' })).toMatchObject(ERR(400, 'invalid_request'));
      expect(await put({})).toMatchObject(ERR(400, 'invalid_request'));
      const cleared = await put({ bannerBackground: null, alt: text('', '') });
      const images = (cleared.body as { images: Record<string, unknown> }).images;
      expect(images).not.toHaveProperty('bannerBackground');
      expect(images).not.toHaveProperty('alt');
    });

    it('isolates images between sellers', async () => {
      const before = (await call('GET', '/api/seller/images', B_)).text;
      const url = pngFor('railIcon', 5);
      await upload('railIcon', url, A);
      await call('PUT', '/api/seller/images', { ...A_, body: { bannerBackground: '#abcdef' } });
      await call('DELETE', '/api/seller/images/desktopBanner', A_);
      expect((await call('GET', '/api/seller/images', B_)).text).toBe(before);
      expect(JSON.stringify(await publicMenu(B))).not.toContain(url.slice(0, 60));
      expect((await publicMenu(A)).kitchen.images?.railIcon).toBe(url);
    });
  });

  describe('past weeks (D-027 row 6)', () => {
    /** Finishes the menu and returns the id of the past week it made. */
    async function finishId(seller: string) {
      await call('POST', '/api/seller/menus/current/finish', as(seller));
      const list = (await call('GET', '/api/seller/past-weeks', as(seller))).body as {
        weeks: Array<{ id: string }>;
      };
      return list.weeks[0]?.id ?? '';
    }

    async function weekWithOrders(seller = A) {
      const slug = seller;
      const first = await order(slug, seller === A ? 'lemper' : 'soto-ayam', 2);
      await order(slug, seller === A ? 'pesmol' : 'martabak', 1);
      await call('POST', `/api/seller/orders/${first.code}/paid`, { seller, body: { paid: true } });
      const gone = await order(slug, seller === A ? 'pesmol' : 'martabak', 1);
      await call('POST', `/api/orders/${gone.token}/cancel`);
      return first;
    }

    it('finishing archives totals and orders, empties the live list and leaves the menu finished', async () => {
      await weekWithOrders();
      const finished = await call('POST', '/api/seller/menus/current/finish', A_);
      expect(finished.status).toBe(200);
      expect(finished.body).toMatchObject({ closedOrders: 2 });
      expect((await view(A)).menu['state']).toBe('finished');
      const list = (await call('GET', '/api/seller/past-weeks', A_)).body as {
        weeks: Array<{
          id: string;
          cookingDate: string;
          hasOrders: boolean;
          totals: Record<string, unknown>;
        }>;
      };
      expect(list.weeks).toHaveLength(1);
      const closed = list.weeks[0];
      expect(closed).toMatchObject({
        cookingDate: '2026-10-10',
        hasOrders: true,
        totals: { orders: 2, cancelled: 1, incomeCents: 3500, paidCents: 2000, unpaidCents: 1500 },
      });
      expect(await sellerOrders(A)).toEqual([]);
      const one = (await call('GET', `/api/seller/past-weeks/${closed?.id ?? ''}`, A_)).body as {
        week: { orders?: Array<unknown>; totals: { items: Array<unknown> } };
      };
      expect(one.week.orders).toHaveLength(3);
      expect(one.week.totals.items).toEqual([
        { itemId: 'lemper', name: text('Chicken lemper', 'Lemper ayam'), qty: 2 },
        { itemId: 'pesmol', name: text('Tilapia pesmol', 'Pesmol ikan nila'), qty: 1 },
      ]);
    });

    it('keeps order details for 4 weeks after the cooking date, then only the totals (on read)', async () => {
      await weekWithOrders();
      const id = await finishId(A);
      now = new Date('2026-11-06T12:00:00Z');
      const kept = (await call('GET', `/api/seller/past-weeks/${id}`, A_)).body as {
        week: { orders?: Array<unknown> };
      };
      expect(kept.week.orders).toHaveLength(3);
      now = new Date('2026-11-07T00:00:00Z');
      const reduced = (await call('GET', `/api/seller/past-weeks/${id}`, A_)).body as {
        week: { orders?: Array<unknown>; totals: { orders: number; incomeCents: number } };
      };
      expect(reduced.week.orders).toBeUndefined();
      expect(reduced.week.totals).toMatchObject({ orders: 2, incomeCents: 3500 });
      const list = (await call('GET', '/api/seller/past-weeks', A_)).body as {
        weeks: Array<{ hasOrders: boolean }>;
      };
      expect(list.weeks[0]?.hasOrders).toBe(false);
      const backup = parseBackupFile((await call('GET', '/api/seller/backup', A_)).body);
      expect(backup?.pastWeeks[0]?.orders).toBeUndefined();
    });

    it('lists newest first and 404s an unknown week', async () => {
      const one = await finishId(A);
      const next = await call('POST', '/api/seller/menus', {
        ...A_,
        body: { cookingDate: '2026-10-17' },
      });
      expect(next.status).toBe(201);
      await call('POST', '/api/seller/menus/current/publish', { ...A_, body: { force: true } });
      const two = await finishId(A);
      const list = (await call('GET', '/api/seller/past-weeks', A_)).body as {
        weeks: Array<{ id: string; cookingDate: string }>;
      };
      expect(list.weeks.map((week) => week.id)).toEqual([two, one]);
      expect(list.weeks.map((week) => week.cookingDate)).toEqual(['2026-10-17', '2026-10-10']);
      expect(await call('GET', '/api/seller/past-weeks/nope', A_)).toMatchObject(
        ERR(404, 'not_found'),
      );
    });

    it('isolates past weeks: B sees none of the A weeks and cannot fetch them', async () => {
      await weekWithOrders();
      const id = await finishId(A);
      expect((await call('GET', '/api/seller/past-weeks', B_)).body).toEqual({ weeks: [] });
      expect(await call('GET', `/api/seller/past-weeks/${id}`, B_)).toMatchObject(
        ERR(404, 'not_found'),
      );
      await weekWithOrders(B);
      expect(await sellerOrders(B)).toHaveLength(3);
      expect((await call('GET', '/api/seller/past-weeks', A_)).body).toMatchObject({
        weeks: [{ id }],
      });
    });
  });

  describe('backup and CSV', () => {
    it('exports one seller: kitchen, settings, week, menu, chefs, sets, orders, past weeks', async () => {
      await order(A, 'pesmol');
      await call('POST', '/api/seller/saved-sets', {
        ...A_,
        body: { name: 'Classic', dishIds: ['pesmol'] },
      });
      const reply = await call('GET', '/api/seller/backup', A_);
      const file = parseBackupFile(reply.body);
      expect(file).toMatchObject({
        version: 1,
        seller: { slug: A, name: 'Onde Onde' },
        kitchen: { name: 'Onde Onde' },
      });
      expect(file?.items).toHaveLength(6);
      expect(file?.chefs).toHaveLength(1);
      expect(file?.dishSets).toHaveLength(2); // the sample set and the one saved here
      expect(file?.orders).toHaveLength(1);
      expect(reply.text).not.toContain('Dapur');
      expect(reply.text).not.toContain('Rudi');
    });

    it('restores a backup into the same seller, and never touches the other seller', async () => {
      await order(A, 'pesmol');
      const backup = (await call('GET', '/api/seller/backup', A_)).body;
      const bBefore = (await call('GET', '/api/seller/backup', B_)).body as { exportedAt: string };
      await call('DELETE', '/api/seller/chefs/wati', A_);
      await call('POST', '/api/seller/menus/current/finish', A_);
      await addItem(A, { name: text('Changed') });
      expect(await call('POST', '/api/seller/backup', { ...A_, body: backup })).toMatchObject({
        status: 200,
        body: { ok: true },
      });
      const after = parseBackupFile((await call('GET', '/api/seller/backup', A_)).body);
      const original = parseBackupFile(backup);
      expect(after).toEqual({ ...original, exportedAt: after?.exportedAt });
      expect((await sellerOrders(A)).map((o) => o.lines[0]?.itemId)).toEqual(['pesmol']);
      const bAfter = (await call('GET', '/api/seller/backup', B_)).body as { exportedAt: string };
      expect({ ...bAfter, exportedAt: '' }).toEqual({ ...bBefore, exportedAt: '' });
    });

    it('restoring another seller backup takes the caller seller id and slug, and cannot steal tokens', async () => {
      const aOrder = await order(A, 'pesmol');
      const bBackup = (await call('GET', '/api/seller/backup', B_)).body;
      const aBackup = (await call('GET', '/api/seller/backup', A_)).body;
      expect(await call('POST', '/api/seller/backup', { ...A_, body: bBackup })).toMatchObject({
        status: 200,
      });
      const menuA = await menu(A);
      expect(menuA.seller.slug).toBe(A);
      expect(menuA.kitchen.sellerId).toBe(menuA.seller.id);
      expect(menuA.chefs.every((chef) => chef.sellerId === menuA.seller.id)).toBe(true);
      expect(menuA.items.map((item) => item.id)).toEqual(['soto-ayam', 'martabak', 'es-teh']);
      // B's own data is unchanged.
      expect((await menu(B)).items).toHaveLength(3);
      // An A backup with an order token that belongs to B is refused.
      await call('POST', '/api/seller/backup', { ...A_, body: aBackup });
      expect((await sellerOrders(A)).map((o) => o.token)).toEqual([aOrder.token]);
      const stolen = await call('POST', '/api/seller/backup', { ...B_, body: aBackup });
      expect(stolen).toMatchObject(ERR(400, 'invalid_backup'));
      expect(await sellerOrders(B)).toEqual([]);
    });

    it('refuses invalid backups and leaves the data alone', async () => {
      const good = (await call('GET', '/api/seller/backup', A_)).body as Record<string, unknown>;
      const before = JSON.stringify(await menu(A));
      const bad = [
        {},
        { ...good, version: 2 },
        { ...good, items: 'x' },
        {
          ...good,
          items: [...(good['items'] as Array<unknown>), ...(good['items'] as Array<unknown>)],
        },
        { ...good, week: { ...(good['week'] as object), status: 'open' } },
        { ...good, settings: { ...(good['settings'] as object), whatsappNumber: '123' } },
      ];
      for (const body of bad) {
        expect(await call('POST', '/api/seller/backup', { ...A_, body })).toMatchObject(
          ERR(400, 'invalid_backup'),
        );
      }
      expect(await call('POST', '/api/seller/backup', { ...A_, raw: 'not json' })).toMatchObject(
        ERR(400, 'invalid_backup'),
      );
      expect(JSON.stringify(await menu(A))).toBe(before);
    });

    it('exports orders as CSV with a BOM, escaping, and only the caller orders', async () => {
      await call('POST', '/api/seller/orders', {
        ...A_,
        body: {
          firstName: 'Ibu, "Ani"',
          language: 'en',
          fulfilment: 'delivery',
          lines: [
            { itemId: 'lemper', qty: 2 },
            { itemId: 'pesmol', qty: 1 },
          ],
        },
      });
      await order(B, 'soto-ayam');
      const csv = await call('GET', '/api/seller/orders.csv', A_);
      expect(csv.status).toBe(200);
      expect(csv.headers.get('Content-Type')).toContain('text/csv');
      expect(csv.headers.get('Content-Disposition')).toContain('orders-onde-onde.csv');
      const bytes = new TextEncoder().encode(csv.text);
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
      const lines = csv.text.slice(1).split('\r\n');
      expect(lines[0]).toBe('code,first name,items,total,status,paid,pickup/delivery,created');
      expect(lines).toHaveLength(3);
      expect(lines[1]).toMatch(
        /^[A-Z0-9]{3}-[A-Z0-9]{3},"Ibu, ""Ani""",2 x Chicken lemper; 1 x Tilapia pesmol,35\.00,confirmed,no,delivery,2026-10-07T10:00:00\.000Z$/,
      );
      const other = await call('GET', '/api/seller/orders.csv', B_);
      expect(other.text).toContain('Chicken soto');
      expect(other.text).not.toContain('lemper');
      expect(await call('GET', '/api/seller/orders.csv', as('nope'))).toMatchObject(
        ERR(404, 'seller_not_found'),
      );
    });
  });

  describe('unknown seller on every new endpoint', () => {
    it('404s seller_not_found', async () => {
      const paths: Array<[string, string, unknown?]> = [
        ['GET', '/api/seller/menus/current'],
        ['PUT', '/api/seller/menus/current', { takingOrders: true }],
        ['POST', '/api/seller/menus/current/publish'],
        ['POST', '/api/seller/menus/current/unpublish'],
        ['POST', '/api/seller/menus/current/finish'],
        ['POST', '/api/seller/menus', {}],
        ['GET', '/api/seller/dishes'],
        ['POST', '/api/seller/dishes', newItem()],
        ['PATCH', '/api/seller/menu/items/pesmol', { priceCents: 1 }],
        ['GET', '/api/seller/chefs'],
        ['GET', '/api/seller/saved-sets'],
        ['GET', '/api/seller/pickup-places'],
        ['GET', '/api/seller/preferences'],
        ['PUT', '/api/seller/kitchen/name', { name: 'x' }],
        ['GET', '/api/seller/images'],
        ['PUT', '/api/seller/images/railIcon', { dataUrl: 'x' }],
        ['GET', '/api/seller/past-weeks'],
        ['GET', '/api/seller/backup'],
        ['POST', '/api/seller/backup', {}],
        ['GET', '/api/seller/orders.csv'],
      ];
      for (const [method, path, body] of paths) {
        const reply = await call(method, path, {
          seller: 'nope',
          ...(body !== undefined ? { body } : {}),
        });
        expect([method, path, reply.status, reply.body]).toEqual([
          method,
          path,
          404,
          { error: 'seller_not_found', message: 'Seller not found' },
        ]);
      }
    });
  });
});
