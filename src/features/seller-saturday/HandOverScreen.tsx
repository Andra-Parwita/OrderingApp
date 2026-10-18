import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { PickupPoint, SellerOrder } from '../../../shared/domain';
import type { DeliveryStep, MessagePlaceResponse } from '../../../shared/handoverContract';
import { setOrderStatus } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { ScanEntry, SCAN_NS } from '../../components/scan';
import { Button, Icon, Segmented, type SegmentedOption } from '../../ui';
import { DeliveryView } from './DeliveryRunScreen';
import { PickupView } from './PickupView';
import { SATURDAY_NS } from './i18n/register';
import { matches, Muted, Notice, useHandoverData, useLang } from './parts';
import { usePrivateHandover } from './usePrivateHandover';

export type HandoverViewName = 'all' | 'pickup' | 'delivery';

const VIEW_KEY = 'handover.filter';
/** The filter last chosen on this device (plan 104); storage can be blocked, so never trust it. */
function storedView(): HandoverViewName | null {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === 'all' || v === 'pickup' || v === 'delivery' ? v : null;
  } catch {
    return null;
  }
}

/** Menu orders first, then today's private ones by event time. */
export function mergeOrders(
  menu: ReadonlyArray<SellerOrder>,
  privateToday: ReadonlyArray<SellerOrder>,
  fulfilment: SellerOrder['fulfilment'],
): ReadonlyArray<SellerOrder> {
  const mine = privateToday
    .filter((o) => o.fulfilment === fulfilment)
    .sort((a, b) =>
      (a.private?.eventTime ?? '99:99').localeCompare(b.private?.eventTime ?? '99:99'),
    );
  return [...menu.filter((o) => o.fulfilment === fulfilment), ...mine];
}

const Page = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100%;
`;
const Top = styled.div<{ $phone: boolean }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg}
    ${({ theme, $phone }) => ($phone ? theme.size.pagePadPhone : theme.size.pagePadTablet)}px
    ${({ theme }) => theme.spacing.md};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Title = styled.h1<{ $phone: boolean }>`
  margin: 0;
  font-size: ${({ $phone }) => ($phone ? '1.625rem' : '1.75rem')};
`;
const Search = styled.label<{ $phone: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: ${({ $phone }) => ($phone ? '0' : '16rem')};
  flex: ${({ $phone }) => ($phone ? '1 1 100%' : '0 1 auto')};
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  color: ${({ theme }) => theme.c.muted};

  input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: ${({ theme }) => theme.c.text};
    font: inherit;
  }
  input:focus-visible {
    outline: none;
  }
  &:focus-within {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.fill};
    outline-offset: 0.125rem;
  }
`;
const Bar = styled.div<{ $phone: boolean }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md}
    ${({ theme, $phone }) => ($phone ? theme.size.pagePadPhone : theme.size.pagePadTablet)}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Body = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`;
const Section = styled.section`
  display: flex;
  flex-direction: column;
  h2 {
    margin: 0;
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadTablet}px 0;
    font-size: 1rem;
  }
`;
const DeliverySection = Section;
const PickupSection = styled(Section)`
  flex: 1;
`;
const Pad = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.size.pagePadTablet}px;
`;

type Props = Readonly<{
  view?: HandoverViewName;
  /** Below 600 px: one place at a time, the saved delivery address (D-059), phone padding. */
  phone?: boolean;
  /** Phone only: the delivery address kept on this phone for an order (D-059). */
  addressOf?: (code: string) => string | undefined;
  /** A scanned order opens here (its page, with the hand-over button). */
  onOpenOrder?: (code: string) => void;
  /** Plan 081: a private order opens here (`/seller/private/<code>`). */
  onOpenPrivate?: (code: string) => void;
}>;

