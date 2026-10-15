/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call -- loose JSON reply bodies in a test */
// @vitest-environment node
// Plan 076: a saved pickup place may carry an address and a map pin. Stored with the place, shown on
// the public menu, kept by backup and restore, and old backups without it still restore.
// Runs against a local D1; see mocks/impl.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import { parseBackupFile } from '../shared/backup';
import { devApi, useWorld, type World } from './impl';

const A = 'onde-onde';
const START = new Date('2026-10-07T10:00:00Z');

describe('pickup place address', () => {
  const create = useWorld('pickupAddress');
  let world: World;

  type Reply = { status: number; body: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

  async function call(method: string, path: string, body?: unknown): Promise<Reply> {
    const headers: Record<string, string> = { 'X-Seller': A };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await devApi(
      world.repo,
      new Request(`https://delave.test${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    );
    if (!response) return { status: -1, body: null };
    return { status: response.status, body: await response.json() };
  }

  const place = (extra: Record<string, unknown> = {}) => ({
    place: 'Jetty',
    directions: { en: 'Blue gate', id: 'Gerbang biru' },
    window: { start: '10:00', end: '11:00' },
    ...extra,
  });
  const publicPoints = async (): Promise<
    Array<{ id: string; address?: string; lat?: number; lng?: number }>
  > => (await call('GET', `/api/s/${A}/menu`)).body.week.pickupPoints;

  beforeEach(async () => {
    world = await create({ now: () => START });
  });

  it('round trips: a place without an address stays plain; with one it carries address and pin', async () => {
    const plain = await call('POST', '/api/seller/pickup-places', place());
    expect(plain.status).toBe(201);
    expect(plain.body.place.address).toBeUndefined();
    expect(plain.body.place.lat).toBeUndefined();

    const pinned = await call(
      'POST',
      '/api/seller/pickup-places',
      place({ address: ' 12 Jetty Road, Glenelg 5045 ', lat: -34.98, lng: 138.51 }),
    );
    expect(pinned.status).toBe(201);
    expect(pinned.body.place).toMatchObject({
      address: '12 Jetty Road, Glenelg 5045',
      lat: -34.98,
      lng: 138.51,
    });
    const list = (await call('GET', '/api/seller/pickup-places')).body.places;
    expect(list.find((p: { id: string }) => p.id === pinned.body.place.id)).toMatchObject({
      address: '12 Jetty Road, Glenelg 5045',
      lat: -34.98,
    });
  });

  it('updates the address and pin together; null removes both; bad values are refused', async () => {
    const id = (await call('POST', '/api/seller/pickup-places', place())).body.place.id;
    const patch = (data: unknown) => call('PATCH', `/api/seller/pickup-places/${id}`, data);

    const set = await patch({ address: '5 Hay St, Perth 6000', lat: -31.9, lng: 115.8 });
    expect(set.body.place).toMatchObject({
      address: '5 Hay St, Perth 6000',
      lat: -31.9,
      lng: 115.8,
    });
    // Changing only the text drops the old pin: it belonged to the old address.
    const moved = await patch({ address: '7 Hay St, Perth 6000' });
    expect(moved.body.place.address).toBe('7 Hay St, Perth 6000');
    expect(moved.body.place.lat).toBeUndefined();
    // A change to another field keeps the address.
    const renamed = await patch({ place: 'Hay' });
    expect(renamed.body.place.address).toBe('7 Hay St, Perth 6000');
    const removed = await patch({ address: null });
    expect(removed.body.place.address).toBeUndefined();

    expect((await patch({ address: 'x', lat: 91, lng: 0 })).status).toBe(400);
    expect((await patch({ address: 'x', lat: 0, lng: -181 })).status).toBe(400);
    expect((await patch({ address: 'x', lat: 1 })).status).toBe(400);
    expect((await patch({ address: 'x'.repeat(201) })).status).toBe(400);
    expect((await patch({ lat: 1, lng: 2 })).status).toBe(400);
  });

  it('shows on the public menu at once, for every menu using the place', async () => {
    const before = await publicPoints();
    expect(before[0]!.address).toBeUndefined();
    const id = before[0]!.id;
    await call('PATCH', `/api/seller/pickup-places/${id}`, {
      address: '12 Jetty Road, Glenelg 5045',
      lat: -34.98,
      lng: 138.51,
    });
    expect((await publicPoints())[0]!).toMatchObject({
      id,
      address: '12 Jetty Road, Glenelg 5045',
      lat: -34.98,
      lng: 138.51,
    });
    await call('PATCH', `/api/seller/pickup-places/${id}`, { address: null });
    expect((await publicPoints())[0]!.address).toBeUndefined();
  });

  it('backup keeps the address and pin; a file without them still restores', async () => {
    const id = (await publicPoints())[0]!.id;
    await call('PATCH', `/api/seller/pickup-places/${id}`, {
      address: '12 Jetty Road, Glenelg 5045',
      lat: -34.98,
      lng: 138.51,
    });
    const out = (await call('GET', '/api/seller/backup')).body;
    const file = parseBackupFile(out);
    expect(file?.pickupPlaces?.find((p) => p.id === id)).toMatchObject({
      address: '12 Jetty Road, Glenelg 5045',
      lat: -34.98,
      lng: 138.51,
    });

    await call('PATCH', `/api/seller/pickup-places/${id}`, { address: null });
    expect((await call('POST', '/api/seller/backup', out)).status).toBe(200);
    expect((await publicPoints()).find((p) => p.id === id)).toMatchObject({
      address: '12 Jetty Road, Glenelg 5045',
      lat: -34.98,
    });

    // An older file: places with no address fields at all.
    for (const p of out.pickupPlaces) {
      delete p.address;
      delete p.lat;
      delete p.lng;
    }
    expect((await call('POST', '/api/seller/backup', out)).status).toBe(200);
    expect((await publicPoints()).find((p) => p.id === id)?.address).toBeUndefined();
  });
});
