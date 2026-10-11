// @vitest-environment node
// Plan 028, stage 1: migration 0010 rebuilds memberships, auth_keys and auth_key_redemptions with the
// `helper` role. Rows that exist before it come out unchanged, and a helper row is now allowed.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Db } from '../worker/db/d1';
import { openDatabase, type Database } from './impl';

const NOW = '2026-10-07T10:00:00.000Z';
const LATER = '2026-10-08T10:00:00.000Z';

describe('migration 0010 (helper role)', () => {
  let database: Database;
  let db: Db;
  const run = (sql: string, ...values: Array<string | number | null>) =>
    db.stmt(sql, ...values).run();

  beforeAll(async () => {
    database = await openDatabase('helperMigration-d1', '0009_client_log.sql');
    db = new Db(database.d1);
    await run(
      'INSERT INTO sellers (id, slug, name, created_at) VALUES (?, ?, ?, ?)',
      's1',
      'one',
      'One',
      NOW,
    );
    for (const [id, name] of [
      ['person:o', 'Olive'],
      ['person:c', 'Chen'],
    ] as const) {
      await run(
        "INSERT INTO accounts (id, role, display_name, created_at) VALUES (?, 'person', ?, ?)",
        id,
        name,
        NOW,
      );
    }
    const member = (account: string, role: string, chef: string | null) =>
      run(
        'INSERT INTO memberships (account_id, seller_id, role, chef_id, created_at) VALUES (?, ?, ?, ?, ?)',
        account,
        's1',
        role,
        chef,
        NOW,
      );
    await member('person:o', 'owner', null);
    await member('person:c', 'chef', 'c1');
    const invite = (hash: string, role: string, chef: string | null) =>
      run(
        `INSERT INTO auth_keys (key_hash, seller_id, role, chef_id, display_name, created_at, expires_at)
         VALUES (?, 's1', ?, ?, 'Name', ?, ?)`,
        hash,
        role,
        chef,
        NOW,
        LATER,
      );
    await invite('k-owner', 'owner', null);
    await invite('k-chef', 'chef', 'c1');
    await run(
      "INSERT INTO auth_key_redemptions (key_hash, client_device_id, redeemed_at) VALUES ('k-chef', 'dev', ?)",
      NOW,
    );
    // Before 0010 a helper row is refused by the CHECK.
    await expect(member('person:o', 'helper', null)).rejects.toThrow();
    await database.migrateAll();
  }, 60_000);

  afterAll(async () => {
    await database.close();
  }, 30_000);

  it('keeps the owner and chef memberships, keys and the redemption as they were', async () => {
    expect(
      await db.all(
        'SELECT account_id, seller_id, role, chef_id, created_at FROM memberships ORDER BY 1',
      ),
    ).toEqual([
      { account_id: 'person:c', seller_id: 's1', role: 'chef', chef_id: 'c1', created_at: NOW },
      { account_id: 'person:o', seller_id: 's1', role: 'owner', chef_id: null, created_at: NOW },
    ]);
    expect(
      await db.all('SELECT key_hash, role, chef_id, expires_at FROM auth_keys ORDER BY 1'),
    ).toEqual([
      { key_hash: 'k-chef', role: 'chef', chef_id: 'c1', expires_at: LATER },
      { key_hash: 'k-owner', role: 'owner', chef_id: null, expires_at: LATER },
    ]);
    expect(await db.all('SELECT key_hash, client_device_id FROM auth_key_redemptions')).toEqual([
      { key_hash: 'k-chef', client_device_id: 'dev' },
    ]);
  });

  it('now accepts a helper without a cook, and still refuses a chef without one', async () => {
    await run("DELETE FROM memberships WHERE account_id = 'person:c'");
    await run(
      "INSERT INTO memberships (account_id, seller_id, role, chef_id, created_at) VALUES ('person:c', 's1', 'helper', NULL, ?)",
      NOW,
    );
    await expect(
      run(
        "INSERT INTO auth_keys (key_hash, seller_id, role, chef_id, display_name, created_at, expires_at) VALUES ('k-bad', 's1', 'chef', NULL, 'X', ?, ?)",
        NOW,
        LATER,
      ),
    ).rejects.toThrow();
  });

  it('keeps the foreign key from redemptions to keys (deleting a key removes its redemption)', async () => {
    await run("DELETE FROM auth_keys WHERE key_hash = 'k-chef'");
    expect(await db.all('SELECT key_hash FROM auth_key_redemptions')).toEqual([]);
  });
});