/** Pickup & delivery (plan 001 stage 9): tell customers, never collect for them (D-068). */
export function HandOverScreen({
  view: initial,
  phone = false,
  addressOf,
  onOpenOrder,
  onOpenPrivate,
}: Props) {
  const { t } = useTranslation(SATURDAY_NS);
  const { t: scan } = useTranslation(SCAN_NS);
  const lang = useLang();
  const { data, reload } = useHandoverData();
  const [view, setView] = useState<HandoverViewName>(initial ?? storedView() ?? 'all');
  const chooseView = useCallback((next: HandoverViewName) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* the filter just is not remembered */
    }
  }, []);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const ready = data.status === 'ready' ? data : null;
  // Plan 081: today's private orders join the menu's, never entering the menu's own list.
  const { orders: privateToday, reload: reloadPrivate } = usePrivateHandover(ready?.orders);
  const pickup = useMemo<ReadonlyArray<SellerOrder>>(
    () => mergeOrders(ready?.orders ?? [], privateToday, 'pickup'),
    [ready, privateToday],
  );
  const delivery = useMemo<ReadonlyArray<SellerOrder>>(
    () => mergeOrders(ready?.orders ?? [], privateToday, 'delivery'),
    [ready, privateToday],
  );
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const markPrivate = useCallback(
    (order: SellerOrder) => {
      setBusyCode(order.code);
      const to = order.fulfilment === 'delivery' ? 'delivered' : 'collected';
      void setOrderStatus(order.code, to, undefined, currentSellerSlug(), true).then((result) => {
        setBusyCode(null);
        if (result.ok) {
          setNote(t(`note.private.${to}`, { name: order.firstName }));
          reloadPrivate();
        } else setNote(t('common.actionFailed'));
      });
    },
    [reloadPrivate, t],
  );
  const live = (orders: ReadonlyArray<SellerOrder>) =>
    orders.filter((o) => o.status !== 'cancelled');
  const pickupShown = live(pickup).filter((o) => matches(o, query));
  const deliveryShown = live(delivery).filter((o) => matches(o, query));

  const collectedCount = pickup.filter((o) => o.status === 'collected').length;
  const deliveredCount = delivery.filter((o) => o.status === 'delivered').length;
  const options: ReadonlyArray<SegmentedOption<HandoverViewName>> = [
    { value: 'all', label: t('view.all') },
    {
      value: 'delivery',
      label: t('view.delivery', { count: live(delivery).length }),
    },
    {
      value: 'pickup',
      label: t('view.pickup', { count: live(pickup).length }),
    },
  ];

  const sent = useCallback(
    (result: MessagePlaceResponse, place: PickupPoint) => {
      setNote(
        result.message.type === 'ready_now'
          ? t('note.placeReady', { place: place.place, sent: result.sent, readied: result.readied })
          : t('note.placeSent', { place: place.place, sent: result.sent }),
      );
      void reload();
    },
    [reload, t],
  );
  const stepped = useCallback(
    (order: SellerOrder, step: DeliveryStep) => {
      setNote(t(`note.step.${step}`, { name: order.firstName }));
      void reload();
      if (order.private) reloadPrivate();
    },
    [reload, reloadPrivate, t],
  );

  // A scanned order opens on its own page when the route says how; else the list narrows to it.
  const openScanned = (code: string) => {
    if (onOpenPrivate && privateToday.some((o) => o.code === code)) return onOpenPrivate(code);
    if (onOpenOrder) return onOpenOrder(code);
    const found = [...(ready?.orders ?? []), ...privateToday].find((o) => o.code === code);
    if (found) setView(found.fulfilment);
    setQuery(code);
  };

  return (
    <Page>
      <Top $phone={phone}>
        <Title $phone={phone}>
          {ready?.date ? t('title', { date: ready.date }) : t('titleNoDate')}
        </Title>
        <Search $phone={phone}>
          <Icon name="list" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </Search>
        <ScanEntry
          find={(code) => [...(ready?.orders ?? []), ...privateToday].find((o) => o.code === code)}
          onOpen={openScanned}
        />
        <Muted>{scan('hint')}</Muted>
      </Top>
      <Bar $phone={phone}>
        <Segmented options={options} value={view} onChange={chooseView} label={t('viewLabel')} />
        <Muted>
          {view === 'all'
            ? `${t('summary.delivery', { delivered: deliveredCount })} · ${t('summary.pickup', { collected: collectedCount })}`
            : view === 'pickup'
              ? t('summary.pickup', { collected: collectedCount })
              : t('summary.delivery', { delivered: deliveredCount })}
        </Muted>
      </Bar>
      <Body>
        {data.status === 'loading' ? (
          <Pad>
            <Muted role="status">{t('common.loading')}</Muted>
          </Pad>
        ) : null}
        {data.status === 'error' ? (
          <Pad>
            <Notice $bad role="alert">
              {t('common.loadError')}
            </Notice>
            <div>
              <Button onClick={() => void reload()}>{t('common.retry')}</Button>
            </div>
          </Pad>
        ) : null}
        {note ? (
          <Pad>
            <Notice role="status">{note}</Notice>
          </Pad>
        ) : null}
        {ready && view !== 'pickup' ? (
          <DeliverySection>
            {view === 'all' ? (
              <h2>{t('view.delivery', { count: live(delivery).length })}</h2>
            ) : null}
            <DeliveryView
              orders={deliveryShown}
              messages={ready.messages}
              lang={lang}
              onDone={stepped}
              onOpenPrivate={onOpenPrivate}
              addressOf={phone ? addressOf : undefined}
            />
          </DeliverySection>
        ) : null}
        {ready && view !== 'delivery' ? (
          <PickupSection>
            {view === 'all' ? <h2>{t('view.pickup', { count: live(pickup).length })}</h2> : null}
            <PickupView
              places={ready.places}
              orders={pickupShown}
              messages={ready.messages}
              lang={lang}
              onSent={sent}
              single={phone}
              onOpenPrivate={onOpenPrivate}
              onMarkPrivate={markPrivate}
              busyCode={busyCode}
            />
          </PickupSection>
        ) : null}
      </Body>
    </Page>
  );
}
