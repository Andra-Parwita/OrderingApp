import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { SellerOrder } from '../../../shared/domain';
import { formatOrderCode, ORDER_CODE_LENGTH, parseOrderCode } from '../../../shared/orderCode';
import { pickText } from '../../../shared/text';
import { fetchSellerOrder, setOrderStatus } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Button, Pill, TextField } from '../../ui';
import { SATURDAY_NS } from './i18n/register';
import {
  Action,
  Actions,
  Card,
  Code,
  Count,
  Head,
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

const Big = styled.div`
  input {
    min-height: calc(${({ theme }) => theme.minTapTarget} * 1.25);
    font-size: ${({ theme }) => theme.type.size.xl};
    font-weight: ${({ theme }) => theme.type.weight.strong};
    letter-spacing: ${({ theme }) => theme.spacing.xs};
    text-transform: uppercase;
  }
`;

const Tag = styled.span`
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

type Lookup =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'looking' }>
  | Readonly<{ kind: 'bad' }>
  | Readonly<{ kind: 'notFound' }>
  | Readonly<{ kind: 'error' }>
  | Readonly<{ kind: 'found'; order: SellerOrder; justCollected: boolean }>;

/** The reason "Mark collected" is not available yet, or null when it is. */
function collectReason(order: SellerOrder): string | null {
  switch (order.status) {
    case 'ready_for_pickup':
      return null;
    case 'collected':
      return 'handover.reason.collected';
    case 'cancelled':
      return 'handover.reason.cancelled';
    default:
      return 'handover.reason.early';
  }
}

/** Hand-over (S13): find the order by its code, check it, mark it collected. Route-agnostic. */
export function HandOverScreen() {
  const { t } = useTranslation(SATURDAY_NS);
  const slug = currentSellerSlug();
  const { data, reload } = useSaturdayData();
  const [typed, setTyped] = useState('');
  const [lookup, setLookup] = useState<Lookup>({ kind: 'idle' });
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  // Only the newest lookup may answer; a slow earlier one is ignored.
  const latest = useRef(0);

  const onType = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setTyped(value);
      setFailed(false);
      latest.current += 1;
      const mine = latest.current;
      const code = parseOrderCode(value);
      if (code === null) {
        const length = value.replace(/[\s-]/g, '').length;
        setLookup(length >= ORDER_CODE_LENGTH ? { kind: 'bad' } : { kind: 'idle' });
        return;
      }
      setLookup({ kind: 'looking' });
      void fetchSellerOrder(code, undefined, slug).then((result) => {
        if (latest.current !== mine) return;
        if (result.ok) {
          setLookup({ kind: 'found', order: result.data.order, justCollected: false });
        } else {
          setLookup({ kind: result.error === 'not_found' ? 'notFound' : 'error' });
        }
      });
    },
    [slug],
  );

  const collect = useCallback(
    async (order: SellerOrder) => {
      setBusy(true);
      setFailed(false);
      const result = await setOrderStatus(order.code, 'collected', undefined, slug);
      setBusy(false);
      if (!result.ok) {
        setFailed(true);
        return;
      }
      setLookup({ kind: 'found', order: result.data.order, justCollected: true });
      await reload();
    },
    [slug, reload],
  );

  const next = useCallback(() => {
    latest.current += 1;
    setTyped('');
    setLookup({ kind: 'idle' });
    setFailed(false);
  }, []);

  const pickups =
    data.status === 'ready' ? data.orders.filter((o) => o.fulfilment === 'pickup') : [];
  const ready = pickups.filter((o) => o.status === 'ready_for_pickup').length;
  const collected = pickups.filter((o) => o.status === 'collected').length;
  const date = data.status === 'ready' ? data.date : null;

  return (
    <Page>
      <Head>
        <Title>{date ? t('handover.title', { date }) : t('handover.titleNoDate')}</Title>
        {data.status === 'ready' ? (
          <Count aria-label={t('handover.countsLabel')}>
            {t('handover.counts', { ready, collected })}
          </Count>
        ) : null}
      </Head>
      <LoadState data={data} onRetry={() => void reload()} />

      <Section>
        <Big>
          <TextField
            label={t('handover.codeLabel')}
            helper={t('handover.codeHelp')}
            value={typed}
            onChange={onType}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={12}
          />
        </Big>
        {lookup.kind === 'looking' ? <Muted role="status">{t('handover.lookingUp')}</Muted> : null}
        {lookup.kind === 'bad' ? (
          <Notice $bad role="alert">
            {t('handover.badCode')}
          </Notice>
        ) : null}
        {lookup.kind === 'notFound' ? (
          <Notice $bad role="alert">
            {t('handover.notFound')}
          </Notice>
        ) : null}
        {lookup.kind === 'error' ? (
          <Notice $bad role="alert">
            {t('common.actionFailed')}
          </Notice>
        ) : null}
        {lookup.kind === 'found' ? (
          <FoundOrder
            order={lookup.order}
            justCollected={lookup.justCollected}
            busy={busy}
            onCollect={collect}
            onNext={next}
          />
        ) : null}
        {failed ? (
          <Notice $bad role="alert">
            {t('common.actionFailed')}
          </Notice>
        ) : null}
        <Row>
          <Action>
            <Button disabled aria-describedby="scan-note">
              {t('handover.scan')}
            </Button>
            <Muted id="scan-note">{t('handover.scanNote')}</Muted>
          </Action>
        </Row>
      </Section>
    </Page>
  );
}

type FoundProps = Readonly<{
  order: SellerOrder;
  justCollected: boolean;
  busy: boolean;
  onCollect: (order: SellerOrder) => Promise<void>;
  onNext: () => void;
}>;

function FoundOrder({ order, justCollected, busy, onCollect, onNext }: FoundProps) {
  const { t } = useTranslation(SATURDAY_NS);
  const lang = useLang();
  const code = formatOrderCode(order.code);
  const reasonKey = collectReason(order);
  const isDelivery = order.fulfilment === 'delivery';
  return (
    <Card aria-label={t('handover.cardLabel', { code })}>
      <Row>
        <Code>{code}</Code>
        <Pill tone={toneOf(order.status)}>{t(`status.${order.status}`)}</Pill>
      </Row>
      <b>{order.firstName}</b>
      {order.lines.map((line) => (
        <Small key={line.itemId}>
          {line.qty}× {pickText(line.name, lang)}
        </Small>
      ))}
      <Row>
        <b>{money(totalCents(order), lang)}</b>
        <Tag>{order.paid ? t('common.paid') : t('common.notPaid')}</Tag>
      </Row>
      {order.note ? <Small>{t('common.note', { note: order.note })}</Small> : null}
      {justCollected ? (
        <>
          <Notice role="status">
            {t('handover.collectedDone', { name: order.firstName, code })}
          </Notice>
          <Button variant="primary" onClick={onNext}>
            {t('handover.next')}
          </Button>
        </>
      ) : isDelivery ? (
        <Notice $bad role="status">
          {t('handover.isDelivery')}
        </Notice>
      ) : (
        <Actions>
          <Action>
            <Button
              variant="primary"
              disabled={reasonKey !== null || busy}
              aria-describedby={reasonKey !== null ? 'collect-reason' : undefined}
              onClick={() => void onCollect(order)}
            >
              {t('handover.markCollected')}
            </Button>
            {reasonKey !== null ? <Muted id="collect-reason">{t(reasonKey)}</Muted> : null}
          </Action>
        </Actions>
      )}
    </Card>
  );
}
