/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any -- loose JSON reply bodies in a test */
// @vitest-environment node
// Plan 111 (D-112): a backup of dishes and menu items with choices parses and restores with its group links.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseBackupFile } from '../shared/backup';
import { devApi, useWorld, type World } from './impl';

type Row = { name: { en: string }; groupId?: string };
type ExportedFile = { items: Array<Record<string, unknown>> } & Record<string, unknown>;

const START = Date.parse('2026-10-07T10:00:00Z');

describe('backup and restore with choices (plan 111)', () => {
  const create = useWorld('backup-choices');
  let world: World;
  let tokens = 0;

  async function call(
    method: string,
    path: string,
    body?: unknown,
    w: World = world,
  ): Promise<any> {
    const headers: Record<string, string> = { 'X-Seller': 'onde-onde' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      w.repo,
      new Request(`https://backup.test${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    );
    return JSON.parse(response ? await response.text() : 'null');
  }
  const options = () => ({
    now: () => new Date(START),
    newToken: () => `token-${String(++tokens)}-padding-padding`,
  });
  const choice = (en: string, limit: number | null) => ({ name: { en, id: '' }, limit });
  const snapshot = async (w: World): Promise<{ dishes: Array<Row>; items: Array<Row> }> => {
    const dishes = (await call('GET', '/api/seller/dishes', undefined, w)).dishes as Array<Row>;
    const items = (await call('GET', '/api/seller/menu', undefined, w)).items as Array<Row>;
    const strip = (x: unknown) =>
      JSON.parse(
        JSON.stringify(x, (k: string, v: unknown) => (k === 'lastUsedAt' ? undefined : v)),
      ) as Array<Row>;
    return { dishes: strip(dishes), items: strip(items) };
  };

  beforeEach(async () => {
    tokens = 0;
    world = await create(options());
  });

  async function seed() {
    for (const [name, kinds] of [
      ['Dry snacks', [choice('Cheese', 2), choice('Sweet', null)]],
      ['Cakes', [choice('Pandan', null), choice('Choc', 3), choice('Plain', null)]],
    ] as const) {
      const made = await call('POST', '/api/seller/dishes', {
        name: { en: name, id: name },
        priceCents: 600,
        size: { en: 'pack', id: 'bungkus' },
        choices: kinds,
      });
      await call('POST', '/api/seller/menus/current/items', { dishId: made.dish.id });
    }
  }

  it('a real backup parses, and restoring it brings back dishes, choices and group links', async () => {
    await seed();
    const before = await snapshot(world);
    expect(before.items.filter((i) => i.groupId !== undefined)).toHaveLength(5);

    const file = JSON.parse(
      JSON.stringify(await (await world.repo.sellerBySlug('onde-onde'))!.exportBackup()),
    ) as ExportedFile;
    const parsed = parseBackupFile(file);
    expect(parsed).not.toBeNull();
    expect(parsed!.dishes!.find((d) => d.name.en === 'Cakes')!.choices).toHaveLength(3);

    // Into a fresh kitchen.
    const fresh = await create(options());
    await (await fresh.repo.sellerBySlug('onde-onde'))!.restoreBackup(parsed!);
    expect(await snapshot(fresh)).toEqual(before);
    expect(
      await fresh.db.first('SELECT COUNT(*) AS n FROM dishes WHERE group_id IS NOT NULL'),
    ).toEqual({ n: 5 });
    // The choice's own limit is its own, not the dish's.
    const limits = await fresh.db.all<{ portion_limit: number | null }>(
      "SELECT portion_limit FROM dishes WHERE group_id IS NOT NULL AND name_en IN ('Cheese','Sweet') ORDER BY name_en",
    );
    expect(limits.map((l) => l.portion_limit)).toEqual([2, null]);
  });

  it('an old-format file (no choices, no groupId) still parses and restores', async () => {
    await seed();
    const file = JSON.parse(
      JSON.stringify(await (await world.repo.sellerBySlug('onde-onde'))!.exportBackup()),
    ) as ExportedFile;
    for (const key of ['dishes', 'itemDishIds', 'dishSets', 'menu', 'pickupPlaces', 'preferences'])
      delete file[key];
    file.items = file.items
      .filter((i) => i.groupId === undefined)
      .map((i) => Object.fromEntries(Object.entries(i).filter(([k]) => k !== 'groupId')));
    const parsed = parseBackupFile(file);
    expect(parsed).not.toBeNull();
    await (await world.repo.sellerBySlug('onde-onde'))!.restoreBackup(parsed!);
    const after = await snapshot(world);
    const names = after.items.map((i) => i.name.en);
    expect(names).toEqual(expect.arrayContaining(['Dry snacks', 'Cakes']));
    expect(after.items.some((i) => i.groupId !== undefined)).toBe(false);
  });

  it('refuses a menu item whose group is not in the file', async () => {
    await seed();
    const file = JSON.parse(
      JSON.stringify(await (await world.repo.sellerBySlug('onde-onde'))!.exportBackup()),
    ) as ExportedFile;
    const linked = file.items.find((i) => i.groupId !== undefined);
    if (linked) linked.groupId = 'nope';
    expect(parseBackupFile(file)).toBeNull();
  });
});
