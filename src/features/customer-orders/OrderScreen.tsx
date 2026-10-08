import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { CustomerOrder } from '../../../shared/domain';
import {
  formatCookingDate,
  formatCutoff,
  formatDayTime,
  formatWindow,
} from '../../../shared/dates';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { pickText } from '../../../shared/text';
import { markInboxSeen } from '../../api/device/myOrders';
import { buildWhatsAppText, whatsAppUrl } from '../../api/device/whatsapp';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { Button, ConfirmButton, Pill } from '../../ui';
import { inboxNewestFirst, inboxText, isFinal, orderTotalCents, timelineSteps } from './helpers';
import { ORDERS_NS } from './i18n/register';
import {
  Block,
  Muted,
  Page,
  ScreenBoundary,
  StateMessage,
  Strong,
  TopBar,
  VisuallyHidden,
  useLang,
} from './layout';
import { selectCancel, selectMenu, selectOrderPage } from './selectors';
import {
  cancelRequested,
  menuRequested,
  orderRefreshRequested,
  orderRequested,
  type FailureCode,
} from './slice';
import { toneOf } from './tone';

/** How often the open order page reloads. Replaced by push / live updates in phase 4-5. */
export const POLL_MS = 15_000;

const Code = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  text-align: center;
  font-size: ${({ theme }) => theme.type.size.xl};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  letter-spacing: ${({ theme }) => theme.spacing.xs};
`;

const Qr = styled.div`
  align-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(${({ theme }) => theme.minTapTarget} * 3);
  height: calc(${({ theme }) => theme.minTapTarget} * 3);
  background: ${({ theme }) => theme.colour.surface};
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.sm};
  text-align: center;
`;

const Centered = styled(Muted)`
  text-align: center;
`;

const Banner = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.status.ready.bg};
  color: ${({ theme }) => theme.status.ready.fg};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

const LockedBanner = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.status.ready.bg};
  color: ${({ theme }) => theme.status.ready.fg};
`;

const Alert = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.status.cancelled.bg};
  color: ${({ theme }) => theme.status.cancelled.fg};
`;

const Steps = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Step = styled.li<{ $state: 'done' | 'current' | 'todo' }>`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme, $state }) => ($state === 'todo' ? theme.colour.textMuted : theme.colour.text)};
  font-weight: ${({ theme, $state }) =>
    $state === 'current' ? theme.type.weight.strong : theme.type.weight.regular};
`;

const Mark = styled.span`
  width: ${({ theme }) => theme.spacing.lg};
  text-align: center;
`;

const Lines = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Line = styled.li`
  display: flex;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.xs} 0;
`;

const Total = styled(Line)`
  margin-top: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

const Events = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.type.size.sm};
`;

const EventTime = styled.span`
  display: block;
  color: ${({ theme }) => theme.colour.textMuted};
