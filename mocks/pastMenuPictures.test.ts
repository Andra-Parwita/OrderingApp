/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- loose JSON reply bodies in a test */
// @vitest-environment node
// Plan 064, stage 1: a finished menu keeps its picture; the 10 newest past menus keep theirs and the
// 11th finish deletes the oldest file (unless something still uses it); a picture can be reused.
import { beforeEach, describe, expect, it } from 'vitest';
import { PAST_MENU_PICTURES_KEPT } from '../shared/limits';
import type { ImageBucket } from '../worker/images/r2';
import { runAutoFinish } from '../worker/api/scheduled';
import { devApi, useWorld, type World } from './impl';
import { pngFor } from './images';

const A = 'onde-onde';

describe('past menu pictures', () => {
  const create = useWorld('past-menu-pictures');
  let world: World;
  let objects: Map<string, Uint8Array>;
  let bucket: ImageBucket;

  beforeEach(async () => {
    world = await create({ now: () => new Date('2026-10-07T10:00:00Z') });
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

  async function call(method: string, path: string, body?: unknown) {
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method,
        headers: {
          'X-Seller': A,
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
      { images: bucket },
    );
    return { status: response?.status ?? -1, body: await response?.json() };
  }
  const put = (padding: number) =>
    call('PUT', '/api/seller/menus/current/picture', { dataUrl: pngFor('menuPicture', padding) });
  const finish = () => call('POST', '/api/seller/menus/current/finish');
  const startAndPublish = async (body: unknown = {}) => {
    expect((await call('POST', '/api/seller/menus', body)).status).toBe(201);
    await call('POST', '/api/seller/menus/current/publish', { force: true });
  };
  const past = async () =>
    (await call('GET', '/api/seller/past-weeks')).body.weeks as Array<{
      id: string;
      pictureUrl?: string;
    }>;
  const files = () => [...objects.keys()];

  it('keeps 10: the 11th finish deletes the oldest file', async () => {
    expect(PAST_MENU_PICTURES_KEPT).toBe(10);
    const refs: Array<string> = [];
    for (let i = 0; i < 11; i++) {
      if (i > 0) await startAndPublish();
      const stored = await put(i + 1);
      expect(stored.status).toBe(200);
      refs.push(stored.body.menu.menu.pictureRef);
      expect((await finish()).status).toBe(200);
    }
    const weeks = await past();
    expect(weeks).toHaveLength(11);
    expect(weeks.filter((week) => week.pictureUrl !== undefined)).toHaveLength(10);
    expect(weeks[0]?.pictureUrl).toBe(refs[10]);
    expect(weeks[10]?.pictureUrl).toBeUndefined();
    expect(files()).toHaveLength(10);
    expect(files()).not.toContain(refs[0]?.replace('/images/', ''));
    expect(files()).toContain(refs[1]?.replace('/images/', ''));
  });

  it('a picture reused by the current menu survives its past menu being pruned and a replace', async () => {
    // Menu 0 has picture P0 and finishes.
    const first = await put(1);
    const p0: string = first.body.menu.menu.pictureRef;
    await finish();
    const oldest = (await past())[0]?.id as string;
    // The next menu starts from it (copies the ref), then 10 more menus finish.
    await startAndPublish({ pictureFromPastMenu: oldest });
    expect((await call('GET', '/api/seller/menus/current')).body.menu.menu.pictureRef).toBe(p0);
    for (let i = 0; i < 9; i++) {
      await finish();
      await startAndPublish();
      await put(i + 2);
    }
    await finish(); // 11th past menu: menu 0's row is pruned
    const weeks = await past();
    expect(weeks).toHaveLength(11);
    expect(weeks[10]?.pictureUrl).toBeUndefined();
    // P0 is also the picture of the second past menu (which started from it): the file stays.
    expect(files()).toContain(p0.replace('/images/', ''));
  });

  it('replacing the current picture keeps a file a past menu still shows', async () => {
    const p = await put(1);
    const ref: string = p.body.menu.menu.pictureRef;
    await finish();
    const pastId = (await past())[0]?.id as string;
    await startAndPublish();
    expect(
      (await call('PUT', '/api/seller/menus/current/picture', { pastMenuId: pastId })).body.menu
        .menu.pictureRef,
    ).toBe(ref);
    await put(2); // replace: the old file is still a past menu's
    expect(files()).toContain(ref.replace('/images/', ''));
    expect(files()).toHaveLength(2);
    await call('DELETE', '/api/seller/menus/current/picture');
    expect(files()).toHaveLength(1); // only the new one is gone; the past menu's stays
    expect(files()).toContain(ref.replace('/images/', ''));
    expect(
      (await call('PUT', '/api/seller/menus/current/picture', { pastMenuId: 'nope' })).status,
    ).toBe(404);
  });

  it('the midnight auto-finish keeps the picture and prunes with the bucket', async () => {
    await put(1);
    const lines: Array<string> = [];
    const counts = await runAutoFinish(
      { DB: world.db.d1, IMAGES: bucket },
      new Date('2026-10-10T13:00:30Z'),
      (l) => lines.push(l),
    );
    expect(counts.menus).toBeGreaterThanOrEqual(1);
    expect((await past())[0]?.pictureUrl).toBeDefined();
    expect(files()).toHaveLength(1);
  });
});
