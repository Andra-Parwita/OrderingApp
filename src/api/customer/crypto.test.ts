import { describe, expect, it } from 'vitest';
import type { SavedOrder } from '../device/myOrders';
import { fromB64Url, keyFromPrf, openAddress, prfSalt, sealAddress, toB64Url } from './crypto';
import { mergeSavedOrders } from './merge';

const address = {
  street: '12 King William St',
  suburb: 'Adelaide',
  postcode: '5000',
};

describe('sealed address', () => {
  it('round-trips with the same key and passkey, and never otherwise', async () => {
    const key = await keyFromPrf(crypto.getRandomValues(new Uint8Array(32)));
    const sealed = await sealAddress(key, address, 'cred-1');
    expect(sealed.v).toBe(1);
    expect(sealed.ct).not.toContain('King');
    expect(await openAddress(key, sealed, 'cred-1')).toMatchObject({ suburb: 'Adelaide' });
    // tied to the passkey (AAD) and to the key
    expect(await openAddress(key, sealed, 'cred-2')).toBeNull();
    const other = await keyFromPrf(crypto.getRandomValues(new Uint8Array(32)));
    expect(await openAddress(other, sealed, 'cred-1')).toBeNull();
    expect(await openAddress(key, { ...sealed, v: 2 }, 'cred-1')).toBeNull();
  });

  it('derives the same key from the same PRF output', async () => {
    const prf = crypto.getRandomValues(new Uint8Array(32));
    const sealed = await sealAddress(await keyFromPrf(prf), address, 'c');
    expect(await openAddress(await keyFromPrf(prf), sealed, 'c')).not.toBeNull();
  });

  it('uses a fixed 32-byte salt and url-safe base64', async () => {
    expect((await prfSalt()).length).toBe(32);
    const bytes = new Uint8Array([251, 255, 0, 1, 2]);
    expect(toB64Url(bytes)).toBe('-_8AAQI');
    expect([...fromB64Url('-_8AAQI')]).toEqual([...bytes]);
  });
});

describe('mergeSavedOrders', () => {
  const mine: SavedOrder = {
    code: 'A-1',
    token: 'a'.repeat(20),
    placedAt: '2026-10-10T00:00:00Z',
    lastStatus: 'collected',
  };
  it('unions by token and keeps the phone own fields', () => {
    const merged = mergeSavedOrders(
      [mine],
      [
        { token: mine.token, slug: 'onde' },
        { token: 'b'.repeat(20), slug: 'della' },
      ],
      new Date('2026-10-17T00:00:00Z'),
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ code: 'A-1', lastStatus: 'collected', sellerSlug: 'onde' });
    expect(merged[1]).toMatchObject({ token: 'b'.repeat(20), sellerSlug: 'della', code: '' });
  });
  it('keeps local-only orders and adds nothing twice', () => {
    expect(mergeSavedOrders([mine], [])).toEqual([mine]);
    expect(
      mergeSavedOrders(
        [mine],
        [
          { token: mine.token, slug: 'x' },
          { token: mine.token, slug: 'x' },
        ],
      ),
    ).toHaveLength(1);
  });
});
