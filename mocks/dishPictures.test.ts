/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- loose JSON reply bodies in a test */
// @vitest-environment node
// Plan 067 (D-103): one picture per dish. Roles (owner, a chef on their own dish only), the size and
// shape checks, the 300 cap, and that a file a live menu still shows is never deleted.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseKeyResponse, parseSessionResponse } from '../shared/authContract';
import { MAX_DISH_PICTURES } from '../shared/limits';
import type { ImageBucket } from '../worker/images/r2';
import { devApi, useWorld, type World } from './impl';
import { fakePng, pngFor } from './images';

const SELLER_ID = 'seller-onde-onde';
const START = Date.parse('2026-10-07T10:00:00Z');

describe('dish pictures (plan 067)', () => {
  const create = useWorld('dishpictures');
  let world: World;
  let tokens = 0;
  let objects: Map<string, Uint8Array>;
  let bucket: ImageBucket;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose JSON reply body, read by property in this test
  type Reply = { status: number; body: any; setCookie: string | null };
  async function call(
    method: string,
    path: string,
    options: { token?: string; body?: unknown } = {},
  ): Promise<Reply> {
    const headers: Record<string, string> = {};
    if (options.token) headers['Cookie'] = `__Host-session=${options.token}`;
    else headers['X-Seller'] = 'onde-onde';
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method,
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      }),
      { images: bucket },
    );
    if (!response) return { status: -1, body: null, setCookie: null };
    const text = await response.text();
    const setCookie = response.headers.get('set-cookie');
    try {
      return { status: response.status, body: JSON.parse(text), setCookie };
    } catch {
      return { status: response.status, body: text, setCookie };
    }
  }

  function session(reply: Reply) {
    const parsed = parseSessionResponse(reply.body);
    const token = /__Host-session=([^;]+)/.exec(reply.setCookie ?? '')?.[1];
    if (!parsed || !token) throw new Error(`not a session: ${JSON.stringify(reply)}`);
    return { ...parsed, token };
  }
  async function newPerson(inviteKey: string, deviceId: string, password: string) {
    const setup = session(
      await call('POST', '/api/auth/invite', { body: { key: inviteKey, deviceId } }),
    );
    return session(
      await call('POST', '/api/auth/register', {
        token: setup.token,
        body: { kind: 'password', password, deviceName: 'Phone' },
      }),
    );
  }

  beforeEach(async () => {
    tokens = 0;
    world = await create({
      now: () => new Date(START),
      newToken: () => `token-${String(++tokens)}`,
    });
    objects = new Map();
    bucket = {
      put(key, value) {
        objects.set(key, value instanceof Uint8Array ? value : new Uint8Array(value));
        return Promise.resolve();
      },
      get: () => Promise.resolve(null),
      delete(key) {
        objects.delete(key);
        return Promise.resolve();
      },
    };
  });

  const dish = (name: string, chefId?: string) => ({
    name: { en: name, id: name },
    priceCents: 5000,
    ...(chefId ? { chefId } : {}),
  });
  const newDish = async (name: string, token?: string, chefId?: string) =>
    (
      await call('POST', '/api/seller/dishes', {
        ...(token ? { token } : {}),
        body: dish(name, chefId),
      })
    ).body.dish.id as string;
  const putPicture = (id: string, dataUrl: string, token?: string) =>
    call('PUT', `/api/seller/dishes/${id}/picture`, {
      ...(token ? { token } : {}),
      body: { dataUrl },
    });
  const listed = async (id: string) =>
    (
      (await call('GET', '/api/seller/dishes')).body.dishes as Array<{
        id: string;
        pictureRef?: string;
      }>
    ).find((d) => d.id === id);

  it('the owner adds, replaces and removes a picture; the file follows', async () => {
    const id = await newDish('Lumpia');
    const first = await putPicture(id, pngFor('dishPicture', 1));
    expect(first.status).toBe(200);
    const ref1 = first.body.dish.pictureRef as string;
    expect(ref1).toMatch(/^\/images\/sellers\/seller-onde-onde\/dishPicture-[0-9a-f]{16}\.png$/);
    expect((await listed(id))?.pictureRef).toBe(ref1);
    expect([...objects.keys()]).toHaveLength(1);

    const second = await putPicture(id, pngFor('dishPicture', 2));
    const ref2 = second.body.dish.pictureRef as string;
    expect(ref2).not.toBe(ref1);
    expect([...objects.keys()]).toEqual([ref2.slice('/images/'.length)]);

    const removed = await call('DELETE', `/api/seller/dishes/${id}/picture`);
    expect(removed.status).toBe(200);
    expect(removed.body.dish.pictureRef).toBeUndefined();
    expect((await listed(id))?.pictureRef).toBeUndefined();
    expect(objects.size).toBe(0);
  });

  it('refuses a picture over 200 KB, a non-square one and a non-image; an unknown dish is 404', async () => {
    const id = await newDish('Lumpia');
    const big = await putPicture(id, pngFor('dishPicture', 210 * 1024));
    expect([big.status, big.body.error]).toEqual([400, 'image_too_big']);
    const wide = await putPicture(id, fakePng(900, 600));
    expect([wide.status, wide.body.error]).toEqual([400, 'image_ratio']);
    const text = await putPicture(id, 'data:text/plain;base64,aGVsbG8=');
    expect([text.status, text.body.error]).toEqual([400, 'image_type']);
    const missing = await putPicture('nope', pngFor('dishPicture', 3));
    expect(missing.status).toBe(404);
    expect(objects.size).toBe(0);
    expect((await listed(id))?.pictureRef).toBeUndefined();
  });

  it('a chef changes the picture of their own dish only', async () => {
    const ownerKey = await world.repo.auth.createKey({
      role: 'owner',
      sellerId: SELLER_ID,
      displayName: 'Olive',
    });
    const owner = await newPerson(ownerKey.key, 'owner-0001-aaaa', 'correct horse battery');
    const invite = await call('POST', '/api/seller/chef-invites', {
      token: owner.token,
      body: { chefId: 'wati' },
    });
    const key = parseKeyResponse(invite.body);
    if (!key) throw new Error('no chef key');
    const wati = await newPerson(key.key, 'wati-0001-bbbb', 'chef long password');

    const own = await newDish('Lumpia', wati.token);
    const kitchenDish = await newDish('Everyone', owner.token);
    const ok = await putPicture(own, pngFor('dishPicture', 4), wati.token);
    expect(ok.status).toBe(200);
    for (const id of [kitchenDish, 'nope']) {
      expect((await putPicture(id, pngFor('dishPicture', 5), wati.token)).status).toBe(403);
      expect(
        (await call('DELETE', `/api/seller/dishes/${id}/picture`, { token: wati.token })).status,
      ).toBe(403);
    }
    expect(
      (await call('DELETE', `/api/seller/dishes/${own}/picture`, { token: wati.token })).status,
    ).toBe(200);
    // The owner may do it on any dish.
    expect((await putPicture(kitchenDish, pngFor('dishPicture', 6), owner.token)).status).toBe(200);
  });

  it('stops at 300 pictures per kitchen, but a dish that has one can still replace it', async () => {
    const id = await newDish('Lumpia');
    const other = await newDish('Soto');
    const at = new Date(START).toISOString();
    for (let i = 0; i < MAX_DISH_PICTURES - 1; i++) {
      await world.db
        .stmt(
          `INSERT INTO dishes (seller_id, id, name_en, name_id, price_cents, created_at, picture_ref)
           VALUES (?, ?, ?, ?, 100, ?, ?)`,
          SELLER_ID,
          `bulk-${String(i)}`,
          `Bulk ${String(i)}`,
          `Bulk ${String(i)}`,
          at,
          `/samples/bulk-${String(i)}.jpg`,
        )
        .run();
    }
    expect((await putPicture(id, pngFor('dishPicture', 7))).status).toBe(200); // the 300th
    const refused = await putPicture(other, pngFor('dishPicture', 8));
    expect([refused.status, refused.body.error]).toEqual([409, 'dish_picture_limit']);
    expect([...objects.keys()]).toHaveLength(1);
    expect((await putPicture(id, pngFor('dishPicture', 9))).status).toBe(200);
    expect((await listed(other))?.pictureRef).toBeUndefined();
  });

  it('the menu copy shows the picture to customers, and its file is kept while a menu uses it', async () => {
    const id = await newDish('Lumpia');
    const added = await call('POST', '/api/seller/menus/current/items', { body: { dishId: id } });
    expect(added.status).toBe(201);
    const stored = await putPicture(id, pngFor('dishPicture', 10));
    const ref = stored.body.dish.pictureRef as string;
    const seller = await world.repo.sellerById(SELLER_ID);
    const copy = (await seller?.getSellerMenu())?.items.find((i) => i.name.en === 'Lumpia');
    expect(copy?.pictureRef).toBe(ref);

    // Deleting the dish keeps the file: the live menu still shows it.
    expect((await call('DELETE', `/api/seller/dishes/${id}`)).status).toBe(200);
    expect(objects.has(ref.slice('/images/'.length))).toBe(true);
    const still = (await seller?.getSellerMenu())?.items.find((i) => i.name.en === 'Lumpia');
    expect(still?.pictureRef).toBe(ref);
  });

  it('removing the picture clears the menu copy and deletes the file', async () => {
    const id = await newDish('Lumpia');
    await call('POST', '/api/seller/menus/current/items', { body: { dishId: id } });
    const ref = (await putPicture(id, pngFor('dishPicture', 11))).body.dish.pictureRef as string;
    await call('DELETE', `/api/seller/dishes/${id}/picture`);
    const seller = await world.repo.sellerById(SELLER_ID);
    const copy = (await seller?.getSellerMenu())?.items.find((i) => i.name.en === 'Lumpia');
    expect(copy?.pictureRef).toBeUndefined();
    expect(objects.has(ref.slice('/images/'.length))).toBe(false);
  });

  it('the backup carries the picture ref', async () => {
    const id = await newDish('Lumpia');
    const ref = (await putPicture(id, pngFor('dishPicture', 12))).body.dish.pictureRef as string;
    const backup = await call('GET', '/api/seller/backup');
    expect(
      (backup.body.dishes as Array<{ id: string; pictureRef?: string }>).find((d) => d.id === id)
        ?.pictureRef,
    ).toBe(ref);
  });
});
