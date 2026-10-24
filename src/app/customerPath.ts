import { parseOrderPath } from '../../shared/orderPath';
import { isValidSlug } from '../../shared/seller';

// Which customer page an address is (plan 102 stage 4). The pages live under the kitchen
// (`/<slug>/o/<token>`, `/<slug>/my-orders`, `/<slug>/settings`); the slug-less `/o/<token>`,
// `/my-orders` and `/settings` stay for the browser tab's all-kitchens view and old links.
export type CustomerArea = Readonly<{
  kind: 'order' | 'orders' | 'settings' | 'kitchen' | 'other';
  /** The kitchen in the address, or null (slug-less pages, unknown addresses). */
  slug: string | null;
  /** The order's token on an order page. */
  token?: string;
  /** The path parts after the page itself, e.g. `['qr']` or `['basket', 'name']`. */
  sub: ReadonlyArray<string>;
}>;

export function customerArea(pathname: string): CustomerArea {
  const order = parseOrderPath(pathname);
  if (order) {
    return {
      kind: 'order',
      slug: order.slug,
      token: order.token,
      sub: order.sub.split('/').filter(Boolean),
    };
  }
  const parts = pathname.split('/').filter(Boolean);
  const [first, second] = parts;
  if (first === 'my-orders') return { kind: 'orders', slug: null, sub: parts.slice(1) };
  if (first === 'settings') return { kind: 'settings', slug: null, sub: parts.slice(1) };
  if (!isValidSlug(first)) return { kind: 'other', slug: null, sub: parts };
  if (second === 'my-orders') return { kind: 'orders', slug: first, sub: parts.slice(2) };
  if (second === 'settings') return { kind: 'settings', slug: first, sub: parts.slice(2) };
  return { kind: 'kitchen', slug: first, sub: parts.slice(1) };
}
