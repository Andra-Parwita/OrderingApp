import { currentSellerSlug } from '../../api/device/sellerContext';
import { fetchCurrentMenu, fetchSettings } from '../../api/client';
import type { ShareMenu, ShareSettings } from './shareText';

export type ShareData = { menu: ShareMenu; settings: ShareSettings };

/** The current menu and the post settings, reduced to what the post needs; null when either call fails. */
export async function loadShareData(): Promise<ShareData | null> {
  const [menu, settings] = await Promise.all([
    fetchCurrentMenu(undefined, currentSellerSlug()),
    fetchSettings(undefined, currentSellerSlug()),
  ]);
  if (!menu.ok || !settings.ok) return null;
  return {
    menu: {
      cookingDate: menu.data.menu.menu.cookingDate,
      cutoffAt: menu.data.menu.menu.cutoffAt,
      pickupPoints: menu.data.menu.pickupPoints,
      delivery: menu.data.menu.menu.delivery,
      // Only the fields the post needs: no chef id can reach the text (D-012).
      items: menu.data.menu.dishes.map(({ name, description, size, priceCents }) => ({
        name,
        description,
        size,
        priceCents,
      })),
    },
    settings: {
      ...(settings.data.settings.whatsappNumber !== undefined
        ? { whatsappNumber: settings.data.settings.whatsappNumber }
        : {}),
      postGreeting: settings.data.settings.postGreeting,
      postClosing: settings.data.settings.postClosing,
    },
  };
}
