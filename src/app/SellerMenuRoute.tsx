import { MenuScreen, type MenuSlots } from '../features/seller-menu';
import { useMediaQuery } from '../components/useMediaQuery';
import { DESKTOP_QUERY } from './layout';
import { mayNotify, useSession } from './session';

/** /seller/menu: the owner's Menu; a chef (plan 030) gets Your dishes only. A phone has no On the day tab (Sell is in More). */
export function SellerMenuRoute({
  slots,
}: Readonly<{ slots: Pick<MenuSlots, 'newMenu' | 'chefs' | 'onTheDay'> }>) {
  const { me } = useSession();
  const tablet = useMediaQuery(DESKTOP_QUERY);
  const phoneSlots = { newMenu: slots.newMenu, chefs: slots.chefs };
  return (
    <MenuScreen
      slots={tablet ? slots : phoneSlots}
      canNotify={mayNotify(me)}
      {...(me?.role === 'chef' && me.chefId ? { chefId: me.chefId } : {})}
    />
  );
}
