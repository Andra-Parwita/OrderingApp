import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CustomerOrder, Language } from '../../../shared/domain';
import { formatCookingDate, formatWindow } from '../../../shared/dates';
import { isUnconfirmed } from '../../../shared/status';
import type { MenuResponse } from '../../../shared/menuContract';
import { fetchMyOrders } from '../../api/client';
import { MY_ORDERS_CHANGED, rememberStatus, unconfirmedOrders } from '../../api/device/myOrders';
import { buildWhatsAppText, whatsAppUrl } from '../../api/device/whatsapp';
import { CUSTOMER_NS } from './i18n/register';

// Plan 129: the unconfirmed orders of this kitchen saved on this phone, for the amber cards on the
// menu's first page. One fetch when the page opens (the live connection keeps the saved status fresh
// after that and the cards follow it), no polling.

/** The WhatsApp link for an order: the same prefilled message as "Order placed". */
export function whatsAppLinkFor(
  order: CustomerOrder,
  menu: MenuResponse,
  lang: Language,
  t: Parameters<typeof buildWhatsAppText>[1],
): string {
  const points = menu.week.pickupPoints;
  const pickup = points.find((point) => point.id === order.pickupPlaceId) ?? points[0];
  const dayText = formatCookingDate(menu.week.cookingDate, lang);
  const when = pickup
    ? `${dayText}, ${formatWindow(pickup.window.start, pickup.window.end, lang, menu.week.cookingDate)}`
    : null;
  return whatsAppUrl(buildWhatsAppText(order, t, when), menu.kitchen.whatsappNumber);
}

export type Reminder = Readonly<{ code: string; token: string; send: () => void }>;

function tokensOf(slug: string): string {
  return unconfirmedOrders(slug)
    .map((entry) => entry.token)
    .join(',');
}

export function useWhatsAppReminders(
  slug: string,
  menu: MenuResponse | null,
  lang: Language,
  enabled: boolean,
): Array<Reminder> {
  const { i18n } = useTranslation(CUSTOMER_NS);
  const [fetched, setFetched] = useState<ReadonlyArray<CustomerOrder>>([]);
  // The saved list follows the live connection: a confirmed order drops out of it.
  const [waiting, setWaiting] = useState<string>(() => tokensOf(slug));
  useEffect(() => {
    const update = () => setWaiting(tokensOf(slug));
    update();
    window.addEventListener(MY_ORDERS_CHANGED, update);
    return () => window.removeEventListener(MY_ORDERS_CHANGED, update);
  }, [slug]);

  useEffect(() => {
    if (!enabled) return undefined;
    const tokens = tokensOf(slug);
    if (tokens === '') return undefined;
    let cancelled = false;
    void fetchMyOrders(tokens.split(',')).then((result) => {
      if (cancelled || !result.ok) return;
      for (const order of result.data.orders) rememberStatus(order);
      setFetched(result.data.orders.filter((order) => order.seller.slug === slug));
    });
    return () => {
      cancelled = true;
    };
  }, [slug, enabled]);

  const open = useCallback(
    (order: CustomerOrder) => {
      if (!menu) return;
      const url = whatsAppLinkFor(order, menu, lang, i18n.getFixedT(order.language, CUSTOMER_NS));
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [menu, lang, i18n],
  );

  return useMemo(() => {
    if (!enabled || !menu) return [];
    const still = new Set(waiting.split(',').filter(Boolean));
    return fetched
      .filter((order) => isUnconfirmed(order) && order.archived !== true && still.has(order.token))
      .map((order) => ({ code: order.code, token: order.token, send: () => open(order) }));
  }, [enabled, menu, waiting, fetched, open]);
}
