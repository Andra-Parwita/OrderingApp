/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any -- loose JSON reply bodies in a test */
// @vitest-environment node
// Plan 111 (D-112), seller side: a private order takes a choice as "<dish> · <choice>" and never the
// dish itself, and a menu with choices (more than 50 rows) backs up and restores.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseBackupFile } from '../shared/backup';
import { MAX_MENU_ROWS } from '../shared/limits';
import { parseCreatePrivateRequest } from '../shared/privateContract';
import { devApi, useWorld, type World } from './impl';

const START = Date.parse('2026-10-07T10:00:00Z');

describe('private orders and backup with dish choices (plan 111)', () => {
  const create = useWorld('private-choices');
  let world: World;

  async function call(method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = { 'X-Seller': 'onde-onde' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://private-choices.test${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    );
    const text = response ? await response.text() : '';
    let parsed: any = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: response?.status ?? -1, body: parsed, text };
  }

  beforeEach(async () => {
    world = await create({ now: () => new Date(START) });
  });

  const makeDish = async (name: string, count: number) => {
    const reply = await call('POST', '/api/seller/dishes', {
      name: { en: name, id: name },
      priceCents: 600,
      size: { en: 'pack', id: 'bungkus' },
      choices: Array.from({ length: count }, (_, i) => ({
        name: { en: `Kind ${String(i)}`, id: '' },
        limit: null,
      })),
    });
    expect(reply.status).toBe(201);
    return reply.body.dish as { id: string; choices: Array<{ id: string }> };
  };

  it('names a private line after its dish and choice, and refuses the dish itself', async () => {
    const dish = await makeDish('Dry snacks', 3);
    const request = (dishId: string) => ({
      firstName: 'Della',
      language: 'en',
      eventDate: '2026-10-10',
      lines: [{ dishId, qty: 2 }],
    });
    const refused = await call('POST', '/api/seller/private', request(dish.id));
    expect([refused.status, refused.body.error]).toEqual([400, 'pick_choice']);

    const choice = dish.choices[1];
    const placed = await call('POST', '/api/seller/private', request(choice?.id ?? ''));
    expect(placed.status, placed.text).toBe(201);
    expect(placed.body.order.lines[0]).toMatchObject({
      itemId: choice?.id,
      name: { en: 'Dry snacks · Kind 1', id: 'Dry snacks · Kind 1' },
      priceCents: 600,
      qty: 2,
    });
  });

  it('takes more than 50 private lines in the contract', () => {
    const lines = Array.from({ length: 60 }, (_, i) => ({ dishId: `d${String(i)}`, qty: 1 }));
    const parsed = parseCreatePrivateRequest({
      firstName: 'Della',
      language: 'en',
      eventDate: '2026-10-10',
      lines,
    });
    expect(parsed?.lines).toHaveLength(60);
  });

  it('accepts a backup file with more than 50 menu rows (dishes and their choices)', async () => {
    const dish = await makeDish('Snacks', 0);
    await call('POST', '/api/seller/menus/current/items', { dishId: dish.id });
    const file = (await call('GET', '/api/seller/backup')).body as {
      items: Array<Record<string, unknown>>;
    };
    const sample = file.items[0];
    const rows = (count: number) =>
      Array.from({ length: count }, (_, i) => ({ ...sample, id: `extra-${String(i)}` }));
    const many = { ...file, items: [...file.items, ...rows(60)] };
    expect(parseBackupFile(many)?.items.length).toBeGreaterThan(50);
    const tooMany = { ...file, items: rows(MAX_MENU_ROWS + 1) };
    expect(parseBackupFile(tooMany)).toBeNull();
  });
});
