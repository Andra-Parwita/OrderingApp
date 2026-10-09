import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { CustomerOrder, Language, OrderStatus } from '../../../shared/domain';
import { formatCutoff, formatDayTime } from '../../../shared/dates';
import type { MenuResponse } from '../../../shared/menuContract';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { pickText } from '../../../shared/text';
import { PageTopBar } from '../../components/CustomerPage';
import {
  InstallOverlay,
  NotifyCard,
  NotifyLine,
  useOrderInstall,
  type InstallOverride,
} from '../../components/install';
import { useModalFocus } from '../../ui/patterns/modal';
import { inboxNewestFirst, isFinal, orderTotalCents, timelineSteps } from './helpers';
import { ORDERS_NS } from './i18n/register';
import { VisuallyHidden } from './layout';
import { OrderIcon, type OrderIconName } from './orderIcons';
import { orderInfo, type OrderInfo } from './orderInfo';
import {
  Actions,
  Bold,
  Chip,
  ChipRow,
  type ChipTone,
  Hint,
  MainButton,
  Muted,
  OrderHead,
  OutlineButton,
  Rows,
  Section,
  SectionLabel,
  TextLink,
  Updates,
} from './orderParts';

// The order page (spec §4.4): header, status, progress, the seller's updates, the notifications
// line, the order details and Change / Cancel. Presentational: OrderScreen feeds it from the
// store, the fixtures page feeds it from fixtures.json.

const Page = styled.div`
  padding-bottom: calc(
    var(--customer-tabbar-height, 0rem) + var(--sab) + ${({ theme }) => theme.spacing.xl}
  );
`;

// ---- Banners ----

const Banner = styled.section<{ $tone: 'conf' | 'ready' | 'danger' }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0 ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme, $tone }) =>
    $tone === 'conf'
      ? `${theme.c.conf}1F`
      : $tone === 'ready'
        ? `${theme.c.ready}1F`
        : `${theme.c.danger}1F`};
  color: ${({ theme, $tone }) =>
    $tone === 'conf' ? theme.c.conf : $tone === 'ready' ? theme.c.ready : theme.c.danger};
`;
const BannerHead = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};

  svg {
    margin-top: 0.2rem;
  }
  h2 {
    margin: 0;
    font-size: ${({ theme }) => theme.type.size.xl};
    line-height: 1.2;
    font-weight: 700;
    color: ${({ theme }) => theme.c.text};
  }
`;
const BannerLine = styled.p`
  margin: 0 0 0 2rem;
  font-size: ${({ theme }) => theme.type.size.md};
`;
const BannerLink = styled.a`
  margin-left: 2rem;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  min-height: ${({ theme }) => theme.size.tap}px;
  color: inherit;
  font-weight: 700;
  text-decoration: underline;
`;
const Ask = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.c.text};
  font-weight: 700;
`;

const Alert = styled.p`
  margin: 0 ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.warnTint};
  color: ${({ theme }) => theme.c.text};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Note = styled.p`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf2};
  color: ${({ theme }) => theme.c.text};
  font-size: ${({ theme }) => theme.type.size.md};

  svg {
    margin-top: 0.1rem;
    color: ${({ theme }) => theme.c.muted};
  }
`;

// ---- Progress ----

const Steps = styled.ol`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${({ theme }) => theme.spacing.xs};
  margin: 0;
  padding: 0 ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.sm};
  list-style: none;
`;
const Step = styled.li<{ $on: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme, $on }) => ($on ? theme.c.text : theme.c.muted)};

  &::before {
    content: '';
    height: 0.25rem;
    border-radius: 0.125rem;
    background: ${({ theme, $on }) => ($on ? theme.c.conf : theme.c.line)};
  }
