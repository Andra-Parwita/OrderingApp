import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderStatus, SellerOrder } from '../../../shared/domain';
import { formatOrderCode } from '../../../shared/orderCode';
import { sendArrivingSoon, setOrderStatus } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Button, Pill } from '../../ui';
import { SATURDAY_NS } from './i18n/register';
import {
  Action,
  Actions,
  Card,
  Code,
  Count,
  Head,
  itemsShort,
  LoadState,
  money,
  Muted,
  Notice,
  Page,
  Row,
  Section,
  Small,
  Title,
  toneOf,
  totalCents,
  useLang,
  useSaturdayData,
} from './parts';

type DeliveryAction = 'out' | 'soon' | 'delivered';

/** The key of why an action is not available for this status, or null when it is. */
function reasonKey(status: OrderStatus, action: DeliveryAction): string | null {
  switch (status) {
    case 'ordered':
      return 'delivery.reason.confirmFirst';
    case 'confirmed':
      return action === 'out' ? null : 'delivery.reason.afterOut';
    case 'out_for_delivery':
      return action === 'out' ? 'delivery.reason.alreadyOut' : null;
    case 'delivered':
    case 'collected':
      return 'delivery.reason.delivered';
    case 'ready_for_pickup':
      return 'delivery.reason.confirmFirst';
    case 'cancelled':
      return 'delivery.reason.cancelled';
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

const DONE: ReadonlyArray<OrderStatus> = ['delivered', 'collected'];

/** Delivery run (S13b): the delivery orders, with the next step for each. Route-agnostic. */
export function DeliveryRunScreen() {
  const { t } = useTranslation(SATURDAY_NS);
  const slug = currentSellerSlug();
  const { data, reload } = useSaturdayData();
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<Readonly<{ text: string; bad: boolean }> | null>(null);

  const run = useCallback(
    async (order: SellerOrder, action: DeliveryAction) => {
      setBusyCode(order.code);
      setNotice(null);
      const result =
        action === 'soon'
          ? await sendArrivingSoon(order.code, undefined, slug)
          : await setOrderStatus(
              order.code,
              action === 'out' ? 'out_for_delivery' : 'delivered',
              undefined,
              slug,
            );
      setBusyCode(null);
      if (!result.ok) {
        setNotice({ text: t('common.actionFailed'), bad: true });
        return;
      }
      const key =
        action === 'out'
          ? 'delivery.sentOut'
          : action === 'soon'
            ? 'delivery.sentSoon'
            : 'delivery.sentDelivered';
      setNotice({ text: t(key, { name: order.firstName }), bad: false });
      await reload();
    },
    [slug, reload, t],
  );

  const orders =
    data.status === 'ready'
      ? data.orders
          .filter((order) => order.fulfilment === 'delivery' && order.status !== 'cancelled')
          .sort((a, b) => Number(DONE.includes(a.status)) - Number(DONE.includes(b.status)))
      : [];
  const date = data.status === 'ready' ? data.date : null;

  return (
    <Page>
      <Head>
        <Title>{date ? t('delivery.title', { date }) : t('delivery.titleNoDate')}</Title>
        {data.status === 'ready' ? (
          <Count>{t('delivery.count', { count: orders.length })}</Count>
        ) : null}
      </Head>
      <LoadState data={data} onRetry={() => void reload()} />
      {notice ? (
        <Notice $bad={notice.bad} role={notice.bad ? 'alert' : 'status'}>
          {notice.text}
        </Notice>
      ) : null}
      {data.status === 'ready' && orders.length === 0 ? <Muted>{t('delivery.empty')}</Muted> : null}
      {orders.map((order) => (
        <DeliveryCard key={order.code} order={order} busy={busyCode !== null} onAction={run} />
      ))}
      <Section>
        <Muted>{t('delivery.addresses')}</Muted>
      </Section>
    </Page>
  );
}

type CardProps = Readonly<{
  order: SellerOrder;
  busy: boolean;
  onAction: (order: SellerOrder, action: DeliveryAction) => Promise<void>;
}>;

const ACTIONS: ReadonlyArray<Readonly<{ id: DeliveryAction; label: string }>> = [
  { id: 'out', label: 'delivery.out' },
  { id: 'soon', label: 'delivery.soon' },
  { id: 'delivered', label: 'delivery.delivered' },
];

function DeliveryCard({ order, busy, onAction }: CardProps) {
  const { t } = useTranslation(SATURDAY_NS);
  const lang = useLang();
  const code = formatOrderCode(order.code);
  return (
    <Card aria-label={t('handover.cardLabel', { code })}>
      <Row>
        <span>
          <Code>{code}</Code> <b>{order.firstName}</b>
        </span>
        <Pill tone={toneOf(order.status)}>{t(`status.${order.status}`)}</Pill>
      </Row>
      <Small>
        {itemsShort(order.lines, lang)} · <b>{money(totalCents(order), lang)}</b>
      </Small>
      <Actions>
        {ACTIONS.map(({ id, label }) => {
          const reason = reasonKey(order.status, id);
          const reasonId = `${order.code}-${id}-reason`;
          return (
            <Action key={id}>
              <Button
                variant={reason === null && id !== 'soon' ? 'primary' : 'secondary'}
                disabled={reason !== null || busy}
                aria-describedby={reason !== null ? reasonId : undefined}
                onClick={() => void onAction(order, id)}
              >
                {t(label)}
              </Button>
              {reason !== null ? <Muted id={reasonId}>{t(reason)}</Muted> : null}
            </Action>
          );
        })}
      </Actions>
    </Card>
  );
}
