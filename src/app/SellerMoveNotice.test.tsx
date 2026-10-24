import { describe, expect, it } from 'vitest';
import { moveNoticeDue, type MoveNoticeFacts } from './SellerMoveNotice';

// Plan 101 section 4: the one-time notice inside the old "Seller" app.

const OLD_APP: MoveNoticeFacts = { standalone: true, search: '', remembered: null, kitchens: 2 };

describe('the move notice conditions', () => {
  it('shows in the old standalone app, with no k and no remembered kitchen, for 2+ kitchens', () => {
    expect(moveNoticeDue(OLD_APP)).toBe(true);
  });
  it('not in a browser tab', () => {
    expect(moveNoticeDue({ ...OLD_APP, standalone: false })).toBe(false);
  });
  it('not when the launch names a kitchen (a new app)', () => {
    expect(moveNoticeDue({ ...OLD_APP, search: '?k=onde-onde' })).toBe(false);
  });
  it('not when this window remembers a kitchen', () => {
    expect(moveNoticeDue({ ...OLD_APP, remembered: 'onde-onde' })).toBe(false);
  });
  it('not for a one-kitchen person', () => {
    expect(moveNoticeDue({ ...OLD_APP, kitchens: 1 })).toBe(false);
    expect(moveNoticeDue({ ...OLD_APP, kitchens: 0 })).toBe(false);
  });
});