`;

// ---- Cancel sheet ----

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: 0 ${({ theme }) => theme.spacing.md}
    calc(${({ theme }) => theme.spacing.md} + var(--sab));
  background: ${({ theme }) => theme.colour.scrim};
`;
const SheetBox = styled.div`
  width: 100%;
  max-width: 30rem;
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  overflow: hidden;

  &:focus {
    outline: none;
  }
`;
const SheetHead = styled.div`
  padding: ${({ theme }) => theme.spacing.lg};
  text-align: center;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  h2 {
    margin: 0 0 ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.type.size.base};
    font-weight: 700;
  }
  p {
    margin: 0;
    color: ${({ theme }) => theme.c.muted};
    font-size: ${({ theme }) => theme.type.size.md};
  }
`;
const SheetAction = styled.button<{ $danger?: boolean }>`
  display: block;
  width: 100%;
  min-height: 3.25rem;
  border: 0;
  background: transparent;
  color: ${({ theme, $danger }) => ($danger ? theme.c.danger : theme.c.text)};
  font: inherit;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
  }
`;

function CancelSheet({
  code,
  cook,
  busy,
  onConfirm,
  onKeep,
}: Readonly<{
  code: string;
  cook: string;
  busy: boolean;
  onConfirm: () => void;
  onKeep: () => void;
}>) {
  const { t } = useTranslation(ORDERS_NS);
  const titleId = useId();
  const { box, onKeyDown } = useModalFocus<HTMLDivElement>(onKeep);
  return (
    <Overlay onClick={onKeep}>
      <SheetBox
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={(event) => event.stopPropagation()}
      >
        <SheetHead>
          <h2 id={titleId}>{t('order.cancelTitle', { code: formatOrderCode(code) })}</h2>
          <p>{t('order.cancelBody', { cook })}</p>
        </SheetHead>
        <SheetAction $danger type="button" onClick={onConfirm} disabled={busy}>
          {t('order.cancelYes')}
        </SheetAction>
      </SheetBox>
      <SheetBox as="div">
        <SheetAction type="button" onClick={onKeep} data-autofocus>
          {t('order.cancelKeep')}
        </SheetAction>
      </SheetBox>
    </Overlay>
  );
}

// ---- The page ----

