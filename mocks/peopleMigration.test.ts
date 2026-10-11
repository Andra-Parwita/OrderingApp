// @vitest-environment node
// Plan 033, stage 1: migration 0007 on a copy of a database that already has logins. It clears every
// seller and chef login (D-088) and keeps the admin, its device and session, and the kitchens.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Db } from '../worker/db/d1';
import { sha256Hex } from '../worker/db/crypto';
import { createD1Repository } from '../worker/db';
import { DEV_ADMIN_SETUP_KEY, openDatabase, type Database } from './impl';

const NOW = '2026-10-07T10:00:00.000Z';
const LATER = '2026-12-07T10:00:00.000Z';

describe('migration 0007 (people and memberships)', () => {
  let database: Database;
  let db: Db;

  beforeAll(async () => {
    database = await openDatabase('peopleMigration-d1', '0006_demo.sql');
    db = new Db(database.d1);
    const run = (sql: string, ...values: Array<string | number | null>) =>
      db.stmt(sql, ...values).run();
    await run(
      'INSERT INTO sellers (id, slug, name, created_at) VALUES (?, ?, ?, ?)',
      's1',
      'one',
      'One',
      NOW,
    );
    await run(
      'INSERT INTO sellers (id, slug, name, created_at) VALUES (?, ?, ?, ?)',
      's2',
      'two',
      'Two',
      NOW,
    );
    await run(
      'INSERT INTO chefs (seller_id, id, name, position) VALUES (?, ?, ?, ?)',
      's1',
      'c1',
      'Chef One',
      0,
    );
    const account = (id: string, role: string, seller: string | null, chef: string | null) =>
      run(
        'INSERT INTO accounts (id, role, seller_id, chef_id, created_at) VALUES (?, ?, ?, ?, ?)',
        id,
        role,
        seller,
        chef,
        NOW,
      );
    await account('admin', 'admin', null, null);
    await account('seller:s1', 'seller', 's1', null);
    await account('chef:s1:c1', 'chef', 's1', 'c1');
    const device = (
      id: string,
      accountId: string,
      seller: string | null,
      credential: string | null,
    ) =>
      run(
        `INSERT INTO devices (id, account_id, seller_id, name, credential_id, credential_public_key,
           credential_counter, credential_transports, created_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        accountId,
        seller,
        id,
        credential,
        credential ? 'pk' : null,
        credential ? 7 : null,
        credential ? '[]' : null,
        NOW,
        NOW,
      );
    await device('dev-admin', 'admin', null, 'cred-admin');
    await device('dev-seller', 'seller:s1', 's1', null);
    await device('dev-chef', 'chef:s1:c1', 's1', null);
    const session = async (
      token: string,
      accountId: string,
      deviceId: string,
      seller: string | null,
    ) =>
      run(
        `INSERT INTO sessions (token_hash, account_id, device_id, seller_id, via, created_at, expires_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`,
        await sha256Hex(token),
        accountId,
        deviceId,
        seller,
        NOW,
        LATER,
      );
    await session('admin-token', 'admin', 'dev-admin', null);
    await session('seller-token', 'seller:s1', 'dev-seller', 's1');
    await session('chef-token', 'chef:s1:c1', 'dev-chef', 's1');
    await run(
      `INSERT INTO auth_keys (key_hash, account_id, seller_id, kind, created_at, expires_at)
       VALUES ('k1', 'seller:s1', 's1', 'invite', ?, ?)`,
      NOW,
      LATER,
    );
    await run(
      `INSERT INTO auth_key_redemptions (key_hash, client_device_id, redeemed_at) VALUES ('k1', 'x', ?)`,
      NOW,
    );
    await run(
      `INSERT INTO auth_codes (code_hash, account_id, seller_id, created_at, expires_at, used)
       VALUES ('h', 'seller:s1', 's1', ?, ?, 0)`,
      NOW,
      LATER,
    );
    await database.migrateAll();
  }, 60_000);

  afterAll(async () => {
    await database.close();
  }, 30_000);

  const count = async (table: string) =>
    (await db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n;

  it('clears every seller and chef login, key, code and redemption', async () => {
    const accounts = await db.all<{ id: string; role: string }>('SELECT id, role FROM accounts');
    expect(accounts).toEqual([{ id: 'admin', role: 'admin' }]);
    expect(await count('memberships')).toBe(0);
    expect(await count('auth_keys')).toBe(0);
    expect(await count('auth_key_redemptions')).toBe(0);
    expect(await count('auth_codes')).toBe(0);
    expect(await count('devices')).toBe(1);
    expect(await count('sessions')).toBe(1);
  });

  it('keeps the admin device with its passkey, and the admin session signs in', async () => {
    const device = await db.first<{
      id: string;
      credential_id: string;
      credential_counter: number;
    }>('SELECT id, credential_id, credential_counter FROM devices');
    expect(device).toEqual({ id: 'dev-admin', credential_id: 'cred-admin', credential_counter: 7 });
    const repo = createD1Repository(database.d1, {
      now: () => new Date('2026-10-08T10:00:00Z'),
      adminSetupKey: DEV_ADMIN_SETUP_KEY,
    });
    expect((await repo.auth.resolve('admin-token'))?.role).toBe('admin');
    expect(await repo.auth.resolve('seller-token')).toBeUndefined();
    expect(await repo.auth.resolve('chef-token')).toBeUndefined();
  });

  it('leaves kitchens and cooks as they were', async () => {
    expect(await count('sellers')).toBe(2);
    expect(await count('chefs')).toBe(1);
  });
});
