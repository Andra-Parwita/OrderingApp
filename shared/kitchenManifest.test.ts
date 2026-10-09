import { describe, expect, it } from 'vitest';
import { buildManifest, defaultIconSvg, initialsOf, safeStartUrl } from './kitchenManifest';
import { parseCustomerOrder, toCustomerOrder } from './orderContract';
import { parsePushSubscribeRequest } from './pushContract';
import { pushBodyOf, pushEntryOf } from './pushText';
import type { SellerOrder } from './domain';

describe('initials and the default icon', () => {
  it('takes the first letters of the first two words', () => {
    expect(initialsOf('Onde Onde')).toBe('OO');
    expect(initialsOf('  dapur   demo kita ')).toBe('DD');
    expect(initialsOf('Warung')).toBe('W');
    expect(initialsOf('   ')).toBe('?');
  });

  it('puts the initials in `on` over the theme `fill`, and escapes the text', () => {
    const svg = defaultIconSvg('Onde Onde', 'onde');
    expect(svg).toContain('<rect width="512" height="512" fill="#2F6B36"/>');
    expect(svg).toContain('fill="#FFFFFF"');
    expect(svg).toContain('>OO</text>');
    expect(defaultIconSvg('<b> &x', 'bali')).toContain('>&lt;&amp;</text>');
  });
});

describe('the start url guard', () => {
  it('keeps /o/... and /<slug>... and falls back for anything else', () => {
    expect(safeStartUrl('/o/abc', 'k')).toBe('/o/abc');
    expect(safeStartUrl('/k', 'k')).toBe('/k');
    expect(safeStartUrl('/k/menu?x=1', 'k')).toBe('/k/menu?x=1');
    for (const bad of [
      null,
      '',
      'o/abc',
      '//evil',
      'https://evil/o/a',
      '/other',
      '/ko',
      '/o/../x',
      '/o/a\\b',
    ]) {
      expect(safeStartUrl(bad, 'k')).toBe('/k');
    }
  });
});

describe('the manifest', () => {
  it('uses SVG icons without an upload and the upload type with one', () => {
    const plain = buildManifest({ slug: 'k', name: 'Kedai', theme: 'jawa', start: null });
    expect(plain).toMatchObject({
      name: 'Kedai',
      short_name: 'Kedai',
      start_url: '/k',
      scope: '/',
      display: 'standalone',
      background_color: '#F6F0E6',
      theme_color: '#F6F0E6',
    });
    expect(plain.icons.map((icon) => icon.src)).toEqual([
      '/k/k/icon-192.svg',
      '/k/k/icon-512.svg',
      '/k/k/icon-512.svg',
    ]);
    expect(plain.icons[2]?.purpose).toBe('maskable');
    const own = buildManifest({
      slug: 'k',
      name: 'Kedai',
      theme: 'jawa',
      start: '/o/t',
      uploadedType: 'image/webp',
    });
    expect(own.start_url).toBe('/o/t');
    expect(own.icons.map((icon) => icon.type)).toEqual(['image/webp', 'image/webp', 'image/webp']);
  });
});

describe('push contract and texts', () => {
  it('accepts an https endpoint with base64url keys and nothing else', () => {
    const keys = { p256dh: 'BAbc-_123', auth: 'xyz_-9' };
    expect(parsePushSubscribeRequest({ endpoint: 'https://p.example/x', keys })).not.toBeNull();
    expect(parsePushSubscribeRequest({ endpoint: 'http://p.example/x', keys })).toBeNull();
    expect(parsePushSubscribeRequest({ endpoint: 'https://p.example/x', keys: {} })).toBeNull();
    expect(parsePushSubscribeRequest(null)).toBeNull();
  });

  it('says nothing for a nudge or a placed order, and prefers the seller message', () => {
    const at = '2026-10-07T10:00:00.000Z';
    expect(pushBodyOf({ at, kind: 'nudge', textKey: 'nudge' }, 'en')).toBeUndefined();
    expect(pushBodyOf({ at, kind: 'status', status: 'ordered' }, 'en')).toBeUndefined();
    expect(pushBodyOf({ at, kind: 'message', textKey: 'readyAt' }, 'id')).toBe('Siap diambil');
    expect(pushBodyOf({ at, kind: 'message', text: 'Hello' }, 'id')).toBe('Hello');
    const message = { at, kind: 'message', textKey: 'readyIn', minutes: 9 } as const;
    const status = { at, kind: 'status', status: 'confirmed' } as const;
    expect(pushEntryOf([message, status])).toBe(message);
    expect(pushEntryOf([status, { at, kind: 'nudge' }])).toBe(status);
    expect(pushEntryOf([{ at, kind: 'nudge' }])).toBeUndefined();
  });
});

describe('paid in the customer order', () => {
  const order: SellerOrder = {
    id: 'o1',
    sellerId: 's1',
    code: 'ABCD23',
    token: 'tok-1-padding-padding',
    firstName: 'Rina',
    language: 'en',
    lines: [],
    fulfilment: 'pickup',
    status: 'ordered',
    paid: true,
    locked: false,
    waReceived: false,
    returning: false,
    changed: false,
    inbox: [],
    audit: [],
    createdAt: '2026-10-07T10:00:00.000Z',
    updatedAt: '2026-10-07T10:00:00.000Z',
  };

  it('is copied by toCustomerOrder and round-trips the parser', () => {
    const customer = toCustomerOrder(order, { slug: 'onde-onde', name: 'Onde Onde' });
    expect(customer.paid).toBe(true);
    expect(parseCustomerOrder(JSON.parse(JSON.stringify(customer)))?.paid).toBe(true);
  });

  it('is optional on parse (an older server) and refuses a non-boolean', () => {
    const customer = toCustomerOrder(order, { slug: 'onde-onde', name: 'Onde Onde' });
    const { paid, ...old } = JSON.parse(JSON.stringify(customer)) as Record<string, unknown>;
    expect(paid).toBe(true);
    expect(parseCustomerOrder(old)?.paid).toBe(false);
    expect(parseCustomerOrder({ ...old, paid: 'yes' })).toBeNull();
  });
});
