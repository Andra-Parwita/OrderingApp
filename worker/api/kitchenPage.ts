// The kitchen's manifest and icon links in the HTML itself (plan 011), so a phone adding the page to
// the home screen finds them without waiting for React.
import { kitchenHeadHtml, kitchenPageTarget, sellerHeadHtml } from '../../shared/kitchenHeadLinks';
import type { Repository } from '../repo/Repository';

/**
 * The head HTML for this page path, or null when it belongs to no known kitchen (reserved words,
 * unknown slug or token). Seller pages (`/seller`, `/seller/*`) have no slug in the URL: the kitchen
 * is the one of the signed-in seller's session (`sessionToken`); no session, no links.
 */
export async function kitchenHeadFor(
  store: Repository,
  pathname: string,
  sessionToken?: string,
): Promise<string | null> {
  if (pathname === '/seller' || pathname.startsWith('/seller/')) {
    const caller = await store.auth.resolve(sessionToken);
    if (!caller?.sellerId || caller.setup) return null;
    const seller = (await store.sellerById(caller.sellerId))?.seller;
    return seller ? sellerHeadHtml(seller.slug, seller.name) : null;
  }
  const target = kitchenPageTarget(pathname);
  if (!target) return null;
  if ('slug' in target) {
    const seller = (await store.sellerBySlug(target.slug))?.seller;
    return seller ? kitchenHeadHtml(seller.slug, seller.name) : null;
  }
  const found = await store.lookupByToken(target.token);
  if (!found) return null;
  const { slug, name } = found.sellerRepo.seller;
  // Same start page as the one React sets (HOME_SCREEN_SOURCE in src/components/install/manifestLinks.ts).
  return kitchenHeadHtml(slug, name, `/o/${target.token}?source=homescreen`);
}
