/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument -- loose JSON reply bodies in a test */
// @vitest-environment node
// Plan 001, stage 3: menus, "Your dishes", saved sets of dishes, pickup places, theme and menu
// defaults, finishing a menu, and the first app's endpoints keeping their shapes.
// Runs against a local D1; see mocks/impl.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseBackupFile } from '../shared/backup';
import {
  parseDeleteDishResponse,
  parseDishSetResponse,
  parseFinishMenuResponse,
  parseMenuViewResponse,
  parsePickupPlacesResponse,
  parsePreferencesResponse,
  parseUpdateMenuResponse,
  parseUseDishSetResponse,
} from '../shared/menusContract';
import { runAutoFinish } from '../worker/api/scheduled';
import { devApi, useWorld, type World } from './impl';
import { pngFor } from './images';

const A = 'onde-onde';
const B = 'dapur-demo';

// Wed 7 Oct 2026 (Melbourne): the sample menus cook Sat 10 Oct, cut-off Fri 9 Oct 21:00.
const START = new Date('2026-10-07T10:00:00Z');
// Midnight Melbourne (+11:00) after Sat 10 Oct is 2026-10-10T13:00:00Z.
const JUST_BEFORE_MIDNIGHT = new Date('2026-10-10T12:59:00Z');
const JUST_AFTER_MIDNIGHT = new Date('2026-10-10T13:00:30Z');

