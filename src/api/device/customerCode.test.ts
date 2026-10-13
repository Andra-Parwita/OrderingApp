import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOMER_CODE_RE } from '../../../shared/customerCode';
import { customerCodeFor } from './customerCode';

describe("the phone's anonymous customer code (plan 071)", () => {
  beforeEach(() => localStorage.clear());

  it('is made once per kitchen, kept, and different for every kitchen', () => {
    const a = customerCodeFor('onde-onde');
    const b = customerCodeFor('dapur-demo');
    expect(a).toMatch(CUSTOMER_CODE_RE);
    expect(b).toMatch(CUSTOMER_CODE_RE);
    expect(a).not.toBe(b);
    expect(customerCodeFor('onde-onde')).toBe(a);
    expect(localStorage.getItem('customerCode:onde-onde')).toBe(a);
  });

  it('is null (nothing sent) when the phone cannot keep it', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(customerCodeFor('onde-onde')).toBeNull();
    vi.restoreAllMocks();
  });
});
