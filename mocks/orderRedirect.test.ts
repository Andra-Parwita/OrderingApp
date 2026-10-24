// @vitest-environment node
// Plan 102 stage 4 (risk 1): old order links keep working forever. The Worker answers 302 to the
// order's own kitchen, keeping the sub-page and the query; unknown tokens and lookup errors are not
// redirected (the app shows its own "not found"). Runs against a local D1; see mocks/impl.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import { orderRedirect } from '../worker/redirects';
import { useWorld, type World } from './impl';

const NOW = new Date('2026-10-07T10:00:00Z');
const origin = 'https://order.test';

describe('Worker redirect of order links (plan 102)', () => {
  const create = useWorld('orderRedirect');
  let world: World;
  let token: string;

  beforeEach(async () => {
    world = await create({ now: () => NOW, newToken: () => 'token-redirect-padding-1' });
    const onde = await world.repo.sellerBySlug('onde-onde');
    if (!onde) throw new Error('no seller');
    const created = await onde.createOrder({
      firstName: 'Redirect',
      language: 'en',
      fulfilment: 'pickup',
      lines: [{ itemId: 'pesmol', qty: 1 }],
    });
    if (!created.ok) throw new Error('order failed');
    token = created.value.token;
  });

  const go = (path: string) => orderRedirect(world.repo, `${origin}${path}`);

  it('moves the old /o/<token> under the order kitchen (302)', async () => {
    const res = await go(`/o/${token}`);
    expect(res?.status).toBe(302);
    expect(res?.headers.get('Location')).toBe(`/onde-onde/o/${token}`);
  });

  it('keeps every sub-page', async () => {
    for (const sub of ['/placed', '/qr', '/edit', '/edit/name']) {
      const res = await go(`/o/${token}${sub}`);
      expect(res?.status, sub).toBe(302);
      expect(res?.headers.get('Location'), sub).toBe(`/onde-onde/o/${token}${sub}`);
    }
  });

  it('keeps the query (a home-screen start keeps its source)', async () => {
    const res = await go(`/o/${token}?source=homescreen`);
    expect(res?.headers.get('Location')).toBe(`/onde-onde/o/${token}?source=homescreen`);
    const sub = await go(`/o/${token}/qr?a=1&b=two`);
    expect(sub?.headers.get('Location')).toBe(`/onde-onde/o/${token}/qr?a=1&b=two`);
  });

  it('corrects a wrong kitchen in the address, from the token', async () => {
    const res = await go(`/dapur-demo/o/${token}/qr?x=1`);
    expect(res?.status).toBe(302);
    expect(res?.headers.get('Location')).toBe(`/onde-onde/o/${token}/qr?x=1`);
  });

  it('leaves the right address alone', async () => {
    expect(await go(`/onde-onde/o/${token}`)).toBeNull();
    expect(await go(`/onde-onde/o/${token}/edit/name?x=1`)).toBeNull();
  });

  it('an unknown token is not redirected (the app shows its own not found)', async () => {
    expect(await go('/o/no-such-token-at-all')).toBeNull();
    expect(await go('/onde-onde/o/no-such-token-at-all')).toBeNull();
  });

  it('only order addresses are touched', async () => {
    for (const path of [
      '/',
      '/onde-onde',
      '/my-orders',
      '/settings',
      '/onde-onde/my-orders',
      '/seller',
    ]) {
      expect(await go(path), path).toBeNull();
    }
  });

  it('a lookup error serves the page as before (fail-open)', async () => {
    const broken = { lookupByToken: () => Promise.reject(new Error('db down')) };
    expect(await orderRedirect(broken, `${origin}/o/${token}`)).toBeNull();
    expect(await orderRedirect(broken, `${origin}/dapur-demo/o/${token}`)).toBeNull();
  });
});
