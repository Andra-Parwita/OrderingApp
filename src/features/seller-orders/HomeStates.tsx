import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router';
import { styled } from 'styled-components';
import { fetchImages, fetchSettings } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { formatDay } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { summariseOrders, type PastWeekSummary, type WeekTotals } from '../../../shared/pastWeeks';
import { pickText } from '../../../shared/text';
import type { MenuView } from '../../../shared/menusContract';
import { Button, EmptyState, Icon, Pager, pageItems, type ChecklistStep } from '../../ui';
import { FeedbackHost } from './FeedbackHost';
import { SELLER_NS } from './i18n/register';
import { orderTotalCents, useLang } from './orderText';
import { isUnpaid, selectOrders, selectPast } from './sellerOrdersSelectors';
import { paidChangeRequested, pastRequested } from './sellerOrdersSlice';

// Home when no menu is live (handoff, Home): the first-run checklist, the "not published yet"
// line with the last menu, and the "Just finished" summary. Earlier menus come in pages of 20.

const Section = styled.section`
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.size.pagePadTablet}px;
`;
const Banner = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadTablet}px;
  background: ${({ theme }) => theme.c.tint};

  strong {
    font-weight: 700;
  }
  span {
    color: ${({ theme }) => theme.c.muted};
  }
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
const EarlierRow = styled(Link)`
  display: grid;
  grid-template-columns: 8rem minmax(0, 1fr) auto auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  min-height: ${({ theme }) => theme.size.tap + 8}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ theme }) => theme.c.text};
  text-decoration: none;
  font-variant-numeric: tabular-nums;

  strong {
    font-weight: 700;
  }
  span {
    color: ${({ theme }) => theme.c.muted};
  }
`;
const Message = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
  color: ${({ theme }) => theme.c.muted};