function statusChip(status: OrderStatus): { tone: ChipTone; icon: OrderIconName } {
  switch (status) {
    case 'ordered':
      return { tone: 'muted', icon: 'clock' };
    case 'confirmed':
    case 'collected':
    case 'delivered':
      return { tone: 'conf', icon: 'check' };
    case 'ready_for_pickup':
      return { tone: 'conf', icon: 'checkCircle' };
    case 'out_for_delivery':
      return { tone: 'ready', icon: 'truck' };
    case 'cancelled':
      return { tone: 'danger', icon: 'ban' };
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

/** Out for delivery, then "Arriving soon" once the seller said so, then Delivered. */
function deliveryStep(order: CustomerOrder): 'out' | 'arriving' | 'delivered' | null {
  if (order.fulfilment !== 'delivery') return null;
  if (order.status === 'delivered') return 'delivered';
  if (order.status !== 'out_for_delivery') return null;
  const latest = inboxNewestFirst(order.inbox)[0];
  return latest?.textKey === 'arrivingSoon' || latest?.textKey === 'arrivingIn'
    ? 'arriving'
    : 'out';
}

export type OrderPageViewProps = Readonly<{
  order: CustomerOrder;
  /** The kitchen's menu once loaded; the page works without it. */
  menu: MenuResponse | undefined;
  lang: Language;
  /** Not in the customer contract yet: the Paid / Not paid pill shows only when it is known. */
  paid?: boolean;
  cancelOpen: boolean;
  cancelling: boolean;
  collecting: boolean;
  /** Plain-words error to show under the buttons, if any. */
  cancelError?: string;
  collectError?: boolean;
  onBack: () => void;
  onShowQr: () => void;
  onChange: () => void;
  onAskCancel: () => void;
  onKeepOrder: () => void;
  onCancel: () => void;
  onCollect: () => void;
  onWhatsApp: () => void;
  /** Fixtures and tests: fix what the install and notification flow detects. */
  install?: InstallOverride;
}>;

export function OrderPageView(props: OrderPageViewProps) {
  const { order, menu, lang, paid } = props;
  const { t } = useTranslation(ORDERS_NS);
  const install = useOrderInstall(order.token, props.install);
  const info = orderInfo(order, menu, lang);
  const final = isFinal(order.status);
  const orderingOpen = menu?.ordering.open ?? true;
  const canChange = !order.locked && !final && orderingOpen;
  const cutoffAt = menu?.week.cutoffAt;
  const step = deliveryStep(order);
  const readyPickup = order.fulfilment === 'pickup' && order.status === 'ready_for_pickup';
  const chip = statusChip(order.status);
  const steps = order.status === 'cancelled' ? null : timelineSteps(order.status, order.fulfilment);
  const eyebrow = [info.kitchenName, info.dateText].filter(Boolean).join(' · ');

  return (
    <Page>
      <PageTopBar
        kitchenName={info.kitchenName}
        logoSrc={info.logoSrc}
        backLabel={t('common.myOrders')}
        onBack={props.onBack}
      />
      <VisuallyHidden as="h1">{t('order.title')}</VisuallyHidden>
      <OrderHead eyebrow={eyebrow} code={order.code} onShowQr={props.onShowQr} />

      {order.status === 'cancelled' ? (
        <Banner $tone="danger" role="status">
          <BannerHead>
            <OrderIcon name="ban" />
            <h2>{t('order.cancelled')}</h2>
          </BannerHead>
        </Banner>
      ) : null}
      {readyPickup ? (
        <ReadyBanner {...props} info={info} />
      ) : step !== null ? (
        <DeliveryBanner step={step} info={info} />
      ) : null}

      {!readyPickup && step === null ? (
        <ChipRow>
          <Chip tone={chip.tone} icon={chip.icon}>
            {t(`status.${order.status}`)}
            {order.collectedAt ? ` · ${formatDayTime(order.collectedAt, lang)}` : ''}
          </Chip>
          {order.locked && !final ? (
            <Chip tone="muted" icon="lock">
              {t('list.locked')}
            </Chip>
          ) : null}
          {paid === undefined ? null : paid ? (
            <Chip tone="conf" icon="check">
              {t('order.paid')}
            </Chip>
          ) : (
            <Chip tone="warn" icon="warning">
              {t('order.notPaid')}
            </Chip>
          )}
        </ChipRow>
      ) : null}

      {steps ? (
        <Steps aria-label={t('timeline.label')} data-testid="timeline">
          {steps.map((entry) => (
            <Step
              key={entry.status}
              $on={entry.state !== 'todo'}
              aria-current={entry.state === 'current' ? 'step' : undefined}
            >
              {t(`order.step.${entry.status}`)}
            </Step>
          ))}
        </Steps>
      ) : null}

      {final ? null : <NotifyCard controller={install} code={formatOrderCode(order.code)} />}
      <Updates inbox={order.inbox} lang={lang} place={info.place} cook={info.cook} />
      {final ? null : <NotifyLine controller={install} />}
      <Details {...props} info={info} />

      <Actions>
        {canChange ? (
          <>
            <TwoUp>
              <OutlineButton type="button" onClick={props.onChange}>
                {t('order.change')}
              </OutlineButton>
              <OutlineButton type="button" $danger onClick={props.onAskCancel}>
                {t('order.cancel')}
              </OutlineButton>
            </TwoUp>
            {cutoffAt ? (
              <Hint>{t('order.changeUntil', { when: formatCutoff(cutoffAt, lang) })}</Hint>
            ) : null}
          </>
        ) : null}
        {order.locked && !final ? (
          <Note role="status">
            <OrderIcon name="lock" />
            <span>{t('order.lockedBanner')}</span>
          </Note>
        ) : null}
        {!order.locked && !final && !canChange ? <Hint>{t('order.closed')}</Hint> : null}
        {props.cancelError ? <Alert role="alert">{props.cancelError}</Alert> : null}
        <OutlineButton type="button" onClick={props.onWhatsApp}>
          <OrderIcon name="chat" />
          {t('order.whatsapp', { cook: info.cook })}
        </OutlineButton>
      </Actions>

      {props.cancelOpen ? (
        <CancelSheet
          code={order.code}
          cook={info.cook}
          busy={props.cancelling}
          onConfirm={props.onCancel}
          onKeep={props.onKeepOrder}
        />
      ) : null}
      <InstallOverlay
        controller={install}
        kitchenName={info.kitchenName}
        iconSrc={menu?.kitchen.images?.railIcon}
        code={formatOrderCode(order.code)}
        backLabel={t('order.titleShort')}
      />
    </Page>
  );
}

const TwoUp = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};
`;

function ReadyBanner(props: OrderPageViewProps & Readonly<{ info: OrderInfo }>) {
  const { info } = props;
  const { t } = useTranslation(ORDERS_NS);
  const [asking, setAsking] = useState(false);
  const line = [info.whenText, info.directions].filter(Boolean).join(' · ');
  return (
    <Banner $tone="conf" role="status" data-testid="ready-banner">
      <BannerHead>
        <OrderIcon name="checkCircle" size="1.75rem" />
        <h2>
          {info.place ? t('order.readyTitle', { place: info.place }) : t('order.readyNoPlace')}
        </h2>
      </BannerHead>
      {line ? <BannerLine>{line}</BannerLine> : null}
      {info.place ? (
        <BannerLink
          href={`https://maps.google.com/?q=${encodeURIComponent(info.place)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('order.directionsTo', { place: info.place })}
        >
          {t('order.directions')}
        </BannerLink>
      ) : null}
      {asking ? (
        <Ask role="group" aria-label={t('order.collectAsk')}>
          <span>{t('order.collectAsk')}</span>
          <MainButton
            type="button"
            disabled={props.collecting}
            onClick={() => {
              setAsking(false);
              props.onCollect();
            }}
          >
            {t('order.collectYes')}
          </MainButton>
          <TextLink type="button" onClick={() => setAsking(false)}>
            {t('order.collectNo')}
          </TextLink>
        </Ask>
      ) : (
        <MainButton type="button" disabled={props.collecting} onClick={() => setAsking(true)}>
          {t('order.collect')}
        </MainButton>
      )}
      {props.collectError ? <Alert role="alert">{t('order.collectError')}</Alert> : null}
    </Banner>
  );
}

