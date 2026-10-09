import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, OrderLine, OrderStatus, SellerOrder } from '../../../shared/domain';
import { formatCookingDate } from '../../../shared/dates';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { fetchSellerMenu, fetchSellerOrders } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import type { StatusTone } from '../../theme/tokens';
import { Button } from '../../ui';
import { SATURDAY_NS } from './i18n/register';

/** How often an open screen reloads, so counts follow what others do. */
export const REFRESH_MS = 15_000;

export function useLang(): Language {
  const { i18n } = useTranslation(SATURDAY_NS);
  return i18n.resolvedLanguage === 'id' ? 'id' : 'en';
}

export function toneOf(status: OrderStatus): StatusTone {
  switch (status) {
    case 'ordered':
      return 'ordered';
    case 'confirmed':
      return 'confirmed';
    case 'ready_for_pickup':
      return 'ready';
    case 'out_for_delivery':
      return 'outForDelivery';
    case 'collected':
    case 'delivered':
      return 'done';
    case 'cancelled':
      return 'cancelled';
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

export function totalCents(order: SellerOrder): number {
  return order.lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0);
}

/** "2 Lemper, 1 Tempe" in the seller's language. */
export function itemsShort(lines: ReadonlyArray<OrderLine>, lang: Language): string {
  return lines.map((line) => `${String(line.qty)} ${pickText(line.name, lang)}`).join(', ');
}

export function money(cents: number, lang: Language): string {
  return formatMoney(cents, lang);
}

// ---- Loading the week's orders (shared by the three screens) ----

export type SaturdayData =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error' }>
  | Readonly<{ status: 'ready'; orders: Array<SellerOrder>; date: string | null }>;

/** Orders and the cooking date, reloaded every REFRESH_MS. `reload` is for after an action. */
export function useSaturdayData(): { data: SaturdayData; reload: () => Promise<void> } {
  const lang = useLang();
  const slug = currentSellerSlug();
  const [data, setData] = useState<SaturdayData>({ status: 'loading' });
  const alive = useRef(true);

  const reload = useCallback(async () => {
    const [orders, menu] = await Promise.all([
      fetchSellerOrders(undefined, slug),
      fetchSellerMenu(undefined, slug),
    ]);
    if (!alive.current) return;
    if (!orders.ok) {
      // A silent refresh that fails keeps what is already on screen.
      setData((current) => (current.status === 'ready' ? current : { status: 'error' }));
      return;
    }
    setData({
      status: 'ready',
      orders: orders.data.orders,
      date: menu.ok ? formatCookingDate(menu.data.week.cookingDate, lang) : null,
    });
  }, [slug, lang]);

  useEffect(() => {
    alive.current = true;
    const first = window.setTimeout(() => void reload(), 0);
    const timer = window.setInterval(() => void reload(), REFRESH_MS);
    return () => {
      alive.current = false;
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [reload]);

  return { data, reload };
}

// ---- Layout pieces ----

export const Page = styled.main`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  max-width: 40rem;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
`;

export const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.xl};
`;

export const Sub = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.md};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

export const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;

export const Count = styled.span`
  padding: ${({ theme }) => theme.border.hairline} ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.colour.surface};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

export const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;

export const Card = styled.article`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surface};
`;

export const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const Code = styled.b`
  font-size: ${({ theme }) => theme.type.size.lg};
  letter-spacing: ${({ theme }) => theme.border.hairline};
`;

export const Small = styled.span`
  font-size: ${({ theme }) => theme.type.size.sm};
`;

export const Notice = styled.p<{ $bad?: boolean }>`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme, $bad }) => ($bad ? theme.status.cancelled.bg : theme.status.ready.bg)};
  color: ${({ theme, $bad }) => ($bad ? theme.status.cancelled.fg : theme.status.ready.fg)};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

export const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

export const Action = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.xs};
  max-width: 14rem;
`;

export const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ChipButton = styled.button<{ $pressed: boolean }>`
  min-height: ${({ theme }) => theme.minTapTarget};
  min-width: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid
    ${({ theme, $pressed }) => ($pressed ? theme.colour.accent : theme.colour.outline)};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme, $pressed }) => ($pressed ? theme.colour.accent : 'transparent')};
  color: ${({ theme, $pressed }) => ($pressed ? theme.colour.onAccent : theme.colour.text)};
  font: inherit;
  font-weight: ${({ theme }) => theme.type.weight.strong};
  cursor: pointer;
`;

type ChipProps = Readonly<{ label: string; pressed?: boolean; onSelect: () => void }>;

/** A pill-shaped toggle. Leave `pressed` out for a plain action chip. */
export function Chip({ label, pressed, onSelect }: ChipProps) {
  return (
    <ChipButton type="button" aria-pressed={pressed} $pressed={pressed === true} onClick={onSelect}>
      {label}
    </ChipButton>
  );
}

export function LoadState({
  data,
  onRetry,
}: Readonly<{ data: SaturdayData; onRetry: () => void }>) {
  const { t } = useTranslation(SATURDAY_NS);
  if (data.status === 'ready') return null;
  if (data.status === 'loading') return <Muted role="status">{t('common.loading')}</Muted>;
  return (
    <>
      <Notice $bad role="alert">
        {t('common.loadError')}
      </Notice>
      <Button onClick={onRetry}>{t('common.retry')}</Button>
    </>
  );
}
