import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { AuditEntry, Order, OrderStatus } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { nextStatuses } from '../../../shared/status';
import { pickText } from '../../../shared/text';
import { Button, ConfirmButton, Pill, Segmented, type SegmentedOption } from '../../ui';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { SELLER_NS } from './i18n/register';
import { formatDay, formatDayTime } from '../../../shared/dates';
import { toneOf } from './orderStatus';
import { actorLabel, orderTotalCents, useLang } from './orderText';
import { ScreenErrorBoundary } from './ScreenErrorBoundary';
import {
  selectChange,
  selectCookingDate,
  selectList,
  selectOrderByCode,
} from './sellerOrdersSelectors';
import {
  paidChangeRequested,
  pollingStarted,
  pollingStopped,
  refreshRequested,
  statusChangeRequested,
  type FailedChange,
  type SellerOrdersRootState,
} from './sellerOrdersSlice';

export type OrderDetailScreenProps = Readonly<{ code: string; onBack: () => void }>;

const Page = styled.main`
  max-width: min(100%, 45rem);
  margin: 0 auto;
  padding-bottom: ${({ theme }) => theme.spacing.xxl};
`;
const Bar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
`;
const Tools = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;
const Heading = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Code = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.xl};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
  white-space: nowrap;
`;
const Name = styled.span`
  font-size: ${({ theme }) => theme.type.size.lg};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Muted = styled.span`
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.colour.textMuted};
`;
const Line = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;
const TotalLine = styled(Line)`
  padding-top: ${({ theme }) => theme.spacing.sm};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Title = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  color: ${({ theme }) => theme.colour.textMuted};
