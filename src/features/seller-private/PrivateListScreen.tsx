import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { styled } from 'styled-components';
import { checkOnMapUrl } from '../../../shared/address';
import { formatCookingDate } from '../../../shared/dates';
import type { Language, SellerOrder } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { QuietMapLinks } from '../../components/QuietMapLinks';
import { isIphone } from '../../components/isIphone';
import { useMediaQuery } from '../../components/useMediaQuery';
import { Button, Icon, PageHeader, Pill, Segmented } from '../../ui';
import { PRIVATE_NS } from './i18n/register';
import {
  groupByDate,
  orderStillToPay,
  readableAddress,
  showsDayDirections,
  toneOf,
  totalCents,
  type DateGroup,
  type PrivateView,
} from './model';
import { Card, directionsHref, ErrorLine, Muted, Page, useLang } from './privateShared';
import {
  listClosed,
  listOpened,
  refreshRequested,
  viewChanged,
  type PrivateRootState,
} from './privateSlice';
import { usePrivatePolling } from './usePrivateDue';

// Plan 081: the Private page. One list grouped by date (Today, Tomorrow, later dates), Upcoming or
// Past (a cancelled order sits in Past). A tap opens the order. On its event day a delivery row has
// quiet Directions and Map links that open the phone's maps app.

const Top = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Help = styled.p`
  flex: 1 1 14rem;
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;
const GroupHead = styled.h2`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: ${({ theme }) => theme.spacing.md} 0 ${({ theme }) => theme.spacing.xs};
  font-size: 0.9375rem;

  span {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
    font-weight: 400;
  }
`;
const List = styled.ul`
  margin: 0;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  list-style: none;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf};
`;
const Item = styled.li`
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  &:last-child {
    border-bottom: 0;
  }