`;

/** First run: pictures, WhatsApp number, Make a menu, Publish. Each step opens where it is done today. */
export function SetupChecklist({ view }: Readonly<{ view: MenuView }>) {
  const { t } = useTranslation(SELLER_NS);
  const navigate = useNavigate();
  const [pictures, setPictures] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  useEffect(() => {
    let live = true;
    const slug = currentSellerSlug();
    void fetchImages(undefined, slug).then((result) => {
      if (live && result.ok) {
        const { railImage, railIcon, desktopBanner, phoneBanner } = result.data.images;
        setPictures([railImage, railIcon, desktopBanner, phoneBanner].some(Boolean));
      }
    });
    void fetchSettings(undefined, slug).then((result) => {
      if (live && result.ok) setWhatsapp(Boolean(result.data.settings.whatsappNumber));
    });
    return () => {
      live = false;
    };
  }, []);
  const steps = useMemo<Array<ChecklistStep>>(
    () => [
      { id: 'pictures', label: t('home.setup.pictures'), done: pictures },
      { id: 'whatsapp', label: t('home.setup.whatsapp'), done: whatsapp },
      {
        id: 'menu',
        label: t('home.setup.menu'),
        done: view.dishes.length > 0 || view.menu.wizardStep > 0,
      },
      { id: 'publish', label: t('home.setup.publish'), done: false },
    ],
    [t, pictures, whatsapp, view],
  );
  return (
    <Section>
      <EmptyState
        icon="list"
        title={t('home.setup.title')}
        why={t('home.setup.why')}
        steps={steps}
        action={
          <Actions>
            <Button variant="primary" onClick={() => void navigate('/seller/menu')}>
              {t('home.setup.action')}
            </Button>
            <Button onClick={() => void navigate('/seller/images')}>
              {t('home.setup.pictures')}
            </Button>
            <Button onClick={() => void navigate('/seller/settings')}>
              {t('home.setup.whatsapp')}
            </Button>
          </Actions>
        }
      />
    </Section>
  );
}

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

function EarlierMenus({
  weeks,
  lang,
}: Readonly<{ weeks: ReadonlyArray<PastWeekSummary>; lang: Language }>) {
  const { t } = useTranslation(SELLER_NS);
  const [page, setPage] = useState(0);
  return (
    <Section>
      <HeadRow>
        <h2>{t('home.earlier')}</h2>
        <Muted>{t('home.earlierHint')}</Muted>
      </HeadRow>
      {weeks.length === 0 ? <Muted>{t('home.noEarlier')}</Muted> : null}
      {pageItems(weeks, page).map((week) => (
        <EarlierRow key={week.id} to="/seller/past-weeks">
          <strong>{formatDay(week.cookingDate, lang)}</strong>
          <span>
            {t('home.earlierRow', { orders: week.totals.orders, dishes: week.totals.items.length })}
          </span>
          <strong>{formatMoney(week.totals.incomeCents, lang)}</strong>
          <span>
            {week.totals.unpaidCents > 0
              ? t('home.unpaidAmount', { amount: formatMoney(week.totals.unpaidCents, lang) })
              : t('home.allPaid')}
          </span>
        </EarlierRow>
      ))}
      <Pager page={page} total={weeks.length} onPage={setPage} />
    </Section>
  );
}

/** Menu not published: "Your menu for <date> isn't published yet", the last menu, earlier menus. */
export function NotPublishedHome({ view }: Readonly<{ view: MenuView }>) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const navigate = useNavigate();
  const past = useSelector(selectPast);
  const weeks = past.status === 'ready' ? past.weeks : [];
  const last = weeks[0];
  // A deleted menu (finished, never published): nothing to continue; the seller makes a new one.
  const deleted = view.menu.state === 'finished';
  return (
    <>
      <Banner>
        <div>
          {deleted ? (
            <strong>{t('home.noMenu')}</strong>
          ) : (
            <>
              <strong>
                {t('home.notPublished', { date: formatDay(view.menu.cookingDate, lang) })}
              </strong>{' '}
              <span>{t('home.stepOf', { step: view.menu.wizardStep + 1 })}</span>
            </>
          )}
        </div>
        <Button variant="primary" onClick={() => void navigate('/seller/menu')}>
          {deleted ? t('home.setup.action') : t('home.continue')}
          <Icon name="forward" />
        </Button>
      </Banner>
      {last ? (
        <Section>
          <Kicker>
            <Icon name="check" />
            {t('home.lastMenu')}
          </Kicker>
          <Big>{formatDay(last.cookingDate, lang)}</Big>
          <Totals totals={last.totals} lang={lang} doneCount={null} unpaidCount={null} />
        </Section>
      ) : null}
      <EarlierMenus weeks={weeks.slice(last ? 1 : 0)} lang={lang} />
    </>
  );
}

/** Cooking day over: "Just finished", unpaid loose ends, Earlier menus; "See all N orders" opens the list. */
export function FinishedHome({
  view,
  showAll,
  onToggleAll,
}: Readonly<{ view: MenuView; showAll: boolean; onToggleAll: () => void }>) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const navigate = useNavigate();
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
  const earlier = weeks.filter((week) => week !== mine);
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
          {orders.length > 0 ? (
            <Button variant="quiet" aria-expanded={showAll} onClick={onToggleAll}>
              {showAll ? t('home.hideAll') : t('home.seeAll', { count: orders.length })}
            </Button>
          ) : null}
        </HeadRow>
        {totals ? (
          <Totals totals={totals} lang={lang} doneCount={doneCount} unpaidCount={loose.length} />
        ) : null}
        {loose.map((order) => (
          <Loose key={order.id}>
            <span>
              <Icon name="coin" /> <code>{formatOrderCode(order.code)}</code>{' '}
              {t('home.unpaidLine', {
                name: order.firstName,
                amount: formatMoney(orderTotalCents(order), lang),
              })}
            </span>
            <Button onClick={() => dispatch(paidChangeRequested({ code: order.code, paid: true }))}>
              <Icon name="check" />
              {t('home.markPaid')}
            </Button>
          </Loose>
        ))}
        <Actions>
          <Button onClick={() => void navigate('/seller/menu')}>
            <Icon name="list" />
            {t('home.useDishes')}
          </Button>
        </Actions>
      </Section>
      <EarlierMenus weeks={earlier} lang={lang} />
    </>
  );
}

/** Asks for the earlier menus once, when a no-live-menu home is shown. */
export function useEarlierMenus(): void {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(pastRequested());
  }, [dispatch]);
}

export function HomeMessage({ text }: Readonly<{ text: string }>) {
  return <Message role="status">{text}</Message>;
}
