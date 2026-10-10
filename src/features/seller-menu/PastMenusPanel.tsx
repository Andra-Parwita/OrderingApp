import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { fetchPastWeek } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { formatDay } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { orderTotalCents, type PastWeek, type PastWeekSummary } from '../../../shared/pastWeeks';
import { pickText } from '../../../shared/text';
import { Button, Icon, Pager, pageItems } from '../../ui';
import { MENU_NS } from './i18n/register';
import { GroupLabel, Muted } from './menuShared';
import { dishLine } from './pastMenus';

// Past menus: the list (pages of 20) and one menu's detail. In the "no active menu" state the list
// is the page; while a menu is active it sits in a side panel behind "Past menus · N".

const Row = styled.button<{ $selected: boolean; $compact: boolean }>`
  display: grid;
  grid-template-columns: ${({ $compact }) =>
    $compact ? '7rem minmax(0, 1fr) auto' : '8rem minmax(0, 1fr) auto auto auto'};
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  width: 100%;
  min-height: ${({ theme }) => theme.size.tap + 8}px;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border: 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ $selected, theme }) => ($selected ? theme.c.tint : 'transparent')};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  text-align: left;
  cursor: pointer;
  font-variant-numeric: tabular-nums;

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
`;
const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
  margin: ${({ theme }) => theme.spacing.md} 0;

  strong {
    display: block;
    font-size: 1.375rem;
    font-variant-numeric: tabular-nums;
  }
  span {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
  }
`;
const Lines = styled.ul`
  margin: ${({ theme }) => theme.spacing.sm} 0 ${({ theme }) => theme.spacing.lg};
  padding: 0;
  list-style: none;

  li {
    display: flex;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.sm} 0;
    border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
    font-variant-numeric: tabular-nums;
  }
  code {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 0.8125rem;
    color: ${({ theme }) => theme.c.muted};
  }
`;
const BackLink = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-height: ${({ theme }) => theme.size.tap}px;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: 600;
  cursor: pointer;
`;

export function PastList({
  weeks,
  lang,
  selectedId,
  compact = false,
  onOpen,
}: Readonly<{
  weeks: ReadonlyArray<PastWeekSummary>;
  lang: Language;
  selectedId?: string | undefined;
  compact?: boolean;
  onOpen: (id: string) => void;
}>) {
  const { t } = useTranslation(MENU_NS);
  const [page, setPage] = useState(0);
  if (weeks.length === 0) return <Muted>{t('past.empty')}</Muted>;
  return (
    <div>
      {pageItems(weeks, page).map((week) => (
        <Row
          key={week.id}
          type="button"
          $selected={week.id === selectedId}
          $compact={compact}
          onClick={() => onOpen(week.id)}
        >
          <strong>{formatDay(week.cookingDate, lang)}</strong>
          <span className="dishes">{dishLine(week.totals.items, lang)}</span>
          {compact ? null : (
            <span className="meta">{t('past.orders', { count: week.totals.orders })}</span>
          )}
          <strong>{formatMoney(week.totals.incomeCents, lang)}</strong>
          {compact ? null : <Icon name="forward" />}
        </Row>
      ))}
      <Pager page={page} total={weeks.length} onPage={setPage} />
    </div>
  );
}

type Loaded = { status: 'loading' } | { status: 'error' } | { status: 'ready'; week: PastWeek };

/** One past menu: totals, dishes with quantities sold, who ordered, and the way to reuse its dishes. */
export function PastDetail({
  summary,
  lang,
  useLabel,
  onUse,
  onBack,
}: Readonly<{
  summary: PastWeekSummary;
  lang: Language;
  /** Absent: the reuse button is hidden (a live menu is running). */
  useLabel?: string;
  onUse: () => void;
  onBack?: () => void;
}>) {
  const { t } = useTranslation(MENU_NS);
  // The answer is kept with the menu it belongs to, so another menu shows "loading" until it lands.
  const [answer, setAnswer] = useState<{ id: string; state: Loaded } | null>(null);
  const state: Loaded = answer?.id === summary.id ? answer.state : { status: 'loading' };
  useEffect(() => {
    let live = true;
    void fetchPastWeek(summary.id, undefined, currentSellerSlug()).then((result) => {
      if (live)
        setAnswer({
          id: summary.id,
          state: result.ok ? { status: 'ready', week: result.data.week } : { status: 'error' },
        });
    });
    return () => {
      live = false;
    };
  }, [summary.id]);
  const orders = state.status === 'ready' ? state.week.orders : undefined;
  return (
    <div>
      {onBack ? (
        <BackLink type="button" onClick={onBack}>
          <Icon name="back" />
          {t('past.back')}
        </BackLink>
      ) : null}
      <h2>{t('past.title', { date: formatDay(summary.cookingDate, lang) })}</h2>
      <Stats>
        <div>
          <strong>{summary.totals.orders}</strong>
          <span>{t('past.orders', { count: summary.totals.orders })}</span>
        </div>
        <div>
          <strong>{formatMoney(summary.totals.incomeCents, lang)}</strong>
          <span>{t('past.total')}</span>
        </div>
        <div>
          <strong>{formatMoney(summary.totals.unpaidCents, lang)}</strong>
          <span>{t('past.unpaid')}</span>
        </div>
      </Stats>
      <GroupLabel>{t('past.dishes')}</GroupLabel>
      <Lines>
        {summary.totals.items.map((item) => (
          <li key={item.itemId}>
            <span>{pickText(item.name, lang)}</span>
            <strong>{item.qty}</strong>
          </li>
        ))}
      </Lines>
      <GroupLabel>{t('past.who')}</GroupLabel>
      {state.status === 'loading' ? <Muted role="status">{t('loading')}</Muted> : null}
      {state.status === 'error' ? <Muted role="alert">{t('error')}</Muted> : null}
      {state.status === 'ready' && orders === undefined ? <Muted>{t('past.dropped')}</Muted> : null}
      {orders ? (
        <Lines>
          {orders.map((order) => (
            <li key={order.id}>
              <span>
                <code>{formatOrderCode(order.code)}</code> {order.firstName}
                <br />
                <Muted as="span">
                  {order.lines
                    .map((line) => `${line.qty} × ${pickText(line.name, lang)}`)
                    .join(', ')}
                </Muted>
              </span>
              <span>
                {formatMoney(orderTotalCents(order), lang)}{' '}
                <Muted as="span">{order.paid ? t('past.paid') : t('past.notPaid')}</Muted>
              </span>
            </li>
          ))}
        </Lines>
      ) : null}
      {useLabel ? (
        <Button variant="primary" onClick={onUse}>
          {useLabel}
        </Button>
      ) : null}
    </div>
  );
}
