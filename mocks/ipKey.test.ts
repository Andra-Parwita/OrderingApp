// @vitest-environment node
// The visitor-network key of the limiters is HMAC(daily salt, address): stable within a UTC day,
// different on another day, and no raw address is ever stored.
import { beforeEach, describe, expect, it } from 'vitest';
import { ipKey } from '../worker/auth/ipKey';
import { runAttemptSweep } from '../worker/api/scheduled';
import { Db } from '../worker/db/d1';
import { devApi, useWorld, type World } from './impl';

const IP = '203.0.113.77';

describe('the salted network key', () => {
  const create = useWorld('ipKey');
  let world: World;
  let db: Db;
  const day = (n: number) => new Date(Date.UTC(2026, 9, 10 + n, 12));

  beforeEach(async () => {
    world = await create({ now: () => day(0) });
    db = new Db(world.db.d1);
  });

  it('is the same within a day, differs by day and by address, and is not the address', async () => {
    const a = await ipKey(db, day(0), IP);
    expect(await ipKey(db, day(0), IP)).toBe(a);
    expect(await ipKey(db, day(0), '203.0.113.78')).not.toBe(a);
    expect(await ipKey(db, day(1), IP)).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain(IP);
  });

  it('keeps today and yesterday only; the hourly sweep drops older salts', async () => {
    for (const n of [0, 1, 2]) await ipKey(db, day(n), IP);
    await runAttemptSweep({ DB: world.db.d1 }, day(2));
    const days = await db.all<{ day: string }>('SELECT day FROM ip_salts ORDER BY day');
    expect(days.map((r) => r.day)).toEqual(['2026-10-11', '2026-10-12']);
  });

  it('stores no raw address after a find-my-order miss and a client log', async () => {
    const post = (path: string, body: unknown) =>
      devApi(
        world.repo,
        new Request(`https://delave.test${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://delave.test',
            'CF-Connecting-IP': IP,
          },
          body: JSON.stringify(body),
        }),
      );
    await post('/api/s/onde-onde/orders/find', { code: 'AAAAAA', firstName: 'Nobody' });
    await post('/api/log', {
      entries: [
        {
          app: 'seller',
          version: 'dev',
          slug: 'onde-onde',
          path: '/seller/orders',
          kind: 'api_error',
          code: 'server_error',
          message: 'problem',
          agent: 'Chrome Android 126',
          standalone: false,
        },
      ],
    });
    const rows = JSON.stringify([
      ...(await db.all('SELECT * FROM auth_attempts')),
      ...(await db.all('SELECT * FROM auth_rate')),
      ...(await db.all('SELECT * FROM ip_salts')),
    ]);
    expect(rows).toContain('find:ip:');
    expect(rows).toContain('"log:');
    expect(rows).not.toContain(IP);
  });
});
