import { describe, expect, it } from 'vitest';
import { SELLER_HELP_PATH } from '../../shared/help';
import { areaOf } from './area';

describe('areaOf', () => {
  it.each(['/seller', '/seller/orders', '/admin', '/admin/kitchens', SELLER_HELP_PATH])(
    '%s is staff',
    (path) => expect(areaOf(path)).toBe('staff'),
  );

  it.each(['/', '/dellavee', '/dellavee/dishes', '/sellers', '/administrator', '/help-other'])(
    '%s is customer',
    (path) => expect(areaOf(path)).toBe('customer'),
  );
});
