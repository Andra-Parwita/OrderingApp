import { describe, expect, it } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it.each([
    [1250, '$12.50'],
    [1000, '$10.00'],
    [5, '$0.05'],
    [0, '$0.00'],
    [123456, '$1,234.56'],
    [-250, '-$2.50'],
  ])('%i cents is %s in both languages', (cents, text) => {
    expect(formatMoney(cents, 'en')).toBe(text);
    expect(formatMoney(cents, 'id')).toBe(text);
  });
});