`;
const RowButton = styled.button`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  width: 100%;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: ${({ theme }) => theme.spacing.xs} 0;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  text-align: left;
  cursor: pointer;

  .l1 {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  }
  .time {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .total {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .l2 {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
  }
  .l3 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    margin-top: ${({ theme }) => theme.spacing.xs};
    font-size: 0.8125rem;
  }
  .due {
    color: ${({ theme }) => theme.c.warn};
    font-weight: 700;
  }
  .paid {
    color: ${({ theme }) => theme.c.muted};
  }
`;
const RowActions = styled.div`
  display: flex;
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

function summaryOf(order: SellerOrder, lang: Language): string {
  return order.lines.map((line) => `${String(line.qty)}× ${pickText(line.name, lang)}`).join(', ');
}

function OrderRow({
  order,
  today,
  lang,
  placeName,
  onOpen,
}: Readonly<{
  order: SellerOrder;
  today: string;
  lang: Language;
  placeName: string | undefined;
  onOpen: () => void;
}>) {
  const { t } = useTranslation(PRIVATE_NS);
  const still = orderStillToPay(order);
  const cancelled = order.status === 'cancelled';
  const address = readableAddress(order);
  const dayOf = showsDayDirections(order, today);
  const showMap =
    !dayOf && address !== null && order.fulfilment === 'delivery' && order.status !== 'cancelled';
  return (
    <Item>
      <RowButton type="button" onClick={onOpen}>
        <span className="l1">
          <span className="time">{order.private?.eventTime ?? '–'}</span>
          <span className="name">{order.firstName}</span>
          <span className="total">{formatMoney(totalCents(order), lang)}</span>
        </span>
        <span className="l2">
          {summaryOf(order, lang)} · {t(order.fulfilment)}
          {order.fulfilment === 'pickup' && placeName ? ` · ${placeName}` : ''}
        </span>
        <span className="l3">
          <Pill tone={toneOf(order.status)}>{t(`status.${order.status}`)}</Pill>
          {cancelled ? null : still > 0 ? (
            <span className="due">{t('due', { amount: formatMoney(still, lang) })}</span>
          ) : (
            <span className="paid">{t('paidFull')}</span>
          )}
        </span>
      </RowButton>
      {(dayOf || showMap) && address ? (
        <RowActions>
          <QuietMapLinks
            directions={
              dayOf
                ? {
                    href: directionsHref(address),
                    label: t('directions'),
                    aria: t('directionsFor', { name: order.firstName }),
                  }
                : undefined
            }
            map={{
              href: checkOnMapUrl(address, isIphone()),
              label: t('map'),
              aria: `${t('viewOnMap')}: ${order.firstName}`,
            }}
          />
        </RowActions>
      ) : null}
    </Item>
  );
}

function Group({
  group,
  today,
  lang,
  placeNames,
  onOpen,
}: Readonly<{
  group: DateGroup;
  today: string;
  lang: Language;
  placeNames: PlaceNames;
  onOpen: (code: string) => void;
}>) {
  const { t } = useTranslation(PRIVATE_NS);
  const dateText = formatCookingDate(group.date, lang);
  return (
    <section aria-label={group.label ? `${t(group.label)} ${dateText}` : dateText}>
      <GroupHead>
        {group.label ? t(group.label) : dateText}
        {group.label ? <span>{dateText}</span> : null}
      </GroupHead>
      <List>
        {group.orders.map((order) => (
          <OrderRow
            key={order.code}
            order={order}
            today={today}
            lang={lang}
            placeName={order.pickupPlaceId ? placeNames[order.pickupPlaceId] : undefined}
            onOpen={() => onOpen(order.code)}
          />
        ))}
      </List>
    </section>
  );
}

/** Pickup place names by id (the app gives them; this feature does not read the menu's data). */
export type PlaceNames = Readonly<Record<string, string>>;

export function PrivateListScreen({
  canEdit,
  places = {},
}: Readonly<{ canEdit: boolean; places?: PlaceNames }>) {
  const { t } = useTranslation(PRIVATE_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const phone = useMediaQuery('(max-width: 37.4375rem)');
  const { load, view, orders, today } = useSelector(
    (state: PrivateRootState) => state.sellerPrivate,
  );
  usePrivatePolling();
  useEffect(() => {
    dispatch(listOpened(view));
    return () => {
      dispatch(listClosed());
    };
    // Opens once; the view switch has its own action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const kitchenToday = today ?? '';
  const groups = today ? groupByDate(orders, today, view) : [];
  const options: ReadonlyArray<{ value: PrivateView; label: string }> = [
    { value: 'upcoming', label: t('upcoming') },
    { value: 'past', label: t('past') },
  ];
  return (
    <>
      <PageHeader
        title={t('title')}
        {...(phone
          ? { backLabel: t('backToMore'), onBack: () => void navigate('/seller/more') }
          : {})}
      />
      <Page>
        <Top>
          <Help>{canEdit ? t('help') : t('helpTeam')}</Help>
          {canEdit ? (
            <Button variant="primary" onClick={() => void navigate('/seller/private/new')}>
              <Icon name="plus" />
              {t('newOrder')}
            </Button>
          ) : null}
        </Top>
        <div>
          <Segmented
            options={options}
            value={view}
            onChange={(next) => dispatch(viewChanged(next))}
            label={t('filter')}
          />
        </div>
        {load === 'loading' && orders.length === 0 ? (
          <Muted role="status">{t('loading')}</Muted>
        ) : null}
        {load === 'error' ? (
          <Card>
            <ErrorLine role="alert">{t('loadError')}</ErrorLine>
            <div>
              <Button onClick={() => dispatch(refreshRequested())}>{t('retry')}</Button>
            </div>
          </Card>
        ) : null}
        {load === 'ready' && groups.length === 0 ? (
          <Muted role="status">{view === 'upcoming' ? t('emptyUpcoming') : t('emptyPast')}</Muted>
        ) : null}
        {groups.map((group) => (
          <Group
            key={group.date}
            group={group}
            today={kitchenToday}
            lang={lang}
            placeNames={places}
            onOpen={(code) => void navigate(`/seller/private/${code}`)}
          />
        ))}
      </Page>
    </>
  );
}
