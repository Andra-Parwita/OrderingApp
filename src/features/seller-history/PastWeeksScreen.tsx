import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, OrderStatus, SellerOrder } from '../../../shared/domain';
import { formatDay } from '../../../shared/dates';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import {
  orderTotalCents,
  type PastWeek,
  type PastWeekSummary,
  type WeekTotals,
} from '../../../shared/pastWeeks';
import { pickText } from '../../../shared/text';
import type { StatusTone } from '../../theme/tokens';
import { fetchPastWeek, fetchPastWeeks } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Button, Icon, Pill } from '../../ui';
import { HISTORY_NS } from './i18n/register';

const TONES: Record<OrderStatus, StatusTone> = {
  ordered: 'ordered',
  confirmed: 'confirmed',
  ready_for_pickup: 'ready',
  out_for_delivery: 'outForDelivery',
  collected: 'done',
  delivered: 'done',
  cancelled: 'cancelled',
};

const Page = styled.main`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  max-width: 48rem;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.lg};
`;
const Title = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.xl};
`;
const Sub = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.md};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colour.textMuted};
`;
const Rows = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const WeekButton = styled.button`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  align-items: center;
  width: 100%;
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: ${({ theme }) => theme.spacing.md} 0;
  border: 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
`;
const WeekDate = styled.span`
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Figures = styled.span`
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0 ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Stats = styled.dl`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
  margin: 0;

  dt {
    color: ${({ theme }) => theme.colour.textMuted};
    font-size: ${({ theme }) => theme.type.size.sm};
  }
  dd {
    margin: 0;
    font-size: ${({ theme }) => theme.type.size.lg};
    font-weight: ${({ theme }) => theme.type.weight.strong};
    font-variant-numeric: tabular-nums;
  }
`;
const Line = styled.li`
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
  font-variant-numeric: tabular-nums;
`;
const OrderLine = styled.li`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
`;
const OrderItems = styled.span`
  grid-column: 1 / -1;
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.md};
`;

type ListState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error' }>
  | Readonly<{ status: 'ready'; weeks: Array<PastWeekSummary> }>;
type DetailState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'error' }>
  | Readonly<{ status: 'ready'; week: PastWeek }>;

function Totals({ totals, lang }: Readonly<{ totals: WeekTotals; lang: Language }>) {
  const { t } = useTranslation(HISTORY_NS);
  return (
    <Stats>
      <div>
        <dt>{t('past.ordersLabel')}</dt>
        <dd>{totals.orders}</dd>
      </div>
      <div>
        <dt>{t('past.income')}</dt>
        <dd>{formatMoney(totals.incomeCents, lang)}</dd>
      </div>
      <div>
        <dt>{t('past.paid')}</dt>
        <dd>{formatMoney(totals.paidCents, lang)}</dd>
      </div>
      <div>
        <dt>{t('past.unpaid')}</dt>
        <dd>{formatMoney(totals.unpaidCents, lang)}</dd>
      </div>
      <div>
        <dt>{t('past.cancelled')}</dt>
        <dd>{totals.cancelled}</dd>
      </div>
    </Stats>
  );
}

function OrderRow({ order, lang }: Readonly<{ order: SellerOrder; lang: Language }>) {
  const { t } = useTranslation(HISTORY_NS);
  const items = order.lines.map((line) => `${String(line.qty)}× ${pickText(line.name, lang)}`);
  return (
    <OrderLine>
      <span>
        <b>{formatOrderCode(order.code)}</b> · {order.firstName}
      </span>
      <Pill tone={TONES[order.status]}>{t(`status.${order.status}`)}</Pill>
      <OrderItems>{items.join(', ')}</OrderItems>
      <span>{formatMoney(orderTotalCents(order), lang)}</span>
      <Muted>{order.paid ? t('paidMark') : t('unpaidMark')}</Muted>
    </OrderLine>
  );
}

