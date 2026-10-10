import { describe, expect, it } from 'vitest';
import {
  formatOrderCode,
  generateOrderCode,
  generateToken,
  ORDER_CODE_ALPHABET,
  parseOrderCode,
} from './orderCode';

describe('order codes', () => {
  it('generates 6 characters from the alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateOrderCode();
      expect(code).toHaveLength(6);
      for (const char of code) expect(ORDER_CODE_ALPHABET).toContain(char);
    }
  });

  it('has no O, 0, I or 1 in the alphabet', () => {
    expect(ORDER_CODE_ALPHABET).toHaveLength(32);
    for (const char of 'O0I1') expect(ORDER_CODE_ALPHABET).not.toContain(char);
  });

  it('uses the injected random source', () => {
    expect(generateOrderCode((bytes) => bytes.fill(0))).toBe('AAAAAA');
  });

  it('formats as XXX-XXX', () => {
    expect(formatOrderCode('K7F2QX')).toBe('K7F-2QX');
  });

  it.each(['K7F-2QX', 'k7f-2qx', 'k7f2qx', ' K7F 2QX ', 'k7f 2qx', 'K7F2-QX'])(
    'parses forgivingly: %j',
    (input) => {
      expect(parseOrderCode(input)).toBe('K7F2QX');
    },
  );

  it.each([
    ['empty', ''],
    ['too short', 'K7F-2Q'],
    ['too long', 'K7F-2QXA'],
    ['an O', 'K7F-2QO'],
    ['a zero', 'K7F-2Q0'],
    ['an I', 'K7F-2QI'],
    ['a one', 'K7F-2Q1'],
    ['punctuation', 'K7F.2QX'],
  ])('rejects %s', (_label, input) => {
    expect(parseOrderCode(input)).toBeNull();
  });

  it('round-trips a generated code', () => {
    const code = generateOrderCode();
    expect(parseOrderCode(formatOrderCode(code))).toBe(code);
  });
});

describe('generateToken', () => {
  it('is base64url with at least 128 bits and is not repeated', () => {
    const a = generateToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length * 6).toBeGreaterThanOrEqual(128);
    expect(generateToken()).not.toBe(a);
  });
});
