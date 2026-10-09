import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicKey, subscribeOrder, unsubscribeOrder } from './push';

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('push client', () => {
  it('reads the public key', async () => {
    stubFetch(200, { publicKey: 'BKey' });
    expect(await fetchPublicKey()).toEqual({ ok: true, data: 'BKey' });
  });

  it('a 404 from the key route is a not_found failure (push is not set up)', async () => {
    stubFetch(404, { error: 'not_found', message: 'Notifications are not set up' });
    const result = await fetchPublicKey();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not_found');
  });

  it('posts the subscription to the order and never to a body-less route', async () => {
    const fetchMock = stubFetch(200, { ok: true });
    const body = { endpoint: 'https://push.example.test/x', keys: { p256dh: 'P', auth: 'A' } };
    expect(await subscribeOrder('tok en', body)).toEqual({ ok: true, data: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/orders/tok%20en/push');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it('deletes by endpoint', async () => {
    const fetchMock = stubFetch(200, { ok: true });
    expect(await unsubscribeOrder('tok', 'https://push.example.test/x')).toEqual({
      ok: true,
      data: true,
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/orders/tok/push');
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body as string)).toEqual({ endpoint: 'https://push.example.test/x' });
  });

  it('passes a refusal on', async () => {
    stubFetch(404, { error: 'not_found', message: 'Order not found' });
    const result = await subscribeOrder('tok', {
      endpoint: 'https://push.example.test/x',
      keys: { p256dh: 'P', auth: 'A' },
    });
    expect(result.ok).toBe(false);
  });
});
