import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { styled } from 'styled-components';
import { formatDay } from '../../../shared/dates';
import type { Language, Order } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { summariseOrders, type WeekTotals } from '../../../shared/pastWeeks';
import { pickText } from '../../../shared/text';
import type { MenuView } from '../../../shared/menusContract';
import { Button, Icon } from '../../ui';
import { FeedbackHost } from './FeedbackHost';
import { SELLER_NS } from './i18n/register';
import { PaidSheet } from './PaidSheet';
import { orderTotalCents, useLang } from './orderText';
import { isUnpaid, selectOrders, selectPast } from './sellerOrdersSelectors';
import { useReadOnlyOrders } from './orderAccess';
import { pastRequested } from './sellerOrdersSlice';

// Orders when no menu is live (plan 039): the last menu's summary, or a pointer to where menus are
// started (Home on a tablet). The first-run checklist and the earlier menus live on Home.

const Section = styled.section`
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.size.pagePadTablet}px;
`;
const Kicker = styled.p`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  color: ${({ theme }) => theme.c.atext};
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;
const Big = styled.h2`
  margin: ${({ theme }) => theme.spacing.xs} 0;
  font-size: 2rem;
  font-weight: 700;
`;
const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
`;
const HeadRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;
const HeadActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  margin: ${({ theme }) => theme.spacing.lg} 0;
`;
const Stat = styled.div<{ $warn?: boolean }>`
  strong {
    display: block;
    color: ${({ theme, $warn }) => ($warn ? theme.c.warn : theme.c.text)};
    font-size: 1.75rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  span {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.875rem;
  }
`;
const GroupLabel = styled.h3`
  margin: ${({ theme }) => theme.spacing.lg} 0 ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;
const Sold = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl};
  margin: 0;
  padding: 0;
  list-style: none;

  b {
    margin-left: ${({ theme }) => theme.spacing.xs};
    font-variant-numeric: tabular-nums;
  }
`;
const Loose = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  margin: ${({ theme }) => theme.spacing.sm} 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.warnTint};

  code {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 0.8125rem;
    color: ${({ theme }) => theme.c.muted};
  }
`;
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;
const Message = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
  color: ${({ theme }) => theme.c.muted};
