import { describe, expect, it } from 'vitest';
import { normaliseAuMobile } from './phone';
import { parseCreateOrderRequest, parseCreateSellerOrderRequest } from './orderContract';
import { parseSettingsRequest } from './sellerContract';

const text = { en: 'Hi', id: 'Halo' };
const settings = { postGreeting: text, postClosing: text, orderingOpen: true };

describe('normaliseAuMobile', () => {
  it.each(['0412 345 678', '+61412345678', '61412345678', '+61 412-345-678', '(04) 1234 5678'])(
    'accepts %s',
    (input) => {
      expect(normaliseAuMobile(input)).toBe('61412345678');
    },
  );

  it.each(['', 'abc', '0312 345 678', '0412 345', '+6141234567890', '412345678', '04123x5678'])(
    'rejects %j',
    (input) => {
      expect(normaliseAuMobile(input)).toBeNull();
    },
  );
});

describe('parseSettingsRequest', () => {
  it('normalises the number and keeps the rest', () => {
    expect(parseSettingsRequest({ ...settings, whatsappNumber: '0412 345 678' })).toEqual({
      ...settings,
      whatsappNumber: '61412345678',
    });
  });

  it('removes the number when empty or absent', () => {
    expect(parseSettingsRequest({ ...settings, whatsappNumber: ' ' })).toEqual(settings);
    expect(parseSettingsRequest(settings)).toEqual(settings);
  });

  it.each([
    ['junk number', { ...settings, whatsappNumber: 'call me' }],
    ['non-string number', { ...settings, whatsappNumber: 412345678 }],
    ['missing greeting', { ...settings, postGreeting: undefined }],
    ['untranslated closing', { ...settings, postClosing: 'x' }],
    ['non-boolean switch', { ...settings, orderingOpen: 'yes' }],
    ['too long greeting', { ...settings, postGreeting: { en: 'x'.repeat(501), id: '' } }],
  ])('rejects %s', (_label, body) => {
    expect(parseSettingsRequest(body)).toBeNull();
  });
});

describe('create requests', () => {
  const base = {
    firstName: 'Rina',
    language: 'en',
    fulfilment: 'pickup',
    lines: [{ itemId: 'a', qty: 1 }],
  };

  it('customer create accepts returning only as a boolean', () => {
    expect(parseCreateOrderRequest({ ...base, returning: true })?.returning).toBe(true);
    expect(parseCreateOrderRequest({ ...base, returning: 'yes' })).toBeNull();
  });

  it('seller create accepts confirmNow and paid, and ignores returning', () => {
    expect(parseCreateSellerOrderRequest({ ...base, confirmNow: false, paid: true })).toMatchObject(
      { confirmNow: false, paid: true },
    );
    expect(parseCreateSellerOrderRequest({ ...base, returning: true })).not.toHaveProperty(
      'returning',
    );
    expect(parseCreateSellerOrderRequest({ ...base, paid: 1 })).toBeNull();
  });
});
