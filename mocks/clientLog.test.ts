// @vitest-environment node
// Plan 026 stages 1-2: the client error log (a ring of 500) and POST /api/log. Local D1.
import { beforeEach, describe, expect, it } from 'vitest';
import { LOG_KEEP, LOG_RATE_MAX, type LogEntryInput } from '../shared/logContract';
import { devApi, useWorld, type World } from './impl';

const NOW = new Date('2026-10-07T10:00:00Z');
const entry = (n: number): LogEntryInput => ({
  app: 'seller',
  version: 'dev',
  slug: 'onde-onde',
  path: '/seller/orders',
  kind: 'api_error',
  code: 'server_error',
  message: `problem ${String(n)}`,
  agent: 'Chrome Android 126',
  standalone: false,
});

describe('client log', () => {
  const create = useWorld('clientlog');
  let world: World;
  beforeEach(async () => {
    world = await create({ now: () => NOW });
  });

  function post(body: unknown, headers: Record<string, string> = {}) {
    return devApi(
      world.repo,
      new Request('https://delave.test/api/log', {
        method: 'POST',
        headers: { Origin: 'https://delave.test', 'CF-Connecting-IP': '1.2.3.4', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    );
  }

  it('keeps only the newest 500: the 501st drops the oldest', async () => {
    for (let n = 1; n <= LOG_KEEP + 1; n += 1) await world.repo.log.record([entry(n)]);
    const rows = await world.repo.log.recent(1000);
    expect(rows).toHaveLength(LOG_KEEP);
    expect(rows[0]?.message).toBe(`problem ${String(LOG_KEEP + 1)}`);
    expect(rows.at(-1)?.message).toBe('problem 2');
  }, 60_000);

  it('lists a filtered page with the total, and clear deletes everything', async () => {
    for (let n = 1; n <= 3; n += 1) await world.repo.log.record([entry(n)]);
    await world.repo.log.record([{ ...entry(4), app: 'customer', slug: 'dapur-demo' }]);
    const all = await world.repo.log.list({ offset: 0 }, 2);
    expect([all.entries.map((e) => e.message), all.total]).toEqual([['problem 4', 'problem 3'], 4]);
    const older = await world.repo.log.list({ offset: 2 }, 2);
    expect(older.entries.map((e) => e.message)).toEqual(['problem 2', 'problem 1']);
    const kitchen = await world.repo.log.list({ slug: 'dapur-demo', offset: 0 }, 50);
    expect([kitchen.total, kitchen.entries[0]?.message]).toEqual([1, 'problem 4']);
    expect((await world.repo.log.list({ app: 'seller', offset: 0 }, 50)).total).toBe(3);
    await world.repo.log.clear();
    expect(await world.repo.log.recent(10)).toHaveLength(0);
  });

  it('stores a valid call and answers 204, scrubbed', async () => {
    const response = await post({
      entries: [
        { ...entry(1), message: 'mail a@b.com token=secret', path: '/o/AbCdEf1234567890xyzAB' },
      ],
    });
    expect(response?.status).toBe(204);
    const [row] = await world.repo.log.recent(10);
    expect(row?.message).toBe('mail * token=*');
    expect(row?.path).toBe('/o/*');
  });

  it('answers 204 but stores nothing for an oversize body, bad JSON, or more than 5 entries', async () => {
    const big = { entries: [{ ...entry(1), message: 'x'.repeat(3000) }] };
    expect((await post(big))?.status).toBe(204);
    expect((await post('not json'))?.status).toBe(204);
    const many = { entries: Array.from({ length: 6 }, (_, n) => entry(n)) };
    expect((await post(many))?.status).toBe(204);
    expect((await post({ entries: [{ app: 'x' }] }))?.status).toBe(204);
    expect(await world.repo.log.recent(10)).toHaveLength(0);
  });

  it('refuses a foreign origin', async () => {
    const response = await post({ entries: [entry(1)] }, { Origin: 'https://evil.test' });
    expect(response?.status).toBe(403);
    expect(await world.repo.log.recent(10)).toHaveLength(0);
  });

  it('holds the rate limit per client', async () => {
    for (let n = 0; n < LOG_RATE_MAX + 5; n += 1) await post({ entries: [entry(n)] });
    expect(await world.repo.log.recent(100)).toHaveLength(LOG_RATE_MAX);
    await post({ entries: [entry(99)] }, { 'CF-Connecting-IP': '9.9.9.9' });
    expect(await world.repo.log.recent(100)).toHaveLength(LOG_RATE_MAX + 1);
  });
});
