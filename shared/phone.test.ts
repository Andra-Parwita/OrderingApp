import { describe, expect, it } from 'vitest';
import { formatPhone, normalisePhone } from './phone';

describe('formatPhone', () => {
  it('formats an Australian mobile as +61 xxx xxx xxx', () => {
    expect(formatPhone('61412345678')).toBe('+61 412 345 678');
  });

  it('groups other numbers after two digits, then blocks of four', () => {
    expect(formatPhone('6281234567890')).toBe('+62 8123 4567 890');
    expect(formatPhone('447700900123')).toBe('+44 7700 9001 23');
  });
});

describe('normalisePhone', () => {
  it('accepts the usual ways of writing an Australian mobile', () => {
    for (const ok of [
      '0412 345 678',
      '+61412345678',
      '+61 412 345 678',
      '61412345678',
      '61 412 345 678',
      '(0412) 345-678',
      '0061 412 345 678',
    ]) {
      expect(normalisePhone(ok)).toBe('61412345678');
    }
  });

  it('accepts numbers from other countries with + or 00', () => {
    expect(normalisePhone('+62 812 3456 7890')).toBe('6281234567890');
    expect(normalisePhone('0062 812 3456 7890')).toBe('6281234567890');
    expect(normalisePhone('+44 7700 900123')).toBe('447700900123');
  });

  it('rejects landlines, bad lengths, letters and empty text', () => {
    for (const bad of [
      '',
      '12345',
      '0212 345 678',
      'abc',
      '+61 2 9999 9999',
      '+610412345678',
      '+62 123',
      '+1234567890123456',
      '+62 812 abc 7890',
      '62 812 3456 7890',
      '+0 812 3456 7890',
    ]) {
      expect(normalisePhone(bad)).toBeNull();
    }
  });
});
