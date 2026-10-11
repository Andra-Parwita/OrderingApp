import { MenuScreen, type MenuSlots } from '../features/seller-menu';
import { useSession } from './session';

/** /seller/menu: the owner's Menu; a chef (plan 030) gets Your dishes only. */
export function SellerMenuRoute({ slots }: Readonly<{ slots: Pick<MenuSlots, 'newMenu'> }>) {
  const { me } = useSession();
  return (
    <MenuScreen
      slots={slots}
      {...(me?.role === 'chef' && me.chefId ? { chefId: me.chefId } : {})}
    />
  );
}
