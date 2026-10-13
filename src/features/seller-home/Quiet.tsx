import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatDay } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import type { Menu } from '../../../shared/menusContract';
import { formatMoney } from '../../../shared/money';
import type { PastWeekSummary, WeekTotals } from '../../../shared/pastWeeks';
import { pickText } from '../../../shared/text';
import { fetchPastWeek } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Icon } from '../../ui';
import { agoOf, finishedAtOf, freshness, isRecent, type Ago } from './homeState';
import { ChefIncomeButton } from '../../components/chef-income';
import { GoLink, Section } from './homeParts';
import { HOME_NS } from './i18n/register';

// States 5 and 6, the body: the last menu (a highlight whose age bar and colour say how long ago
// it finished), the three menus before it, and the way to all of them.

const EARLIER_SHOWN = 3;

const Card = styled.section<{ $recent: boolean }>`
  overflow: hidden;
  border: ${({ theme }) => theme.border.hairline} solid
    ${({ $recent, theme }) => ($recent ? theme.c.fill : theme.c.line)};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
`;
const CardHead = styled.div<{ $recent: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ $recent, theme }) => ($recent ? theme.c.tint : theme.c.surf2)};
  color: ${({ $recent, theme }) => ($recent ? theme.c.atext : theme.c.muted)};
  font-weight: 600;

  .bar {
    flex: none;
    width: 8rem;
    height: 0.25rem;
    border-radius: 0.125rem;
    background: ${({ theme }) => theme.c.line};
  }
  .when {
    margin-left: auto;
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
    font-weight: 400;
  }
`;
const Fill = styled.span<{ $share: number; $recent: boolean }>`
  display: block;
  width: ${({ $share }) => $share * 100}%;
  height: 100%;
  border-radius: inherit;
  background: ${({ $recent, theme }) => ($recent ? theme.c.fill : theme.c.ctrl)};
`;
const CardBody = styled.div`
  padding: ${({ theme }) => theme.spacing.lg};
`;
const CardTop = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};

  h2 {
    margin: 0;
    font-size: 1.375rem;
    font-weight: 700;
  }
`;
const Numbers = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  margin: ${({ theme }) => theme.spacing.lg} 0;
`;
const Figure = styled.div<{ $warn?: boolean }>`
  strong {
    display: block;
    color: ${({ $warn, theme }) => ($warn ? theme.c.warn : theme.c.text)};
    font-size: 1.5rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  span {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.875rem;
  }
`;
const Sold = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl};
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.875rem;

  b {
    margin-left: ${({ theme }) => theme.spacing.xs};
    font-variant-numeric: tabular-nums;
  }
`;
const EarlierHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: 0 ${({ theme }) => theme.size.pagePadTablet}px;

  h2 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
  }
`;
const EarlierRow = styled.button`
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr) auto auto auto auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  width: 100%;
  min-height: ${({ theme }) => theme.size.rowOrder}px;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.size.pagePadTablet}px;
  border: 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  text-align: left;
  font-variant-numeric: tabular-nums;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.c.surf2};
  }
  strong {
    font-weight: 700;
  }
  .dishes {
    overflow: hidden;
    color: ${({ theme }) => theme.c.muted};
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    color: ${({ theme }) => theme.c.muted};
  }
  .ok {
    color: ${({ theme }) => theme.c.conf};
  }
  .owed {
    color: ${({ theme }) => theme.c.warn};
  }