describe('menus and dishes', () => {
  const create = useWorld('menus');
  let world: World;
  let now = START;
  let counter = 0;

  type Reply = { status: number; body: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

  async function call(
    method: string,
    path: string,
    options: { seller?: string; body?: unknown } = {},
  ): Promise<Reply> {
    const headers: Record<string, string> = { 'X-Seller': options.seller ?? A };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method,
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      }),
    );
    if (!response) return { status: -1, body: null };
    return { status: response.status, body: await response.json() };
  }

  const place = (name: string) => ({
    place: name,
    directions: { en: '', id: '' },
    window: { start: '10:00', end: '11:00' },
  });
  const currentMenu = async (seller = A) =>
    (await call('GET', '/api/seller/menus/current', { seller })).body.menu;
  const itemIdByName = async (name: string) =>
    (await currentMenu()).dishes.find((dish: { name: { en: string } }) => dish.name.en === name).id;

  async function orderOnMenu(firstName = 'Rina', fulfilment = 'pickup', seller = A) {
    const menu = await currentMenu(seller);
    const reply = await call('POST', '/api/seller/orders', {
      seller,
      body: {
        firstName,
        language: 'en',
        fulfilment,
        lines: [{ itemId: menu.dishes[0].id, qty: 1 }],
      },
    });
    expect(reply.status).toBe(201);
    return reply.body.order as { code: string; token: string };
  }

  beforeEach(async () => {
    now = START;
    counter = 0;
    world = await create({
      now: () => now,
      newToken: () => `token-${String(++counter)}-padding-padding-padding`,
    });
  });

  describe('pickup places', () => {
    it('allows 5 and refuses the 6th with pickup_place_limit; a delete frees a slot', async () => {
      // The sample kitchen starts with 2.
      for (const name of ['Third', 'Fourth', 'Fifth']) {
        expect(
          (await call('POST', '/api/seller/pickup-places', { body: place(name) })).status,
        ).toBe(201);
      }
      const sixth = await call('POST', '/api/seller/pickup-places', { body: place('Sixth') });
      expect(sixth).toMatchObject({ status: 409, body: { error: 'pickup_place_limit' } });
      const list = await call('GET', '/api/seller/pickup-places');
      expect(parsePickupPlacesResponse(list.body)?.places).toHaveLength(5);
      expect((await call('DELETE', '/api/seller/pickup-places/box-hill')).body).toMatchObject({
        ok: true,
      });
      expect(
        (await call('POST', '/api/seller/pickup-places', { body: place('Sixth') })).status,
      ).toBe(201);
    });

    it('keeps the cap per seller', async () => {
      for (let n = 0; n < 3; n++) {
        await call('POST', '/api/seller/pickup-places', { body: place(`A${String(n)}`) });
      }
      expect(
        (await call('POST', '/api/seller/pickup-places', { seller: B, body: place('B') })).status,
      ).toBe(201);
    });

    it('lets a menu use places with its own time, and flags deleting a used place', async () => {
      const updated = await call('PUT', '/api/seller/menus/current', {
        body: {
          places: [
            { placeId: 'glen-waverley', window: { start: '15:00', end: '16:00' } },
            { placeId: 'box-hill' },
          ],
        },
      });
      expect(updated.status).toBe(200);
      const view = parseUpdateMenuResponse(updated.body);
      expect(view?.menu.pickupPoints.map((point) => point.window.start)).toEqual([
        '15:00',
        '10:00',
      ]);
      // The place keeps its usual time; only this menu has the other one.
      const places = (await call('GET', '/api/seller/pickup-places')).body.places;
      expect(places[0].window).toEqual({ start: '14:00', end: '17:00' });

      const removed = await call('DELETE', '/api/seller/pickup-places/box-hill');
      expect(removed.body).toEqual({ ok: true, usedOnLiveMenu: true });
      expect((await currentMenu()).pickupPoints).toHaveLength(1);
      expect(
        (
          await call('PUT', '/api/seller/menus/current', {
            body: { places: [{ placeId: 'nope' }] },
          })
        ).status,
      ).toBe(404);
    });
  });

  describe('one menu at a time', () => {
    it('refuses a new menu while one is live or not published, allows it once finished', async () => {
      expect(await call('POST', '/api/seller/menus', { body: {} })).toMatchObject({
        status: 409,
        body: { error: 'menu_in_progress' },
      });
      await call('POST', '/api/seller/menus/current/unpublish');
      expect((await currentMenu()).menu.state).toBe('not_published');
      expect(await call('POST', '/api/seller/menus', { body: {} })).toMatchObject({
        status: 409,
        body: { error: 'menu_in_progress' },
      });
      await call('POST', '/api/seller/menus/current/publish');
      expect((await call('POST', '/api/seller/menus/current/finish')).status).toBe(200);

      const made = await call('POST', '/api/seller/menus', { body: { cookingDate: '2026-10-17' } });
      expect(made.status).toBe(201);
      const view = parseMenuViewResponse(made.body)?.menu;
      expect(view?.menu).toMatchObject({
        state: 'not_published',
        cookingDate: '2026-10-17',
        // The menu defaults: the evening before at 21:00.
        cutoffAt: '2026-10-16T21:00:00+11:00',
        wizardStep: 0,
        takingOrders: true,
      });
      expect(view?.dishes).toEqual([]);
      // The new menu starts with the places the last one used.
      expect(view?.menu.placeUses.map((use) => use.placeId)).toEqual(['glen-waverley']);
      expect(await call('POST', '/api/seller/menus', { body: {} })).toMatchObject({
        status: 409,
      });
    });

    it('uses the menu defaults for the cut-off and delivery', async () => {
      await call('PUT', '/api/seller/preferences', {
        body: {
          menuDefaults: {
            cutoffDaysBefore: 2,
            cutoffTime: '18:30',
            delivery: { available: true, note: { en: 'Within 5 km', id: 'Dalam 5 km' } },
          },
        },
      });
      await call('POST', '/api/seller/menus/current/finish');
      const made = await call('POST', '/api/seller/menus', { body: { cookingDate: '2026-10-17' } });
      expect(made.body.menu.menu.cutoffAt).toBe('2026-10-15T18:30:00+11:00');
      expect(made.body.menu.menu.delivery).toEqual({
        available: true,
        note: { en: 'Within 5 km', id: 'Dalam 5 km' },
      });
    });

    it('publishes only with dishes, and is instant to edit while live; a finished menu refuses edits', async () => {
      await call('POST', '/api/seller/menus/current/finish');
      await call('POST', '/api/seller/menus', { body: {} });
      expect(await call('POST', '/api/seller/menus/current/publish')).toMatchObject({
        status: 409,
        body: { error: 'no_items' },
      });
      await call('PUT', '/api/seller/menus/current', { body: { dishIds: ['nasi-campur'] } });
      const published = await call('POST', '/api/seller/menus/current/publish');
      expect(published.body.menu.menu.state).toBe('live');
      // Live edits are instant: a new cut-off and taking orders off.
      const edited = await call('PUT', '/api/seller/menus/current', {
        body: { takingOrders: false, cutoffAt: '2026-10-30T20:00:00+11:00' },
      });
      expect(edited.status).toBe(200);
      expect(edited.body.menu.menu).toMatchObject({ takingOrders: false });
      await call('POST', '/api/seller/menus/current/finish');
      expect(
        await call('PUT', '/api/seller/menus/current', { body: { takingOrders: true } }),
      ).toMatchObject({ status: 409, body: { error: 'week_closed' } });
    });

    it('puts dishes on the menu from the library, keeping copies and warning about ordered ones', async () => {
      const lemper = await itemIdByName('Chicken lemper');
      await orderOnMenu();
      const menu = await currentMenu();
      const order = await call('POST', '/api/seller/orders', {
        body: {
          firstName: 'Tom',
          language: 'en',
          fulfilment: 'pickup',
          lines: [{ itemId: lemper, qty: 1 }],
        },
      });
      expect(order.status).toBe(201);
      const keep = menu.dishes
        .filter((dish: { id: string }) => dish.id !== lemper)
        .map((dish: { dishId: string }) => dish.dishId);
      const dropped = await call('PUT', '/api/seller/menus/current', { body: { dishIds: keep } });
      expect(dropped.status).toBe(200);
      expect(dropped.body.warnings.removedWithOrders).toEqual([lemper]);
      expect(parseUpdateMenuResponse(dropped.body)).not.toBeNull();
      // The ordered dish is still on that order (snapshot).
      expect((await call('GET', '/api/seller/orders')).body.orders).toHaveLength(2);
      const back = await call('PUT', '/api/seller/menus/current', {
        body: { dishIds: [...keep, 'lemper'] },
      });
      expect(back.body.menu.dishes).toHaveLength(keep.length + 1);
      expect(
        (await call('PUT', '/api/seller/menus/current', { body: { dishIds: ['nope'] } })).status,
      ).toBe(400);
    });
  });

  describe('your dishes', () => {
    it('creates, edits and lists dishes; sold out is per menu, not per dish', async () => {
      const made = await call('POST', '/api/seller/dishes', {
        body: { name: { en: 'Soup', id: 'Sup' }, priceCents: 900, limit: 5, chefId: 'wati' },
      });
      expect(made.status).toBe(201);
      const id = made.body.dish.id as string;
      const patched = await call('PATCH', `/api/seller/dishes/${id}`, {
        body: { priceCents: 950, limit: null, chefId: null },
      });
      expect(patched.body.dish).toMatchObject({ priceCents: 950 });
      expect(patched.body.dish.limit).toBeUndefined();
      expect(patched.body.dish.chefId).toBeUndefined();
      expect(
        (await call('PATCH', `/api/seller/dishes/${id}`, { body: { soldOut: true } })).status,
      ).toBe(400);
      expect(
        (
          await call('POST', '/api/seller/dishes', {
            body: { name: { en: 'X', id: 'X' }, priceCents: 1, chefId: 'nope' },
          })
        ).body.error,
      ).toBe('unknown_chef');
      const listed = (await call('GET', '/api/seller/dishes')).body.dishes as Array<{ id: string }>;
      expect(listed.map((dish) => dish.id)).toContain(id);
      // Dishes are per seller.
      expect(
        (await call('GET', '/api/seller/dishes', { seller: B })).body.dishes.map(
          (d: { id: string }) => d.id,
        ),
      ).not.toContain(id);
      expect(
        (await call('PATCH', `/api/seller/dishes/${id}`, { seller: B, body: { priceCents: 1 } }))
          .status,
      ).toBe(404);
    });

    it('allows deleting a dish used on the live menu and warns with a flag; the menu keeps its copy', async () => {
      const unused = await call('POST', '/api/seller/dishes', {
        body: { name: { en: 'Soup', id: 'Sup' }, priceCents: 900 },
      });
      const free = await call('DELETE', `/api/seller/dishes/${unused.body.dish.id}`);
      expect(parseDeleteDishResponse(free.body)).toEqual({ ok: true, usedOnLiveMenu: false });

      const before = (await currentMenu()).dishes.length;
      const used = await call('DELETE', '/api/seller/dishes/pesmol');
      expect(used.status).toBe(200);
      expect(parseDeleteDishResponse(used.body)).toEqual({ ok: true, usedOnLiveMenu: true });
      const menu = await currentMenu();
      expect(menu.dishes).toHaveLength(before);
      expect(
        menu.dishes.find((dish: { id: string }) => dish.id === 'pesmol').dishId,
      ).toBeUndefined();
      expect((await call('DELETE', '/api/seller/dishes/pesmol')).status).toBe(404);
      // Gone from saved sets too.
      const sets = (await call('GET', '/api/seller/saved-sets')).body.sets;
      expect(sets[0].dishIds).not.toContain('pesmol');
    });

    it("moves a deleted chef's dishes to the whole kitchen", async () => {
      await call('DELETE', '/api/seller/chefs/wati');
      const dishes = (await call('GET', '/api/seller/dishes')).body.dishes as Array<{
        chefId?: string;
      }>;
      expect(dishes.every((dish) => dish.chefId === undefined)).toBe(true);
    });
  });

  describe('saved sets of dishes', () => {
    it('creates a set, adds its dishes to the menu and counts the use', async () => {
      await call('POST', '/api/seller/menus/current/finish');
      await call('POST', '/api/seller/menus', { body: {} });
      const made = await call('POST', '/api/seller/saved-sets', {
        body: { name: 'Two', dishIds: ['pesmol', 'lemper'] },
      });
      expect(made.status).toBe(201);
      expect(parseDishSetResponse(made.body)?.set).toMatchObject({ name: 'Two', timesUsed: 0 });
      expect(
        (await call('POST', '/api/seller/saved-sets', { body: { name: 'Bad', dishIds: ['nope'] } }))
          .status,
      ).toBe(400);
      const used = await call('POST', `/api/seller/saved-sets/${made.body.set.id}/use`);
      expect(parseUseDishSetResponse(used.body)?.added).toBe(2);
      // Using it again adds nothing: the dishes are already on the menu.
      const again = await call('POST', `/api/seller/saved-sets/${made.body.set.id}/use`);
      expect(again.body.added).toBe(0);
      const listed = (await call('GET', '/api/seller/saved-sets')).body.sets as Array<{
        id: string;
        timesUsed: number;
      }>;
      expect(listed.find((set) => set.id === made.body.set.id)?.timesUsed).toBe(2);
      expect((await call('POST', '/api/seller/saved-sets/nope/use')).status).toBe(404);
      expect(
        (await call('POST', `/api/seller/saved-sets/${made.body.set.id}/use`, { seller: B }))
          .status,
      ).toBe(404);
    });
  });

  describe('theme and menu defaults', () => {
    it('starts on onde, sets either part, and refuses an unknown theme', async () => {
      const first = parsePreferencesResponse((await call('GET', '/api/seller/preferences')).body);
      expect(first?.preferences.theme).toBe('onde');
      expect(first?.preferences.menuDefaults).toEqual({
        cutoffDaysBefore: 1,
        cutoffTime: '21:00',
        delivery: { available: false, note: { en: '', id: '' } },
      });
      const set = await call('PUT', '/api/seller/preferences', { body: { theme: 'jawa' } });
      expect(set.body.preferences.theme).toBe('jawa');
      expect(set.body.preferences.menuDefaults.cutoffTime).toBe('21:00');
      expect(
        (await call('PUT', '/api/seller/preferences', { body: { theme: 'nope' } })).status,
      ).toBe(400);
      expect((await call('PUT', '/api/seller/preferences', { body: {} })).status).toBe(400);
      // The other kitchen is untouched.
      expect(
        (await call('GET', '/api/seller/preferences', { seller: B })).body.preferences.theme,
      ).toBe('onde');
    });

    it('survives the first app saving its settings', async () => {
      await call('PUT', '/api/seller/preferences', { body: { theme: 'bali' } });
      const settings = (await call('GET', '/api/seller/settings')).body.settings;
      await call('PUT', '/api/seller/settings', { body: { ...settings, orderingOpen: false } });
      expect((await call('GET', '/api/seller/preferences')).body.preferences.theme).toBe('bali');
      expect((await currentMenu()).menu.takingOrders).toBe(false);
    });
  });

  describe('finishing', () => {
    it('finish now closes open orders, archives the menu and keeps the totals', async () => {
      const pickup = await orderOnMenu('Rina', 'pickup');
      await orderOnMenu('Tom', 'delivery');
      // Seller-entered orders start confirmed; this one is ready, the other still open.
      await call('POST', `/api/seller/orders/${pickup.code}/status`, {
        body: { to: 'ready_for_pickup' },
      });
      const done = await call('POST', '/api/seller/menus/current/finish');
      expect(done.status).toBe(200);
      expect(parseFinishMenuResponse(done.body)).toMatchObject({ closedOrders: 2 });
      expect(done.body.menu.menu.state).toBe('finished');
      expect((await call('GET', '/api/seller/orders')).body.orders).toEqual([]);
      const weeks = (await call('GET', '/api/seller/past-weeks')).body.weeks;
      expect(weeks).toHaveLength(1);
      expect(weeks[0].totals.orders).toBe(2);
      const detail = (await call('GET', `/api/seller/past-weeks/${weeks[0].id}`)).body.week;
      expect(detail.orders.map((o: { status: string }) => o.status).sort()).toEqual([
        'collected',
        'delivered',
      ]);
      // The customer's order page says so.
      const customer = await call('GET', `/api/orders/${pickup.token}`);
      expect(customer.body.order.status).toBe('collected');
      expect(customer.body.order.inbox[0]).toMatchObject({ kind: 'status', status: 'collected' });
    });

    it('does not finish a menu that is not live, or one that is already finished', async () => {
      await call('POST', '/api/seller/menus/current/unpublish');
      expect(await call('POST', '/api/seller/menus/current/finish')).toMatchObject({
        status: 409,
        body: { error: 'menu_not_live' },
      });
      await call('POST', '/api/seller/menus/current/publish');
      await call('POST', '/api/seller/menus/current/finish');
      expect(await call('POST', '/api/seller/menus/current/finish')).toMatchObject({
        status: 409,
        body: { error: 'menu_not_live' },
      });
      expect((await call('GET', '/api/seller/past-weeks')).body.weeks).toHaveLength(1);
    });

    it('auto-finishes at midnight (Melbourne) after the cooking day, and only then', async () => {
      await orderOnMenu('Rina', 'pickup');
      const lines: Array<string> = [];
      now = JUST_BEFORE_MIDNIGHT;
      expect(await runAutoFinish({ DB: world.db.d1 }, now, (l) => lines.push(l))).toEqual({
        menus: 0,
        orders: 0,
      });
      expect((await currentMenu()).menu.state).toBe('live');

      now = JUST_AFTER_MIDNIGHT;
      const counts = await runAutoFinish({ DB: world.db.d1 }, now, (l) => lines.push(l));
      // Both sample kitchens cook on 10 Oct.
      expect(counts).toEqual({ menus: 2, orders: 1 });
      expect((await currentMenu()).menu.state).toBe('finished');
      expect((await currentMenu(B)).menu.state).toBe('finished');
      expect((await call('GET', '/api/seller/orders')).body.orders).toEqual([]);
      expect(lines).toEqual(['auto-finish: 2 menu(s) finished, 1 open order(s) closed']);
    });

    it('is idempotent: a second run finds nothing and writes nothing', async () => {
      await orderOnMenu('Rina', 'pickup');
      now = JUST_AFTER_MIDNIGHT;
      await runAutoFinish({ DB: world.db.d1 }, now, () => undefined);
      const weeks = await world.db.first<{ n: number }>('SELECT COUNT(*) AS n FROM past_weeks');
      const again = await runAutoFinish({ DB: world.db.d1 }, now, () => undefined);
      expect(again).toEqual({ menus: 0, orders: 0 });
      expect(await world.db.first('SELECT COUNT(*) AS n FROM past_weeks')).toEqual(weeks);
      expect((await call('GET', '/api/seller/past-weeks')).body.weeks).toHaveLength(1);
    });

    it('leaves a not published menu and a finished one alone', async () => {
      await call('POST', '/api/seller/menus/current/unpublish');
      now = JUST_AFTER_MIDNIGHT;
      const counts = await runAutoFinish({ DB: world.db.d1 }, now, () => undefined);
      expect(counts).toEqual({ menus: 1, orders: 0 }); // only the other kitchen was live
      expect((await currentMenu()).menu.state).toBe('not_published');
    });
  });

  describe('stage 7: the menu screens', () => {
    it('keeps the reads other screens use, and the old week and sets calls are gone', async () => {
      const settings = (await call('GET', '/api/seller/settings')).body;
      expect(Object.keys(settings).sort()).toEqual(['sellerId', 'settings']);
      const publicMenu = (await call('GET', `/api/s/${A}/menu`)).body;
      expect(Object.keys(publicMenu).sort()).toEqual([
        'items',
        'kitchen',
        'ordering',
        'seller',
        'theme',
        'week',
      ]);
      expect(publicMenu.items[0]).not.toHaveProperty('chefId');
      const sellerMenu = (await call('GET', '/api/seller/menu')).body;
      expect(sellerMenu.items.length).toBeGreaterThan(0);
      for (const [method, path] of [
        ['GET', '/api/seller/week'],
        ['POST', '/api/seller/week/publish'],
        ['GET', '/api/seller/sets'],
      ] as const) {
        // No route at all (call() reports -1; the Worker answers 404 for it).
        expect((await call(method, path)).status).toBe(-1);
      }
    });

    it('warns instead of refusing an empty menu, and publishes it with force (D-062)', async () => {
      await call('POST', '/api/seller/menus/current/unpublish');
      await call('PUT', '/api/seller/menus/current', { body: { dishIds: [] } });
      const warned = await call('POST', '/api/seller/menus/current/publish');
      expect(warned).toMatchObject({
        status: 409,
        body: { error: 'no_items', warning: { code: 'no_dishes' } },
      });
      expect((await currentMenu()).menu.state).toBe('not_published');
      const forced = await call('POST', '/api/seller/menus/current/publish', {
        body: { force: true },
      });
      expect(forced.status).toBe(200);
      expect(forced.body.menu.menu.state).toBe('live');
    });

    it('unpublishes a live menu and deletes one that is not published', async () => {
      expect((await call('POST', '/api/seller/menus/current/unpublish')).body.menu.menu.state).toBe(
        'not_published',
      );
      const deleted = await call('DELETE', '/api/seller/menus/current');
      expect(deleted.body.menu.menu.state).toBe('finished');
      expect(deleted.body.menu.dishes).toEqual([]);
      expect((await call('GET', '/api/seller/past-weeks')).body.weeks).toEqual([]);
      // Only a menu that is not published can be deleted.
      const fresh = await call('POST', '/api/seller/menus', { body: {} });
      expect(fresh.status).toBe(201);
      await call('POST', '/api/seller/menus/current/publish', { body: { force: true } });
      expect((await call('DELETE', '/api/seller/menus/current')).status).toBe(409);
    });

    it('keeps a menu picture, 3:2, and refuses a wrong shape', async () => {
      const good = pngFor('menuPicture');
      const put = await call('PUT', '/api/seller/menus/current/picture', {
        body: { dataUrl: good },
      });
      expect(put.body.menu.menu.pictureRef).toBe(good);
      const bad = await call('PUT', '/api/seller/menus/current/picture', {
        body: { dataUrl: pngFor('desktopBanner') },
      });
      expect(bad).toMatchObject({ status: 400, body: { error: 'image_ratio' } });
      const removed = await call('DELETE', '/api/seller/menus/current/picture');
      expect(removed.body.menu.menu.pictureRef).toBeUndefined();
    });
  });

  describe('backup', () => {
    it('includes the new records and restores them', async () => {
      await call('PUT', '/api/seller/preferences', { body: { theme: 'sunda' } });
      await call('PUT', '/api/seller/menus/current', {
        body: { places: [{ placeId: 'glen-waverley', window: { start: '15:00', end: '16:00' } }] },
      });
      const out = (await call('GET', '/api/seller/backup')).body;
      const file = parseBackupFile(out);
      expect(file?.menu).toMatchObject({ state: 'live', takingOrders: true });
      expect(file?.menu?.placeUses).toEqual([
        { placeId: 'glen-waverley', window: { start: '15:00', end: '16:00' } },
      ]);
      expect(file?.pickupPlaces).toHaveLength(2);
      expect(file?.dishes).toHaveLength(6);
      expect(file?.dishSets).toEqual([
        expect.objectContaining({ id: 'set-onde-classic', timesUsed: 3 }),
      ]);
      expect(file?.preferences?.theme).toBe('sunda');

      await call('DELETE', '/api/seller/pickup-places/box-hill');
      await call('DELETE', '/api/seller/dishes/lemper');
      await call('PUT', '/api/seller/preferences', { body: { theme: 'bali' } });
      expect((await call('POST', '/api/seller/backup', { body: out })).status).toBe(200);
      const after = parseBackupFile((await call('GET', '/api/seller/backup')).body);
      expect(after).toEqual({ ...file, exportedAt: after?.exportedAt });
    });

    it('still restores a file made before these records, rebuilding them', async () => {
      const out = (await call('GET', '/api/seller/backup')).body;
      delete out.menu;
      delete out.pickupPlaces;
      delete out.dishes;
      delete out.itemDishIds;
      delete out.dishSets;
      delete out.preferences;
      expect((await call('POST', '/api/seller/backup', { body: out })).status).toBe(200);
      const menu = await currentMenu();
      expect(menu.menu.state).toBe('live');
      expect(menu.dishes.every((dish: { dishId?: string }) => dish.dishId !== undefined)).toBe(
        true,
      );
      expect((await call('GET', '/api/seller/dishes')).body.dishes.length).toBeGreaterThanOrEqual(
        6,
      );
      expect((await call('GET', '/api/seller/preferences')).body.preferences.theme).toBe('onde');
    });
  });
});