`;
const NoteText = styled.p`
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;
const Pillbox = styled.div`
  display: flex;
`;
const Errors = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.status.cancelled.fg};
`;
const History = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;
const HistoryItem = styled.li`
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const Message = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colour.textMuted};
`;

type StepButtonProps = Readonly<{
  order: Order;
  to: OrderStatus;
  primary: boolean;
  disabled: boolean;
}>;

function StepButton({ order, to, primary, disabled }: StepButtonProps) {
  const { t } = useTranslation(SELLER_NS);
  const dispatch = useDispatch();
  const onClick = useCallback(
    () => dispatch(statusChangeRequested({ code: order.code, to })),
    [dispatch, order.code, to],
  );
  return (
    <Button
      variant={primary ? 'primary' : 'secondary'}
      fullWidth
      disabled={disabled}
      onClick={onClick}
    >
      {t(`status.${to}`)}
    </Button>
  );
}

function auditText(entry: AuditEntry, t: ReturnType<typeof useTranslation>['t']): string {
  switch (entry.what) {
    case 'created':
      return t('audit.created');
    case 'edited':
      return t('audit.edited');
    case 'status':
      return t('audit.status', { status: t(`status.${entry.detail ?? ''}`) });
    case 'paid':
      return entry.detail === 'unpaid' ? t('audit.unpaid') : t('audit.paid');
    default: {
      const unreachable: never = entry.what;
      return unreachable;
    }
  }
}

function sortedAudit(audit: ReadonlyArray<AuditEntry>): Array<AuditEntry> {
  // D-013: up to 4 entries, newest first.
  return [...audit].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 4);
}

function DetailBody({ order }: Readonly<{ order: Order }>) {
  const { t, i18n } = useTranslation(SELLER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const change = useSelector(selectChange);
  const cookingDate = useSelector(selectCookingDate);
  const saving = change.status === 'saving';
  const failed: FailedChange | null =
    change.status === 'error' && change.failed.code === order.code ? change.failed : null;

  const steps = nextStatuses(order);
  const forward = steps.filter((status) => status !== 'cancelled');
  const canCancel = steps.includes('cancelled');
  const audit = useMemo(() => sortedAudit(order.audit), [order.audit]);

  const paidOptions = useMemo<Array<SegmentedOption<'yes' | 'no'>>>(
    () => [
      { value: 'yes', label: t('detail.paidYes') },
      { value: 'no', label: t('detail.paidNo') },
    ],
    [t],
  );
  const onPaid = useCallback(
    (next: 'yes' | 'no') =>
      dispatch(paidChangeRequested({ code: order.code, paid: next === 'yes' })),
    [dispatch, order.code],
  );
  const onCancel = useCallback(
    () => dispatch(statusChangeRequested({ code: order.code, to: 'cancelled' })),
    [dispatch, order.code],
  );
  const onWhatsApp = useCallback(() => {
    // The message is in the customer's language, not the seller's.
    const fixed = i18n.getFixedT(order.language, SELLER_NS);
    const text = fixed('whatsapp.message', {
      name: order.firstName,
      code: formatOrderCode(order.code),
      link: `${window.location.origin}/o/${order.token}`,
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }, [i18n, order]);
  const onRetry = useCallback(() => {
    if (!failed) return;
    dispatch(
      failed.kind === 'status'
        ? statusChangeRequested({ code: failed.code, to: failed.to })
        : paidChangeRequested({ code: failed.code, paid: failed.paid }),
    );
  }, [dispatch, failed]);

  return (
    <>
      <Section>
        <Heading>
          <Code>{formatOrderCode(order.code)}</Code>
          <Name>{order.firstName}</Name>
        </Heading>
        <Muted>{t('detail.placed', { when: formatDayTime(order.createdAt, lang) })}</Muted>
        {order.enteredBy ? (
          <Muted>{t('orders.enteredBy', { name: actorLabel(order.enteredBy, t) })}</Muted>
        ) : null}
      </Section>
      <Section>
        {order.lines.map((line) => (
          <Line key={line.itemId}>
            <span>
              {line.qty}× {pickText(line.name, lang)}
            </span>
            <strong>{formatMoney(line.priceCents * line.qty, lang)}</strong>
          </Line>
        ))}
        <TotalLine>
          <span>{t('detail.total')}</span>
          <span>{formatMoney(orderTotalCents(order), lang)}</span>
        </TotalLine>
        <span>
          <strong>{t(`fulfilment.${order.fulfilment}`)}</strong>
          {cookingDate !== null ? ` · ${formatDay(cookingDate, lang)}` : ''}
        </span>
      </Section>
      {order.note ? (
        <Section>
          <Title>{t('detail.noteTitle')}</Title>
          <NoteText>{order.note}</NoteText>
        </Section>
      ) : null}
      <Section>
        <Title>{t('detail.status')}</Title>
        <Pillbox>
          <Pill tone={toneOf(order.status)}>{t(`status.${order.status}`)}</Pill>
        </Pillbox>
        {/* One primary next step; any further steps stay secondary. */}
        {forward.map((status, index) => (
          <StepButton
            key={status}
            order={order}
            to={status}
            primary={index === 0}
            disabled={saving}
          />
        ))}
        {failed ? (
          <Errors role="alert">
            <span>{t('error.change')}</span>
            <Button onClick={onRetry}>{t('error.retry')}</Button>
          </Errors>
        ) : null}
      </Section>
      <Section>
        <Line>
          <span>
            {t('detail.paid')} <Muted>{t('detail.paidHint')}</Muted>
          </span>
          <Segmented
            options={paidOptions}
            value={order.paid ? 'yes' : 'no'}
            onChange={onPaid}
            label={t('detail.paid')}
          />
        </Line>
        <Button fullWidth onClick={onWhatsApp}>
          {t('detail.whatsapp')}
        </Button>
        {canCancel ? (
          <ConfirmButton
            fullWidth
            label={t('detail.cancel')}
            confirmLabel={t('detail.cancelConfirm')}
            disabled={saving}
            onConfirm={onCancel}
          />
        ) : null}
      </Section>
      <Section>
        <Title>{t('detail.history')}</Title>
        <History>
          {audit.map((entry) => (
            <HistoryItem key={`${entry.at}-${entry.what}-${entry.detail ?? ''}`}>
              <span>
                {actorLabel(entry.by, t)} · {auditText(entry, t)}
              </span>
              <Muted>{formatDayTime(entry.at, lang)}</Muted>
            </HistoryItem>
          ))}
        </History>
      </Section>
    </>
  );
}

function DetailContent({ code, onBack }: OrderDetailScreenProps) {
  const { t } = useTranslation(SELLER_NS);
  const dispatch = useDispatch();
  const list = useSelector(selectList);
  const order = useSelector((state: SellerOrdersRootState) => selectOrderByCode(state, code));

  useEffect(() => {
    dispatch(pollingStarted());
    return () => {
      dispatch(pollingStopped());
    };
  }, [dispatch]);
  const retry = useCallback(() => dispatch(refreshRequested()), [dispatch]);

  const customerLang = order ? order.language.toUpperCase() : '';
  return (
    <Page>
      <Bar>
        <Button variant="quiet" onClick={onBack}>
          {t('detail.back')}
        </Button>
        <Tools>
          {order ? (
            <Pill tone="done">{t('detail.customerLanguage', { lang: customerLang })}</Pill>
          ) : null}
          <LanguageSwitch />
        </Tools>
      </Bar>
      {order ? <DetailBody order={order} /> : null}
      {!order && list.status === 'loading' ? (
        <Message role="status">{t('detail.loading')}</Message>
      ) : null}
      {!order && list.status === 'error' ? (
        <Section>
          <Errors role="alert">
            <span>{t('error.load')}</span>
            <Button onClick={retry}>{t('error.retry')}</Button>
          </Errors>
        </Section>
      ) : null}
      {!order && list.status === 'ready' ? <Message>{t('detail.notFound')}</Message> : null}
    </Page>
  );
}

export function OrderDetailScreen(props: OrderDetailScreenProps) {
  return (
    <ScreenErrorBoundary>
      <DetailContent {...props} />
    </ScreenErrorBoundary>
  );
}