`;

const NO_TOTALS: WeekTotals = {
  orders: 0,
  cancelled: 0,
  incomeCents: 0,
  paidCents: 0,
  unpaidCents: 0,
  items: [],
};

/** Collected and delivered counts for one finished menu, while its order details are kept. */
function useHandedOver(week: PastWeekSummary | undefined) {
  const [counts, setCounts] = useState<{ id: string; collected: number; delivered: number } | null>(
    null,
  );
  const id = week?.hasOrders ? week.id : undefined;
  useEffect(() => {
    if (id === undefined) return undefined;
    let live = true;
    void fetchPastWeek(id, undefined, currentSellerSlug()).then((result) => {
      if (!live || !result.ok) return;
      const orders = result.data.week.orders ?? [];
      setCounts({
        id,
        collected: orders.filter((order) => order.status === 'collected').length,
        delivered: orders.filter((order) => order.status === 'delivered').length,
      });
    });
    return () => {
      live = false;
    };
  }, [id]);
  return counts && counts.id === id ? counts : null;
}

export function useAgoText() {
  const { t } = useTranslation(HOME_NS);
  return (ago: Ago): string =>
    ago.kind === 'today' || ago.kind === 'yesterday'
      ? t(`ago.${ago.kind}`)
      : ago.kind === 'days'
        ? t('ago.days', { count: ago.count })
        : t('ago.week', { count: ago.count });
}

/** The last finished menu of this kitchen: the one the menu is on, else the newest earlier one. */
export function lastMenuOf(menu: Menu, past: ReadonlyArray<PastWeekSummary>) {
  const week = past.find((candidate) => candidate.cookingDate === menu.cookingDate) ?? past[0];
  const same = week === undefined || week.cookingDate === menu.cookingDate;
  const finishedAt = same || !week ? finishedAtOf(menu) : week.closedAt;
  return { week, cookingDate: week?.cookingDate ?? menu.cookingDate, finishedAt };
}

export function LastMenu({
  menu,
  past,
  lang,
  now,
  onGoOrders,
}: Readonly<{
  menu: Menu;
  past: ReadonlyArray<PastWeekSummary>;
  lang: Language;
  now: Date;
  onGoOrders: () => void;
}>) {
  const { t } = useTranslation(HOME_NS);
  const agoText = useAgoText();
  const { week, cookingDate, finishedAt } = lastMenuOf(menu, past);
  const totals = week?.totals ?? NO_TOTALS;
  const handed = useHandedOver(week);
  const recent = isRecent(finishedAt, now);
  const when = agoText(agoOf(finishedAt, now));
  const money = (cents: number) => formatMoney(cents, lang);
  return (
    <Section>
      <Card
        $recent={recent}
        aria-label={t('quiet.menuFor', { date: formatDay(cookingDate, lang) })}
      >
        <CardHead $recent={recent}>
          <Icon name="history" />
          <span>{t('quiet.finished', { when })}</span>
          <span className="bar" aria-hidden="true">
            <Fill $share={freshness(finishedAt, now)} $recent={recent} />
          </span>
          <span className="when">
            {formatDay(cookingDate, lang)}
            {recent ? ` · ${t('quiet.handedOver')}` : ''}
          </span>
        </CardHead>
        <CardBody>
          <CardTop>
            <h2>{t('quiet.menuFor', { date: formatDay(cookingDate, lang) })}</h2>
            <GoLink onClick={onGoOrders}>{t('quiet.goOrders')}</GoLink>
            <ChefIncomeButton menuId={week?.id ?? 'current'} />
          </CardTop>
          <Numbers>
            <Figure>
              <strong>{totals.orders}</strong>
              <span>
                {t('quiet.orders', { count: totals.orders, cancelled: totals.cancelled })}
              </span>
            </Figure>
            <Figure>
              <strong>{money(totals.incomeCents)}</strong>
              <span>{t('quiet.total')}</span>
            </Figure>
            {handed ? (
              <Figure>
                <strong>
                  {handed.collected} · {handed.delivered}
                </strong>
                <span>{t('quiet.collectedDelivered')}</span>
              </Figure>
            ) : (
              <Figure>
                <strong>{money(totals.paidCents)}</strong>
                <span>{t('quiet.paid')}</span>
              </Figure>
            )}
            <Figure $warn={totals.unpaidCents > 0}>
              <strong>{money(totals.unpaidCents)}</strong>
              <span>{t('quiet.notPaidAmount')}</span>
            </Figure>
          </Numbers>
          {totals.items.length > 0 ? (
            <Sold aria-label={t('quiet.dishesSold')}>
              {totals.items.map((item) => (
                <li key={item.itemId}>
                  {pickText(item.name, lang)}
                  <b>{item.qty}</b>
                </li>
              ))}
            </Sold>
          ) : null}
        </CardBody>
      </Card>
    </Section>
  );
}

export function EarlierMenus({
  weeks,
  total,
  lang,
  onOpen,
  onGoMenu,
}: Readonly<{
  /** The menus before the last one, newest first (the first three are shown). */
  weeks: ReadonlyArray<PastWeekSummary>;
  /** All finished menus, for "all N menus". */
  total: number;
  lang: Language;
  onOpen: (week: PastWeekSummary, opener: HTMLElement) => void;
  onGoMenu: () => void;
}>) {
  const { t } = useTranslation(HOME_NS);
  if (weeks.length === 0) return null;
  return (
    <section aria-labelledby="home-earlier">
      <EarlierHead>
        <h2 id="home-earlier">{t('quiet.earlier')}</h2>
        <GoLink onClick={onGoMenu}>{t('quiet.goAllMenus', { count: total })}</GoLink>
      </EarlierHead>
      <div>
        {weeks.slice(0, EARLIER_SHOWN).map((week) => (
          <EarlierRow
            key={week.id}
            type="button"
            onClick={(event) => onOpen(week, event.currentTarget)}
          >
            <strong>{formatDay(week.cookingDate, lang)}</strong>
            <span className="dishes">
              {week.totals.items.map((item) => pickText(item.name, lang)).join(' · ')}
            </span>
            <span className="meta">{t('quiet.orderCount', { count: week.totals.orders })}</span>
            <strong>{formatMoney(week.totals.incomeCents, lang)}</strong>
            <span className={week.totals.unpaidCents > 0 ? 'owed' : 'ok'}>
              {week.totals.unpaidCents > 0
                ? t('quiet.unpaidAmount', { amount: formatMoney(week.totals.unpaidCents, lang) })
                : t('quiet.allPaid')}
            </span>
            <Icon name="forward" />
          </EarlierRow>
        ))}
      </div>
    </section>
  );
}
