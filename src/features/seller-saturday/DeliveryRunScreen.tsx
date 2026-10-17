import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, SellerOrder } from '../../../shared/domain';
import {
  DELIVERY_STEPS,
  type DeliveryStep,
  type MessageLogEntry,
} from '../../../shared/handoverContract';
import {
  addressLine,
  checkOnMapUrl,
  directionsUrl,
  textDirectionsUrl,
  textMapUrl,
} from '../../../shared/address';
import { formatOrderCode } from '../../../shared/orderCode';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { sendDeliveryStep } from '../../api/handover';
import { Icon, WarningDialog } from '../../ui';
import { SATURDAY_NS } from './i18n/register';
import { PrivateTag } from '../../components/PrivateTag';
import { QuietMapLinks } from '../../components/QuietMapLinks';
import { isIphone } from '../../components/isIphone';
import { privateAddress } from './PrivateRow';
import {
  isClosed,
  itemsShort,
  money,
  Mono,
  Muted,
  Notice,
  OrderRowRoot,
  PackedTag,
  StatusMark,
  totalCents,
} from './parts';

/** Minutes offered for "Arriving soon"; 0 sends it without a time. */
const ARRIVING_MINUTES: ReadonlyArray<number> = [0, 5, 10, 15, 20];
const KNOWN = ['step_out_of_order', 'step_repeated', 'order_closed', 'not_delivery'] as const;

const List = styled.ul`
  margin: 0;
  padding: 0;
`;
const Steps = styled.div`
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;
// One bar of segments that size to their label: the ticked step stays on one line.
const StepBar = styled.div`
  display: flex;
  align-self: stretch;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  overflow: hidden;
`;
const StepButton = styled.button<{ $current: boolean }>`
  display: inline-flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.xs};
  border: 0;
  border-right: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  background: ${({ theme, $current }) => ($current ? theme.c.fill : 'transparent')};
  color: ${({ theme, $current }) => ($current ? theme.c.on : theme.c.text)};
  font: inherit;
  font-size: 0.8125rem;
  font-weight: ${({ $current }) => ($current ? 600 : 400)};
  white-space: nowrap;
  cursor: pointer;

  &:last-child {
    border-right: 0;
  }
  svg {
    width: 0.875rem;
    height: 0.875rem;
  }
  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
`;
const Minutes = styled.label`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;

  select {
    min-height: ${({ theme }) => theme.minTapTarget};
    padding: 0 ${({ theme }) => theme.spacing.sm};
    border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
    border-radius: ${({ theme }) => theme.size.radiusControl}px;
    background: ${({ theme }) => theme.c.surf};
    color: ${({ theme }) => theme.c.text};
    font: inherit;
  }
`;
const Right = styled.span`
  grid-column: 2;
  grid-row: 1;
  font-weight: 600;
`;
const Sub = styled.span`
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: 0.875rem;
`;
const Name = styled.b`
  margin-left: ${({ theme }) => theme.spacing.sm};
