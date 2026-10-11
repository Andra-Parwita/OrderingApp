import { describe, expect, it } from 'vitest';
import {
  cleanEntry,
  LOG_MESSAGE_MAX,
  parseLogRequest,
  scrubMessage,
  scrubPath,
} from './logContract';

const ENTRY = {
  app: 'customer',
  version: '1.2.3 · abc',
  slug: 'onde-onde',
  path: '/o/AbCdEf1234567890xyzAB/qr?x=1',
  kind: 'js_error',
  code: 'TypeError',
  message: 'boom',
  agent: 'Safari iOS 17',
  standalone: true,
};

describe('scrubMessage', () => {
  it('removes emails, phone-like digit runs, tokens and anything after token=', () => {
    expect(scrubMessage('mail a.b@c.com now')).toBe('mail * now');
    expect(scrubMessage('call +62 812-3456-7890 ok')).toBe('call * ok');
    expect(scrubMessage('GET /x?token=abc123 failed')).toBe('GET /x?token=*');
    expect(scrubMessage('bad AbCdEf1234567890xyzAB here')).toBe('bad * here');
  });
  it('keeps short numbers and caps the length', () => {
    expect(scrubMessage('HTTP 500 at line 42')).toBe('HTTP 500 at line 42');
    expect(scrubMessage('x'.repeat(1000))).toHaveLength(LOG_MESSAGE_MAX);
  });
});

describe('scrubPath', () => {
  it('turns the order token into * and drops the query', () => {
    expect(scrubPath('/o/AbCdEf1234567890xyzAB')).toBe('/o/*');
    expect(scrubPath('/o/AbCdEf1234567890xyzAB/qr?x=1#y')).toBe('/o/*/qr');
    expect(scrubPath('/onde-onde/basket')).toBe('/onde-onde/basket');
  });
  it('masks order codes', () => {
    expect(scrubPath('/seller/orders/Y3E-BDZ')).toBe('/seller/orders/*');
    expect(scrubPath('/seller/orders/Y3E-BDZ/edit')).toBe('/seller/orders/*/edit');
    expect(scrubPath('/onde-onde/orders/anything')).toBe('/onde-onde/orders/*');
    expect(scrubPath('/onde-onde/Y3E-BDZ')).toBe('/onde-onde/*');
    expect(scrubPath('/seller/orders')).toBe('/seller/orders');
    expect(scrubPath('/dapur-demo/basket')).toBe('/dapur-demo/basket');
  });
});

describe('cleanEntry / parseLogRequest', () => {
  it('cleans an entry and keeps nothing extra', () => {
    const clean = cleanEntry({ ...ENTRY, name: 'Ana', token: 't' });
    expect(clean).toEqual({ ...ENTRY, path: '/o/*/qr' });
  });
  it('rejects an unknown app or kind, and a missing field', () => {
    expect(cleanEntry({ ...ENTRY, app: 'x' })).toBeNull();
    expect(cleanEntry({ ...ENTRY, kind: 'x' })).toBeNull();
    expect(cleanEntry({ ...ENTRY, message: undefined })).toBeNull();
  });
  it('accepts 1 to 5 entries and refuses 0, 6 or a non-array', () => {
    expect(parseLogRequest({ entries: [ENTRY] })?.entries).toHaveLength(1);
    expect(parseLogRequest({ entries: [] })).toBeNull();
    expect(parseLogRequest({ entries: Array.from({ length: 6 }, () => ENTRY) })).toBeNull();
    expect(parseLogRequest({ entries: 'no' })).toBeNull();
    expect(parseLogRequest(null)).toBeNull();
  });
});
