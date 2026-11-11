import { describe, expect, it } from 'vitest';
import { CUSTOMER_CHANGE_HOUR, customerChangeDeadline, customerChangesClosed } from './dates';
import { isUnconfirmed } from './status';

describe('customer change deadline (plan 129)', () => {
  it('is 6 pm kitchen time the day before the cooking day', () => {
    expect(CUSTOMER_CHANGE_HOUR).toBe(18);
    // Sun 15 Nov 2026 in Adelaide (summer time, +10:30).
    expect(customerChangeDeadline('2026-11-15', 'Australia/Adelaide')).toBe(
      '2026-11-14T18:00:00+10:30',
    );
  });

  it('does not depend on the cut-off: a 3 pm or a 9 pm cut-off both close changes at 6 pm', () => {
    const week = { cookingDate: '2026-11-15' };
    const zone = 'Australia/Adelaide';
    const at = (iso: string) => new Date(iso);
    expect(customerChangesClosed(week, zone, at('2026-11-14T17:59:00+10:30'))).toBe(false);
    expect(customerChangesClosed(week, zone, at('2026-11-14T18:00:00+10:30'))).toBe(true);
  });

  it('follows daylight saving: the offset on the day before, not today', () => {
    // Summer time starts Sun 4 Oct 2026 in Adelaide: Sat 3 Oct 6 pm is still +09:30.
    expect(customerChangeDeadline('2026-10-04', 'Australia/Adelaide')).toBe(
      '2026-10-03T18:00:00+09:30',
    );
    // Ends Sun 5 Apr 2026: Sat 4 Apr 6 pm is still +10:30.
    expect(customerChangeDeadline('2026-04-05', 'Australia/Adelaide')).toBe(
      '2026-04-04T18:00:00+10:30',
    );
  });
});

describe('isUnconfirmed (plan 129)', () => {
  it('is the first state without WhatsApp received', () => {
    expect(isUnconfirmed({ status: 'ordered' })).toBe(true);
    expect(isUnconfirmed({ status: 'ordered', waReceived: false })).toBe(true);
    expect(isUnconfirmed({ status: 'ordered', waReceived: true })).toBe(false);
    expect(isUnconfirmed({ status: 'confirmed' })).toBe(false);
    expect(isUnconfirmed({ status: 'cancelled' })).toBe(false);
    expect(isUnconfirmed({ status: 'collected', waReceived: false })).toBe(false);
  });
});
