import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, OrderLine, OrderStatus, SellerOrder } from '../../../shared/domain';
import type { PickupPoint } from '../../../shared/domain';
import { formatCookingDate } from '../../../shared/dates';
import type { MessageLogEntry, MessageText } from '../../../shared/handoverContract';
import type { LiveEventType } from '../../../shared/liveContract';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { fetchCurrentMenu, fetchSellerOrders } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { fetchMessages } from '../../api/handover';
import { Icon, type IconName } from '../../ui';
import { SATURDAY_NS } from './i18n/register';
import { useLiveReload, type Wanted } from './useLiveReload';

export function useLang(): Language {
  const { i18n } = useTranslation(SATURDAY_NS);
  return i18n.resolvedLanguage === 'id' ? 'id' : 'en';
}

export function totalCents(order: SellerOrder): number {
  return order.lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0);
}

/** "2× Rendang · 1× Tempe" in the seller's language. */
export function itemsShort(lines: ReadonlyArray<OrderLine>, lang: Language): string {
  return lines.map((line) => `${String(line.qty)}× ${pickText(line.name, lang)}`).join(' · ');
}

export function money(cents: number, lang: Language): string {
  return formatMoney(cents, lang);
}

/** A closed order: collected, delivered or cancelled. */
export function isClosed(status: OrderStatus): boolean {
  return status === 'collected' || status === 'delivered' || status === 'cancelled';
}

/** Local "HH:MM" of an ISO instant. */
export function clock(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** The text of a custom message in a language, falling back to the other one. */
export function customText(text: MessageText | undefined, lang: Language): string {
  if (!text) return '';
  return (lang === 'id' ? (text.id ?? text.en) : (text.en ?? text.id)) ?? '';
}

/** Does the search match the bag code or the first name? */
export function matches(order: SellerOrder, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  const compact = q.replace(/[\s-]/g, '');
  return (
    order.firstName.toLowerCase().includes(q) ||
    (compact !== '' && order.code.toLowerCase().includes(compact))
  );
}

// ---- Loading ----

export type HandoverData =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error' }>
  | Readonly<{
      status: 'ready';
      orders: ReadonlyArray<SellerOrder>;
      places: ReadonlyArray<PickupPoint>;
      messages: ReadonlyArray<MessageLogEntry>;
      date: string | null;
    }>;

/**
 * Orders, the current menu's places and the message log. Plan 074: no timer; it follows the live
 * connection and reloads only what an event touched (orders and messages for `order.*`, the places
 * for `menu.changed`). `reload` (after an action here) fetches orders and messages once and ignores
 * the echo of that action.
 */
export function useHandoverData(): { data: HandoverData; reload: () => Promise<void> } {
  const lang = useLang();
  const slug = currentSellerSlug();
  const [data, setData] = useState<HandoverData>({ status: 'loading' });
  const alive = useRef(true);
  const ready = useRef(false);

  const fetchParts = useCallback(
    async (parts: Readonly<{ orders: boolean; menu: boolean; log: boolean }>) => {
      const [orders, menu, log] = await Promise.all([
        parts.orders ? fetchSellerOrders(undefined, slug) : null,
        parts.menu ? fetchCurrentMenu(undefined, slug) : null,
        parts.log ? fetchMessages(undefined, slug) : null,
      ]);
      if (!alive.current) return;
      if (orders && !orders.ok) {
        // A silent refresh that fails keeps what is already on screen.
        setData((current) => (current.status === 'ready' ? current : { status: 'error' }));
        return;
      }
      setData((current) => {
        const was = current.status === 'ready' ? current : null;
        if (!was && !orders) return current; // only a full load can start the screen
        return {
          status: 'ready',
          orders: orders?.ok ? orders.data.orders : (was?.orders ?? []),
          places: menu?.ok ? menu.data.menu.pickupPoints : (was?.places ?? []),
          messages: log?.ok ? log.data.messages : (was?.messages ?? []),
          date: menu?.ok
            ? formatCookingDate(menu.data.menu.menu.cookingDate, lang)
            : (was?.date ?? null),
        };
      });
      if (orders?.ok) ready.current = true;
    },
    [slug, lang],
  );

  const loadFor = useCallback(
    async (wanted: Wanted) => {
      const all = wanted === null || !ready.current;
      const has = (type: LiveEventType) => wanted?.has(type) ?? false;
      const orders = all || has('order.created') || has('order.changed');
      const menu = all || has('menu.changed');
      // A message sent from another device is logged together with an order event.
      if (orders || menu) await fetchParts({ orders, menu, log: orders });
    },
    [fetchParts],
  );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useLiveReload(loadFor);

  const reload = useCallback(async () => {
    await fetchParts({ orders: true, menu: !ready.current, log: true });
  }, [fetchParts]);

  return { data, reload };
}

// ---- Small pieces ----

export const Mono = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  font-weight: 600;
  letter-spacing: 0.06em;
`;

export const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;

export const Notice = styled.p<{ $bad?: boolean }>`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme, $bad }) => ($bad ? 'transparent' : theme.c.tint)};
  border: ${({ theme, $bad }) => ($bad ? `1px solid ${theme.c.danger}` : '0')};
  color: ${({ theme, $bad }) => ($bad ? theme.c.danger : theme.c.text)};
  font-weight: 600;
`;

const MarkRoot = styled.span<{ $tone: 'text' | 'conf' | 'ready' | 'muted' | 'danger' }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme, $tone }) => theme.c[$tone]};
  font-weight: 600;
  white-space: nowrap;

  svg {
    width: 1rem;
    height: 1rem;
  }
`;
const Ring = styled.span`
  width: 0.875rem;
  height: 0.875rem;
  border: ${({ theme }) => theme.border.focus} solid currentColor;
  border-radius: 50%;
`;

const MARK: Readonly<
  Record<
    OrderStatus,
    Readonly<{ icon: IconName | null; tone: 'text' | 'conf' | 'ready' | 'muted' | 'danger' }>
  >
> = {
  ordered: { icon: null, tone: 'text' },
  confirmed: { icon: 'check', tone: 'conf' },
  ready_for_pickup: { icon: 'bag', tone: 'conf' },
  out_for_delivery: { icon: 'truck', tone: 'ready' },
  collected: { icon: 'check', tone: 'muted' },
  delivered: { icon: 'check', tone: 'muted' },
  cancelled: { icon: 'x', tone: 'danger' },
};

/** Status is always an icon plus a word, never colour alone. */
export function StatusMark({ status }: Readonly<{ status: OrderStatus }>) {
  const { t } = useTranslation(SATURDAY_NS);
  const { icon, tone } = MARK[status];
  return (
    <MarkRoot $tone={tone}>
      {icon ? <Icon name={icon} /> : <Ring aria-hidden="true" />}
      {t(`status.${status}`)}
    </MarkRoot>
  );
}

export const OrderRowRoot = styled.li<{ $dim: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.125rem ${({ theme }) => theme.spacing.md};
  margin: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.md} 0;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme, $dim }) => ($dim ? theme.c.muted : theme.c.text)};
  list-style: none;
`;

export const PackedTag = styled.span`
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.radius.pill};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.75rem;
  font-weight: 600;
`;

export const Strong = styled.b``;