`;

function cancelErrorKey(code: FailureCode): string {
  switch (code) {
    case 'order_locked':
    case 'ordering_closed':
    case 'cutoff_passed':
      return `order.errors.${code}`;
    default:
      return 'order.errors.other';
  }
}

type BodyProps = Readonly<{
  order: CustomerOrder;
  onChange: (token: string) => void;
}>;

function OrderBody({ order, onChange }: BodyProps) {
  const { t, i18n } = useTranslation(ORDERS_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const menu = useSelector(selectMenu);
  const cancel = useSelector(selectCancel);

  const week = menu.status === 'ready' ? menu.data.week : undefined;
  const pickup = week?.pickupPoints[0];
  const dayText = week ? formatCookingDate(week.cookingDate, lang) : null;
  const whenText =
    dayText && pickup
      ? `${dayText}, ${formatWindow(pickup.window.start, pickup.window.end, lang)}`
      : dayText;
  const whatsappNumber = menu.status === 'ready' ? menu.data.kitchen.whatsappNumber : undefined;
  const kitchenName = menu.status === 'ready' ? menu.data.kitchen.name : null;
  // Unknown until the menu loads: the server still enforces the rule.
  const orderingOpen = menu.status === 'ready' ? menu.data.ordering.open : true;

  const waText = buildWhatsAppText(
    order,
    i18n.getFixedT(order.language, ORDERS_NS),
    order.fulfilment === 'pickup' && dayText && pickup
      ? `${dayText}, ${formatWindow(pickup.window.start, pickup.window.end, order.language)}`
      : null,
  );
  const openWhatsApp = useCallback(() => {
    window.open(whatsAppUrl(waText, whatsappNumber), '_blank', 'noopener,noreferrer');
  }, [waText, whatsappNumber]);

  const token = order.token;
  const change = useCallback(() => onChange(token), [onChange, token]);
  const doCancel = useCallback(() => dispatch(cancelRequested(token)), [dispatch, token]);

  const final = isFinal(order.status);
  const editableStatus = order.status === 'ordered' || order.status === 'confirmed';
  const canChange = !order.locked && editableStatus && orderingOpen;
  const how = order.fulfilment === 'delivery' ? t('order.delivery') : t('order.pickup');
  const place = order.fulfilment === 'pickup' ? pickup?.place : undefined;

  return (
    <>
      {order.status === 'ready_for_pickup' ? (
        <Block>
          <Banner role="status">
            {t('order.readyPickup', {
              when: [whenText, place].filter(Boolean).join(', '),
            }).trim()}
          </Banner>
        </Block>
      ) : order.status === 'out_for_delivery' ? (
        <Block>
          <Banner role="status">{t('order.outForDelivery')}</Banner>
        </Block>
      ) : order.status === 'cancelled' ? (
        <Block>
          <Alert role="status">{t('order.cancelled')}</Alert>
        </Block>
      ) : null}
      <Block>
        <Centered>
          {kitchenName ? `${kitchenName} · ` : ''}
          {t('order.yourNumber')}
        </Centered>
        <Code data-testid="order-code">{formatOrderCode(order.code)}</Code>
        <Qr>{t('order.qrLabel')}</Qr>
        <Centered>
          <Pill tone={toneOf(order.status)}>{t(`status.${order.status}`)}</Pill>
        </Centered>
      </Block>
      <Block>
        <Steps aria-label={t('timeline.label')} data-testid="timeline">
          {timelineSteps(order.status, order.fulfilment).map((step) => (
            <Step
              key={step.status}
              $state={step.state}
              aria-current={step.state === 'current' ? 'step' : undefined}
            >
              <Mark aria-hidden="true">
                {step.state === 'done' ? '✓' : step.state === 'current' ? '●' : '○'}
              </Mark>
              <span>
                {t(`status.${step.status}`)}
                {step.state === 'current' && !final ? ` (${t('timeline.now')})` : ''}
                {step.state === 'done' ? ` (${t('timeline.done')})` : ''}
              </span>
            </Step>
          ))}
        </Steps>
      </Block>
      <Block>
        <Lines>
          {order.lines.map((line) => (
            <Line key={line.itemId}>
              <span>
                {line.qty}× {pickText(line.name, lang)}
              </span>
              <Strong>{formatMoney(line.priceCents * line.qty, lang)}</Strong>
            </Line>
          ))}
          <Total>
            <span>{t('order.total')}</span>
            <span>{formatMoney(orderTotalCents(order), lang)}</span>
          </Total>
        </Lines>
        <Muted>
          <Strong>{how}</Strong>
          {[whenText, place].filter(Boolean).length > 0
            ? ` · ${[whenText, place].filter(Boolean).join(' · ')}`
            : ''}
        </Muted>
        {order.note ? <Muted>{t('order.note', { note: order.note })}</Muted> : null}
      </Block>
      <Block>
        {order.locked && !final ? (
          <LockedBanner role="status">{t('order.lockedBanner')}</LockedBanner>
        ) : null}
        {!order.locked && !final && canChange ? (
          <>
            <Button fullWidth onClick={change}>
              {t('order.change')}
            </Button>
            <ConfirmButton
              fullWidth
              label={t('order.cancel')}
              confirmLabel={t('order.cancelConfirm')}
              onConfirm={doCancel}
              disabled={cancel.status === 'submitting'}
            />
            {week ? (
              <Centered>
                {t('order.changeUntil', { when: formatCutoff(week.cutoffAt, lang) })}
              </Centered>
            ) : null}
          </>
        ) : null}
        {!order.locked && !final && !canChange ? (
          <Button fullWidth disabled>
            {t('order.closed')}
          </Button>
        ) : null}
        {cancel.status === 'failed' ? (
          <Alert role="alert">{t(cancelErrorKey(cancel.code))}</Alert>
        ) : null}
        <Button fullWidth onClick={openWhatsApp}>
          {t('order.whatsapp')}
        </Button>
      </Block>
      <Block>
        <Strong>{t('order.updates')}</Strong>
        {order.inbox.length === 0 ? (
          <Muted>{t('order.noUpdates')}</Muted>
        ) : (
          <Events data-testid="updates">
            {inboxNewestFirst(order.inbox).map((entry) => {
              const text = inboxText(entry);
              return (
                <li key={`${entry.at}-${entry.kind}-${entry.textKey ?? entry.status ?? ''}`}>
                  <EventTime>{formatDayTime(entry.at, lang)}</EventTime>
                  <span>
                    {text.kind === 'own'
                      ? text.text
                      : t(text.key, { minutes: text.minutes, defaultValue: t('inbox.other') })}
                  </span>
                </li>
              );
            })}
          </Events>
        )}
      </Block>
    </>
  );
}

type Props = Readonly<{
  /** The order's private token (from My orders, or the link the seller sent). */
  token: string;
  /** Back to My orders. */
  onBack: () => void;
  /** Open the basket in edit mode for this order. */
  onChange: (token: string) => void;
}>;

function OrderContent({ token, onBack, onChange }: Props) {
  const { t } = useTranslation(ORDERS_NS);
  const dispatch = useDispatch();
  const page = useSelector(selectOrderPage);
  const loadedOrder = page.status === 'ready' && page.order.token === token ? page.order : null;

  const load = useCallback(() => {
    dispatch(orderRequested(token));
    dispatch(menuRequested());
  }, [dispatch, token]);
  // Always reload on arrival: what My orders knew may be old. Later reloads come from the poll.
  useEffect(load, [load]);

  // Seen: viewing the order clears its dot on My orders.
  useEffect(() => {
    if (loadedOrder !== null) markInboxSeen(loadedOrder);
  }, [loadedOrder]);

  // Poll while the page is open; replaced by push / live updates in phase 4-5.
  useEffect(() => {
    const timer = window.setInterval(() => {
      dispatch(orderRefreshRequested(token));
      dispatch(menuRequested());
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [dispatch, token]);

  return (
    <Page>
      <TopBar>
        <VisuallyHidden as="h1">{t('order.title')}</VisuallyHidden>
        <Button variant="quiet" onClick={onBack}>
          ‹ {t('common.myOrders')}
        </Button>
        <LanguageSwitch />
      </TopBar>
      {loadedOrder !== null ? (
        <OrderBody order={loadedOrder} onChange={onChange} />
      ) : page.status === 'error' ? (
        <StateMessage alert text={t('order.loadError')} onRetry={load} />
      ) : (
        <StateMessage text={t('common.loading')} />
      )}
    </Page>
  );
}

export function OrderScreen(props: Props) {
  return (
    <ScreenBoundary>
      <OrderContent {...props} />
    </ScreenBoundary>
  );
}
