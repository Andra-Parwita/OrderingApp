import { describe, expect, it } from 'vitest';
import { formatPhone, normaliseAuMobile } from './phone';

describe('formatPhone', () => {
  it('formats an Australian mobile and keeps other numbers as +digits', () => {
    expect(formatPhone('61412345678')).toBe('+61 412 345 678');
    expect(formatPhone('6281234')).toBe('+6281234');
  });
});

describe('normaliseAuMobile', () => {
  it('accepts the usual ways of writing a mobile', () => {
    for (const ok of ['0412 345 678', '+61412345678', '61 412 345 678', '(0412) 345-678']) {
      expect(normaliseAuMobile(ok)).toBe('61412345678');
    }
  });

  it('rejects other numbers and text', () => {
    for (const bad of ['', '12345', '0212 345 678', 'abc', '+44 7700 900123', '+610412345678']) {
      expect(normaliseAuMobile(bad)).toBeNull();
    }
  });
});
