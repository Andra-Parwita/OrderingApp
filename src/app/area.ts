import { SELLER_HELP_PATH } from '../../shared/help';

export type Area = 'staff' | 'customer';

const STAFF_PREFIX = /^\/(seller|admin)(\/|$)/;

/** Plan 119: staff (seller, admin, seller Help) is a separate chunk; everything else is customer. */
export function areaOf(pathname: string): Area {
  if (STAFF_PREFIX.test(pathname)) return 'staff';
  if (pathname === SELLER_HELP_PATH || pathname.startsWith(`${SELLER_HELP_PATH}/`)) return 'staff';
  return 'customer';
}
