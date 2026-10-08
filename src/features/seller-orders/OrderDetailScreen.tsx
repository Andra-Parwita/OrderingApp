import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Order, OrderStatus } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { pickText } from '../../../shared/text';
import { Button, ConfirmButton, Pill, Segmented, Toast, type SegmentedOption } from '../../ui';
import { formatAuditDiff } from '../../../shared/auditDiff';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { SELLER_NS } from './i18n/register';
import { formatDay, formatDayTime } from '../../../shared/dates';
import { toneOf } from './orderStatus';
import { KIND_MARK } from './customerKind';
import { actorLabel, orderTotalCents } from './orderText';
import { OrderPanelBody } from './OrderPanelBody';
import { ScreenErrorBoundary } from './ScreenErrorBoundary';
import {
  selectCookingDate,
  selectList,
  selectNotice,
  selectOrderByCode,
} from './sellerOrdersSelectors';
import {
  noticeCleared,
  pollingStarted,
  pollingStopped,
  refreshRequested,
  statusChangeRequested,
  type SellerOrdersRootState,
} from './sellerOrdersSlice';
import { auditText, useOrderActions } from './useOrderActions';

export type OrderDetailScreenProps = Readonly<{
  code: string;
  onBack: () => void;
  /** 'panel': the desktop slide-over's content (the panel owns the heading, Close and language). */
  layout?: 'page' | 'panel';
}>;

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
const Banner = styled.section<{ $tone: 'ordered' | 'confirmed' }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ theme, $tone }) => theme.status[$tone].bg};
  color: ${({ theme, $tone }) => theme.status[$tone].fg};
`;
const BannerActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
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

const KIND_BANNER = {
  new: 'detail.bannerNew',
  returning: 'detail.bannerReturning',
  waReceived: 'detail.bannerWaReceived',
} as const;

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
      {t(`detail.action.${to}`)}
    </Button>
  );
}

function DetailBody({ order }: Readonly<{ order: Order }>) {
  const { t } = useTranslation(SELLER_NS);
  const cookingDate = useSelector(selectCookingDate);
  const a = useOrderActions(order);
  const { lang, saving, failed, forward, canCancel, final, audit, kind, diff, lastEdit } = a;
  const { onWaReceived, onNudge, onSeen, onLock, onCancel, onWhatsApp, onRetry } = a;

  const paidOptions = useMemo<Array<SegmentedOption<'yes' | 'no'>>>(
    () => [
      { value: 'yes', label: t('detail.paidYes') },
      { value: 'no', label: t('detail.paidNo') },
    ],
    [t],
  );
  const { setPaid } = a;
  const onPaid = useCallback((next: 'yes' | 'no') => setPaid(next === 'yes'), [setPaid]);

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
      {kind ? (
        <Banner $tone="confirmed">
          <span>
            <strong>{t(KIND_MARK[kind])}</strong> {t(KIND_BANNER[kind])}
          </span>
          <BannerActions>
            {kind === 'new' ? (
              <Button disabled={saving} onClick={onWaReceived}>
                {t('detail.markWa')}
              </Button>
            ) : null}
            <Button disabled={saving || final} onClick={onNudge}>
              {t('detail.nudge')}
            </Button>
          </BannerActions>
        </Banner>
      ) : null}
      {order.changed ? (
        <Banner $tone="ordered">
          <span>
            <strong>{t('orders.changed')}</strong>{' '}
            {t('detail.changedBanner', {
              when: formatDayTime(lastEdit, lang),
              diff: diff ? formatAuditDiff(diff, lang) : t('audit.edited'),
            })}
          </span>
          <Button disabled={saving} onClick={onSeen}>
            {t('detail.seen')}
          </Button>
        </Banner>
      ) : null}
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
          <Muted>{t('detail.noteVisible')}</Muted>
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
        <Line>
          <Muted>{order.locked ? t('detail.lockedState') : t('detail.unlockedState')}</Muted>
          <Button disabled={saving || final} onClick={onLock}>
            {order.locked ? t('detail.unlock') : t('detail.lock')}
          </Button>
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
                {actorLabel(entry.by, t)} · {auditText(entry, t, lang)}
              </span>
              <Muted>{formatDayTime(entry.at, lang)}</Muted>
            </HistoryItem>
          ))}
        </History>
      </Section>
    </>
  );
}

function DetailContent({ code, onBack, layout = 'page' }: OrderDetailScreenProps) {
  const { t } = useTranslation(SELLER_NS);
  const dispatch = useDispatch();
  const list = useSelector(selectList);
  const order = useSelector((state: SellerOrdersRootState) => selectOrderByCode(state, code));
  const notice = useSelector(selectNotice);
  const panel = layout === 'panel';

  useEffect(() => {
    dispatch(pollingStarted());
    return () => {
      dispatch(pollingStopped());
    };
  }, [dispatch]);
  const retry = useCallback(() => dispatch(refreshRequested()), [dispatch]);
  const clearNotice = useCallback(() => dispatch(noticeCleared()), [dispatch]);

  const customerLang = order ? order.language.toUpperCase() : '';
  const status = (
    <>
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
      <Toast message={notice === 'nudged' ? t('detail.nudged') : null} onDismiss={clearNotice} />
    </>
  );
  if (panel) {
    return (
      <>
        {order ? <OrderPanelBody order={order} /> : null}
        {status}
      </>
    );
  }
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
      {status}
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