`;
const Top = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const OpenLink = styled.button`
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
`;

/** The step an order is at: the latest delivery message sent for it, else what its status says. */
export function currentStep(
  order: SellerOrder,
  messages: ReadonlyArray<MessageLogEntry>,
): DeliveryStep | null {
  if (order.status === 'delivered') return 'delivered';
  const logged = messages.find(
    (m) =>
      m.group === `order:${order.code}` &&
      (DELIVERY_STEPS as ReadonlyArray<string>).includes(m.type),
  );
  if (logged) return logged.type as DeliveryStep;
  return order.status === 'out_for_delivery' ? 'out_for_delivery' : null;
}

type Pending = Readonly<{ order: SellerOrder; step: DeliveryStep; minutes: number; code: string }>;

type Props = Readonly<{
  /** Delivery orders after the search. */
  orders: ReadonlyArray<SellerOrder>;
  messages: ReadonlyArray<MessageLogEntry>;
  lang: Language;
  /** After a step went through: reload and say what happened. */
  onDone: (order: SellerOrder, step: DeliveryStep) => void;
  /** Phone only: the delivery address saved on this phone (D-059), given by the app; never on a tablet. */
  addressOf?: (code: string) => string | undefined;
  /** Plan 081: a private order in `orders` opens its page on a tap of its name. */
  onOpenPrivate?: (code: string) => void;
}>;

/** Delivery: per order Out for delivery, then Arriving soon (minutes), then Delivered. */
export function DeliveryView({ orders, messages, lang, onDone, addressOf, onOpenPrivate }: Props) {
  const { t } = useTranslation(SATURDAY_NS);
  const slug = currentSellerSlug();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [warn, setWarn] = useState<Readonly<{ pending: Pending; code: string }> | null>(null);

  const run = useCallback(
    async (pending: Pending, force: boolean) => {
      setBusy(true);
      setFailed(false);
      const { order, step, minutes } = pending;
      const result = await sendDeliveryStep(
        order.code,
        {
          step,
          ...(step === 'arriving_soon' && minutes > 0 ? { minutes } : {}),
          ...(force ? { force } : {}),
        },
        undefined,
        slug,
      );
      setBusy(false);
      if (result.ok) {
        setWarn(null);
        onDone(order, step);
        return;
      }
      if (result.status === 409 && result.warning) {
        const code = result.warning.code;
        setWarn({
          pending,
          code: (KNOWN as ReadonlyArray<string>).includes(code) ? code : 'other',
        });
        return;
      }
      setWarn(null);
      setFailed(true);
    },
    [slug, onDone],
  );

  if (orders.length === 0) return <Muted role="status">{t('delivery.empty')}</Muted>;

  return (
    <>
      {failed ? (
        <Notice $bad role="alert">
          {t('common.actionFailed')}
        </Notice>
      ) : null}
      <List>
        {orders.map((order) => (
          <DeliveryRow
            key={order.code}
            order={order}
            step={currentStep(order, messages)}
            lang={lang}
            busy={busy}
            address={order.private ? undefined : addressOf?.(order.code)}
            onOpen={onOpenPrivate}
            onStep={(step, minutes) =>
              void run({ order, step, minutes, code: formatOrderCode(order.code) }, false)
            }
          />
        ))}
      </List>
      {warn ? (
        <WarningDialog
          title={t(`warn.${warn.code}.title`)}
          cancelLabel={t('warn.cancel')}
          continueLabel={t('delivery.sendAnyway')}
          onCancel={() => setWarn(null)}
          onContinue={() => void run(warn.pending, true)}
        >
          {t(`warn.${warn.code}.body`, {
            name: warn.pending.order.firstName,
            code: warn.pending.code,
          })}
        </WarningDialog>
      ) : null}
    </>
  );
}

type RowProps = Readonly<{
  order: SellerOrder;
  step: DeliveryStep | null;
  lang: Language;
  busy: boolean;
  /** A menu order's address kept on this phone (free text). */
  address?: string;
  onOpen?: (code: string) => void;
  onStep: (step: DeliveryStep, minutes: number) => void;
}>;

function DeliveryRow({ order, step, lang, busy, address, onOpen, onStep }: RowProps) {
  const { t } = useTranslation(SATURDAY_NS);
  const [minutes, setMinutes] = useState(10);
  const code = formatOrderCode(order.code);
  const closed = isClosed(order.status);
  const isPrivate = order.private !== undefined;
  const held = isPrivate ? privateAddress(order) : null;
  const apple = isIphone();
  const time = order.private?.eventTime;
  const shown = held ? addressLine(held) : address;
  const links = held
    ? { directions: directionsUrl(held, apple), map: checkOnMapUrl(held, apple) }
    : address
      ? { directions: textDirectionsUrl(address, apple), map: textMapUrl(address, apple) }
      : null;
  const right = isPrivate
    ? money(totalCents(order), lang)
    : order.paid
      ? t('common.paid')
      : t('common.notPaid', { amount: money(totalCents(order), lang) });
  return (
    <OrderRowRoot
      $dim={closed}
      aria-label={t('delivery.rowLabel', { code, name: order.firstName })}
    >
      {isPrivate ? (
        <Top>
          {time ? <b>{time}</b> : null}
          {onOpen ? (
            <OpenLink
              type="button"
              aria-label={t('private.open', { name: order.firstName })}
              onClick={() => onOpen(order.code)}
            >
              {order.firstName}
            </OpenLink>
          ) : (
            <b>{order.firstName}</b>
          )}
          <Mono>{code}</Mono>
          <PrivateTag label={t('private.tag')} />
        </Top>
      ) : (
        <span>
          <Mono>{code}</Mono>
          <Name>{order.firstName}</Name>
        </span>
      )}
      <Right>{right}</Right>
      <Sub>
        <span>{itemsShort(order.lines, lang)}</span>
        <StatusMark status={order.status} />
        {order.packed === true ? <PackedTag>{t('common.packed')}</PackedTag> : null}
      </Sub>
      {shown ? (
        <Sub>
          <b>{shown}</b>
        </Sub>
      ) : isPrivate ? (
        <Sub>
          <span>{t('private.noAddress')}</span>
        </Sub>
      ) : null}
      {held?.notes ? (
        <Sub>
          {t('private.notes')}: {held.notes}
        </Sub>
      ) : null}
      {links ? (
        <Sub>
          <QuietMapLinks
            directions={{
              href: links.directions,
              label: t('links.directions'),
              aria: t('links.directionsTo', { name: order.firstName }),
            }}
            map={{
              href: links.map,
              label: t('links.map'),
              aria: t('links.mapOf', { name: order.firstName }),
            }}
          />
        </Sub>
      ) : null}
      {order.status === 'cancelled' ? null : (
        <Steps role="group" aria-label={t('delivery.stepsLabel', { code })}>
          <StepBar>
            {DELIVERY_STEPS.map((id) => (
              <StepButton
                key={id}
                type="button"
                $current={step === id}
                aria-current={step === id ? 'step' : undefined}
                disabled={busy}
                onClick={() => onStep(id, minutes)}
              >
                {step === id ? <Icon name="check" /> : null}
                {t(`delivery.step.${id}`)}
              </StepButton>
            ))}
          </StepBar>
          {step === 'delivered' || order.status === 'delivered' ? null : (
            <Minutes>
              {t('delivery.minutesLabel')}
              <select
                value={minutes}
                onChange={(event) => setMinutes(Number(event.target.value))}
                aria-label={t('delivery.minutesAria', { code })}
              >
                {ARRIVING_MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? t('delivery.noTime') : t('message.minutes', { count: m })}
                  </option>
                ))}
              </select>
            </Minutes>
          )}
        </Steps>
      )}
    </OrderRowRoot>
  );
}
