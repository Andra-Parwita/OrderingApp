/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- loose JSON reply bodies in a test */
// @vitest-environment node
// Plan 056, stage 1: the kitchen's "Languages for customers" setting on the server. (Chef and
// helper getting 403 on PUT /api/seller/settings is covered in auth.test.ts and helper.test.ts.)
import { beforeEach, describe, expect, it } from 'vitest';
import { parseMenuResponse } from '../shared/menuContract';
import { devApi, useWorld, type World } from './impl';

const A = 'onde-onde';

describe('languages for customers (plan 056)', () => {
  const create = useWorld('languages');
  let world: World;
  // Wed 7 Oct 2026 (Melbourne): the sample menu is open for orders.
  const start = new Date('2026-10-07T10:00:00Z');
  beforeEach(async () => {
    world = await create({ now: () => start });
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
    );
    return { status: response?.status ?? -1, body: await response?.json() };
  }
  const settings = async () => (await call('GET', '/api/seller/settings')).body.settings;
  const publicLanguages = async () =>
    parseMenuResponse((await call('GET', `/api/s/${A}/menu`)).body)?.languages;

  it('defaults to both, and the customer menu carries it', async () => {
    expect((await settings()).languages).toBe('both');
    expect(await publicLanguages()).toBe('both');
  });

  it('lets the owner set en or id, and keeps it when an older client omits it', async () => {
    const current = await settings();
    for (const languages of ['en', 'id'] as const) {
      const put = await call('PUT', '/api/seller/settings', { ...current, languages });
      expect(put.body.settings.languages).toBe(languages);
      expect(await publicLanguages()).toBe(languages);
    }
    const old = { ...current };
    delete old.languages;
    const put = await call('PUT', '/api/seller/settings', { ...old, orderingOpen: true });
    expect(put.body.settings.languages).toBe('id');
    expect((await settings()).languages).toBe('id');
  });

  it('defaults the first language to en, lets the owner set id, keeps it when omitted (plan 060)', async () => {
    const current = await settings();
    expect(current.firstLanguage).toBe('en');
    const menuFirst = async () =>
      parseMenuResponse((await call('GET', `/api/s/${A}/menu`)).body)?.firstLanguage;
    expect(await menuFirst()).toBe('en');
    const put = await call('PUT', '/api/seller/settings', { ...current, firstLanguage: 'id' });
    expect(put.body.settings.firstLanguage).toBe('id');
    expect(await menuFirst()).toBe('id');
    const old = { ...current };
    delete old.firstLanguage;
    const kept = await call('PUT', '/api/seller/settings', { ...old, orderingOpen: true });
    expect(kept.body.settings.firstLanguage).toBe('id');
    expect(
      (await call('PUT', '/api/seller/settings', { ...current, firstLanguage: 'fr' })).status,
    ).toBe(400);
  });

  it('refuses an unknown value', async () => {
    const current = await settings();
    expect(
      (await call('PUT', '/api/seller/settings', { ...current, languages: 'fr' })).status,
    ).toBe(400);
  });

  it('puts a customer order in the kitchen language', async () => {
    await call('PUT', '/api/seller/settings', { ...(await settings()), languages: 'id' });
    const menu = (await call('GET', '/api/seller/menus/current')).body.menu;
    const order = await call('POST', '/api/seller/orders', {
      firstName: 'Rina',
      language: 'en',
      fulfilment: 'delivery',
      lines: [{ itemId: menu.dishes[0].id, qty: 1 }],
    });
    expect(order.status).toBe(201);
    expect(order.body.order.language).toBe('id');
  });
});