function DeliveryBanner({
  step,
  info,
}: Readonly<{ step: 'out' | 'arriving' | 'delivered'; info: OrderInfo }>) {
  const { t } = useTranslation(ORDERS_NS);
  return (
    <Banner $tone="ready" role="status" data-testid="delivery-banner">
      <BannerHead>
        <OrderIcon name={step === 'delivered' ? 'checkCircle' : 'truck'} size="1.75rem" />
        <h2>{t(`order.delivery_${step}`)}</h2>
      </BannerHead>
      {info.whenText ? <BannerLine>{info.dateText}</BannerLine> : null}
    </Banner>
  );
}

export function Details({
  order,
  lang,
  paid,
  info,
}: Readonly<{ order: CustomerOrder; lang: Language; paid?: boolean; info: OrderInfo }>) {
  const { t } = useTranslation(ORDERS_NS);
  const delivery = order.fulfilment === 'delivery';
  const place = [info.place, info.windowText].filter(Boolean).join(' · ');
  return (
    <Section>
      <SectionLabel>{t('order.yourOrder')}</SectionLabel>
      <Rows>
        {order.lines.map((line) => (
          <Row key={line.itemId}>
            <dt>
              {line.qty} × {pickText(line.name, lang)}
            </dt>
            <dd>{formatMoney(line.priceCents * line.qty, lang)}</dd>
          </Row>
        ))}
        <Row>
          <dt>
            <Bold>
              {paid === true ? t('order.totalPaid') : t('order.totalPay', { cook: info.cook })}
            </Bold>
          </dt>
          <dd>
            <Bold>{formatMoney(orderTotalCents(order), lang)}</Bold>
          </dd>
        </Row>
        {delivery || place ? (
          <Row>
            <dt>
              <Muted>{delivery ? t('order.delivery') : t('order.pickup')}</Muted>
            </dt>
            <dd>{delivery ? (info.dateText ?? '') : place}</dd>
          </Row>
        ) : null}
        <Row>
          <dt>
            <Muted>{t('order.name')}</Muted>
          </dt>
          <dd>{order.firstName}</dd>
        </Row>
        {order.note ? (
          <Row>
            <dt>
              <Muted>{t('order.noteLabel')}</Muted>
            </dt>
            <dd>{order.note}</dd>
          </Row>
        ) : null}
      </Rows>
    </Section>
  );
}

/** A `<dl>` row: the grid is on the list, so the row itself adds no box. */
const Row = styled.div`
  display: contents;
`;