function WeekDetail({ id, onBack }: Readonly<{ id: string; onBack: () => void }>) {
  const { t, i18n } = useTranslation(HISTORY_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const [state, setState] = useState<DetailState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void fetchPastWeek(id, undefined, currentSellerSlug()).then((result) => {
      if (live)
        setState(result.ok ? { status: 'ready', week: result.data.week } : { status: 'error' });
    });
    return () => {
      live = false;
    };
  }, [id, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const back = (
    <div>
      <Button variant="quiet" onClick={onBack}>
        <Icon name="back" />
        {t('past.all')}
      </Button>
    </div>
  );
  if (state.status === 'loading') {
    return (
      <>
        {back}
        <Muted role="status">{t('loading')}</Muted>
      </>
    );
  }
  if (state.status === 'error') {
    return (
      <>
        {back}
        <div role="alert">
          <Muted>{t('error')}</Muted>
          <Button onClick={retry}>{t('retry')}</Button>
        </div>
      </>
    );
  }
  const { week } = state;
  return (
    <>
      {back}
      <Title>{formatDay(week.cookingDate, lang)}</Title>
      <Totals totals={week.totals} lang={lang} />
      <Sub>{t('past.itemTotals')}</Sub>
      <Rows aria-label={t('past.itemTotals')}>
        {week.totals.items.map((item) => (
          <Line key={item.itemId}>
            <span>{pickText(item.name, lang)}</span>
            <b>{item.qty}</b>
          </Line>
        ))}
      </Rows>
      <Sub>{t('past.orderList')}</Sub>
      {week.orders === undefined ? (
        <Muted role="status">{t('past.expired')}</Muted>
      ) : week.orders.length === 0 ? (
        <Muted>{t('past.noOrders')}</Muted>
      ) : (
        <Rows aria-label={t('past.orderList')}>
          {week.orders.map((order) => (
            <OrderRow key={order.id} order={order} lang={lang} />
          ))}
        </Rows>
      )}
    </>
  );
}

/** Past weeks: totals are kept for good, order details for 4 weeks (D-027). Route-agnostic. */
export function PastWeeksScreen() {
  const { t, i18n } = useTranslation(HISTORY_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void fetchPastWeeks(undefined, currentSellerSlug()).then((result) => {
      if (!live) return;
      setState(
        result.ok
          ? {
              status: 'ready',
              weeks: [...result.data.weeks].sort((a, b) =>
                b.cookingDate.localeCompare(a.cookingDate),
              ),
            }
          : { status: 'error' },
      );
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  const close = useCallback(() => setOpenId(null), []);

  if (openId !== null) {
    return (
      <Page>
        <WeekDetail id={openId} onBack={close} />
      </Page>
    );
  }
  return (
    <Page>
      <Title>{t('past.title')}</Title>
      {state.status === 'loading' ? <Muted role="status">{t('loading')}</Muted> : null}
      {state.status === 'error' ? (
        <div role="alert">
          <Muted>{t('error')}</Muted>
          <Button onClick={retry}>{t('retry')}</Button>
        </div>
      ) : null}
      {state.status === 'ready' && state.weeks.length === 0 ? (
        <Muted>{t('past.empty')}</Muted>
      ) : null}
      {state.status === 'ready' && state.weeks.length > 0 ? (
        <Rows aria-label={t('past.title')}>
          {state.weeks.map((week) => {
            const date = formatDay(week.cookingDate, lang);
            return (
              <li key={week.id}>
                <WeekButton
                  type="button"
                  aria-label={t('past.open', { date })}
                  onClick={() => setOpenId(week.id)}
                >
                  <WeekDate>{date}</WeekDate>
                  <span>{t('past.orders', { count: week.totals.orders })}</span>
                  <Figures>
                    <span>
                      {t('past.income')} {formatMoney(week.totals.incomeCents, lang)}
                    </span>
                    <span>
                      {t('past.paid')} {formatMoney(week.totals.paidCents, lang)}
                    </span>
                    <span>
                      {t('past.unpaid')} {formatMoney(week.totals.unpaidCents, lang)}
                    </span>
                  </Figures>
                </WeekButton>
              </li>
            );
          })}
        </Rows>
      ) : null}
      <Muted>{t('past.keep')}</Muted>
    </Page>
  );
}
