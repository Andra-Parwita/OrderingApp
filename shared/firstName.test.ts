import { describe, expect, it } from 'vitest';
import { isPlausibleFirstName } from './firstName';
import { parseCreateOrderRequest, parseCreateSellerOrderRequest } from './orderContract';

describe('isPlausibleFirstName (plan 129)', () => {
  it.each(['Effi', 'Rianti pratiwi', '0livia', 'Éva', '  Rina  ', 'Yu'])('accepts %s', (name) => {
    expect(isPlausibleFirstName(name)).toBe(true);
  });
  it.each(['Bshsh', 'xx', 'A', 'Ng', '', '   ', '12', 'Éx1'.replace('É', '1')])(
    'refuses %s',
    (name) => {
      expect(isPlausibleFirstName(name)).toBe(false);
    },
  );
});

describe('the name rule on the two kinds of create request (plan 129)', () => {
  const body = (firstName: string) => ({
    firstName,
    language: 'en',
    fulfilment: 'pickup',
    lines: [{ itemId: 'pesmol', qty: 1 }],
  });
  it('refuses Bshsh from a customer but not from the seller', () => {
    expect(parseCreateOrderRequest(body('Bshsh'))).toBeNull();
    expect(parseCreateOrderRequest(body('Rina'))).not.toBeNull();
    expect(parseCreateSellerOrderRequest(body('Bshsh'))).not.toBeNull();
  });
});