`;

function Totals({
  totals,
  lang,
  doneCount,
  unpaidCount,
}: Readonly<{
  totals: WeekTotals;
  lang: Language;
  doneCount: number | null;
  unpaidCount: number | null;
}>) {
  const { t } = useTranslation(SELLER_NS);
  return (
    <>
      <Stats>
        <Stat>
          <strong>{totals.orders}</strong>
          <span>{t('home.statOrders', { count: totals.orders, cancelled: totals.cancelled })}</span>
        </Stat>
        <Stat>
          <strong>{formatMoney(totals.incomeCents, lang)}</strong>
          <span>{t('home.statTotal')}</span>
        </Stat>
        {doneCount !== null ? (
          <Stat>
            <strong>{doneCount}</strong>
            <span>{t('home.statDone')}</span>
          </Stat>
        ) : null}
        <Stat $warn={totals.unpaidCents > 0}>
          <strong>{formatMoney(totals.unpaidCents, lang)}</strong>
          <span>
            {unpaidCount !== null
              ? t('home.statUnpaid', { count: unpaidCount })
              : t('live.notPaid')}
          </span>
        </Stat>
      </Stats>
      {totals.items.length > 0 ? (
        <>
          <GroupLabel>{t('home.dishesSold')}</GroupLabel>
          <Sold>
            {totals.items.map((item) => (
              <li key={item.itemId}>
                {pickText(item.name, lang)}
                <b>{item.qty}</b>
              </li>
            ))}
          </Sold>
        </>
      ) : null}
    </>
  );
}

/**
 * No menu is running and none is being made: Orders has nothing to show. A tablet is pointed to
 * Home, where menus are started (plan 039); a phone has no Home, so it keeps a way to Menu.
 */
export function NoMenuRunning({ phone }: Readonly<{ phone: boolean }>) {
  const { t } = useTranslation(SELLER_NS);
  const navigate = useNavigate();
  const readOnly = useReadOnlyOrders();
  return (
    <Section>
      <Muted>{t('home.noMenu')}</Muted>
      <Actions>
        {readOnly ? null : (
          <Button
            variant="primary"
            onClick={() => void navigate(phone ? '/seller/menu' : '/seller')}
          >
            {phone ? t('home.makeMenu') : t('home.startFromHome')}
          </Button>
        )}
      </Actions>
    </Section>
  );
}

/**
 * Cooking day over: the last menu's summary (totals, dishes sold, unpaid loose ends); "See all N
 * orders" opens the list. Starting the next menu is on Home (a phone: Menu).
 */
export function FinishedHome({
  view,
  showAll,
  onToggleAll,
  phone,
}: Readonly<{ view: MenuView; showAll: boolean; onToggleAll: () => void; phone: boolean }>) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const navigate = useNavigate();
  const readOnly = useReadOnlyOrders();
  const orders = useSelector(selectOrders);
  const past = useSelector(selectPast);
  const weeks = useMemo(() => (past.status === 'ready' ? past.weeks : []), [past]);
  const mine = weeks.find((week) => week.cookingDate === view.menu.cookingDate);
  const totals = useMemo<WeekTotals | null>(
    () => (orders.length > 0 ? summariseOrders(orders) : (mine?.totals ?? null)),
    [orders, mine],
  );
  const loose = useMemo(() => orders.filter(isUnpaid), [orders]);
  const doneCount = useMemo(
    () =>
      orders.length > 0
        ? orders.filter((o) => o.status === 'collected' || o.status === 'delivered').length
        : null,
    [orders],
  );
  return (
    <>
      <FeedbackHost />
      <Section>
        <HeadRow>
          <div>
            <Kicker>
              <Icon name="check" />
              {t('home.justFinished')}
            </Kicker>
            <Big>{formatDay(view.menu.cookingDate, lang)}</Big>
            <Muted>{t('home.closedNote')}</Muted>
          </div>
          <HeadActions>
            {readOnly ? null : (
              <Button
                variant="quiet"
                onClick={() => void navigate(phone ? '/seller/menu' : '/seller')}
              >
                {phone ? t('home.makeMenu') : t('home.startFromHome')}
              </Button>
            )}
            {orders.length > 0 ? (
              <Button variant="quiet" aria-expanded={showAll} onClick={onToggleAll}>
                {showAll ? t('home.hideAll') : t('home.seeAll', { count: orders.length })}
              </Button>
            ) : null}
          </HeadActions>
        </HeadRow>
        {totals ? (
          <Totals
            totals={totals}
            lang={lang}
            doneCount={doneCount}
            unpaidCount={orders.length > 0 ? loose.length : null}
          />
        ) : null}
        {loose.map((order) => (
          <LooseOrder key={order.id} order={order} lang={lang} readOnly={readOnly} />
        ))}
      </Section>
    </>
  );
}

/** Asks for the earlier menus once, when a no-live-menu home is shown. */
export function useEarlierMenus(): void {
  const dispatch = useDispatch();
  const readOnly = useReadOnlyOrders();
  useEffect(() => {
    // A helper may not read earlier menus (the server says 403): there is nothing to ask.
    if (!readOnly) dispatch(pastRequested());
  }, [dispatch, readOnly]);
}

export function HomeMessage({ text }: Readonly<{ text: string }>) {
  return <Message role="status">{text}</Message>;
}

/** An unpaid order on Home: "Mark paid" asks first (plan 103 fix 7). */
function LooseOrder({
  order,
  lang,
  readOnly,
}: Readonly<{ order: Order; lang: Language; readOnly: boolean }>) {
  const { t } = useTranslation(SELLER_NS);
  const [asking, setAsking] = useState(false);
  return (
    <Loose>
      <span>
        <Icon name="coin" /> <code>{formatOrderCode(order.code)}</code>{' '}
        {t('home.unpaidLine', {
          name: order.firstName,
          amount: formatMoney(orderTotalCents(order), lang),
        })}
      </span>
      {readOnly ? null : (
        <Button onClick={() => setAsking(true)}>
          <Icon name="check" />
          {t('home.markPaid')}
        </Button>
      )}
      {asking ? <PaidSheet order={order} paid onClose={() => setAsking(false)} /> : null}
    </Loose>
  );
}
