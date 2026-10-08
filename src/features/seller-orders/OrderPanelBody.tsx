import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Order } from '../../../shared/domain';
import { formatAuditDiff } from '../../../shared/auditDiff';
import { formatDay, formatDayTime } from '../../../shared/dates';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { pickText } from '../../../shared/text';
import { Button, ConfirmButton, Icon, Pill, type IconName } from '../../ui';
import { SELLER_NS } from './i18n/register';
import { KIND_MARK } from './customerKind';
import { toneOf } from './orderStatus';
import { actorLabel, orderTotalCents } from './orderText';
import { selectCookingDate } from './sellerOrdersSelectors';
import { auditText, useOrderActions } from './useOrderActions';

// The order inside the desktop slide-over (A1-2): who, what, one big next step, a few labelled
// helpers, cancel at the bottom, history folded away.

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.xl}
    ${({ theme }) => theme.spacing.xl};
`;
const Code = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.xxl};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
  white-space: nowrap;
`;
const WhoRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.xs};
`;
const Name = styled.span`
  font-size: ${({ theme }) => theme.type.size.xl};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Muted = styled.span`
  color: ${({ theme }) => theme.colour.textMuted};
`;
const Lines = styled.div`
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;
const Line = styled.div<{ $total?: boolean }>`
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
  font-weight: ${({ theme, $total }) =>
    $total ? theme.type.weight.strong : theme.type.weight.regular};
  font-size: ${({ theme, $total }) => ($total ? theme.type.size.lg : theme.type.size.base)};
`;
const How = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Tint = styled.div<{ $tone: 'ready' | 'ordered' | 'confirmed' }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme, $tone }) => theme.status[$tone].bg};
  color: ${({ theme, $tone }) => theme.status[$tone].fg};
  overflow-wrap: anywhere;
`;
const TintText = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
  white-space: pre-wrap;
`;
const Big = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};

  & > button:first-child {
    min-height: 3.5rem;
    font-size: ${({ theme }) => theme.type.size.lg};
  }
`;
const Helpers = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};

  & > button {
    flex-direction: column;
    min-height: 4.75rem;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xs};
    text-align: center;
    line-height: ${({ theme }) => theme.type.lineHeight.tight};
  }
`;
const Errors = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.status.cancelled.fg};
`;
const Details = styled.details`
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;
const Summary = styled.summary`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.minTapTarget};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  cursor: pointer;
`;
const History = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  padding: 0 0 ${({ theme }) => theme.spacing.sm};
  list-style: none;
`;
const HistoryItem = styled.li`
  display: flex;
  flex-direction: column;
`;

const KIND_BANNER = {
  new: 'detail.bannerNew',
  returning: 'detail.bannerReturning',
  waReceived: 'detail.bannerWaReceived',
} as const;

type HelperProps = Readonly<{
  icon: IconName;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}>;

function Helper({ icon, label, disabled = false, onClick }: HelperProps) {
  return (
    <Button disabled={disabled} onClick={onClick}>
      <Icon name={icon} />
      {label}
    </Button>
  );
}

export function OrderPanelBody({ order }: Readonly<{ order: Order }>) {
  const { t } = useTranslation(SELLER_NS);
  const cookingDate = useSelector(selectCookingDate);
  const a = useOrderActions(order);
  const { lang, saving, failed, forward, canCancel, final, audit, kind, diff, lastEdit } = a;
  const [first, ...more] = forward;

  return (
    <Body>
      <div>
        <Code>{formatOrderCode(order.code)}</Code>
        <WhoRow>
          <Name>{order.firstName}</Name>
          <Pill large tone={toneOf(order.status)}>
            {t(`status.${order.status}`)}
          </Pill>
          <Pill large tone="done">
            {t('detail.customerLanguage', { lang: order.language.toUpperCase() })}
          </Pill>
          {order.paid ? <strong>{t('orders.paid')}</strong> : null}
        </WhoRow>
        {order.enteredBy ? (
          <Muted>{t('orders.enteredBy', { name: actorLabel(order.enteredBy, t) })}</Muted>
        ) : null}
      </div>

      {kind ? (
        <Tint $tone="confirmed">
          <TintText>
            <span>
              <strong>{t(KIND_MARK[kind])}</strong> {t(KIND_BANNER[kind])}
            </span>
            {kind === 'new' ? (
              <Button disabled={saving} onClick={a.onWaReceived}>
                {t('detail.markWa')}
              </Button>
            ) : null}
          </TintText>
        </Tint>
      ) : null}
      {order.changed ? (
        <Tint $tone="ordered">
          <TintText>
            <span>
              <strong>{t('orders.changed')}</strong>{' '}
              {t('detail.changedBanner', {
                when: formatDayTime(lastEdit, lang),
                diff: diff ? formatAuditDiff(diff, lang) : t('audit.edited'),
              })}
            </span>
            <Button disabled={saving} onClick={a.onSeen}>
              {t('detail.seen')}
            </Button>
          </TintText>
        </Tint>
      ) : null}

      <Lines>
        {order.lines.map((line) => (
          <Line key={line.itemId}>
            <span>
              {line.qty}× {pickText(line.name, lang)}
            </span>
            <span>{formatMoney(line.priceCents * line.qty, lang)}</span>
          </Line>
        ))}
        <Line $total>
          <span>{t('detail.total')}</span>
          <span>{formatMoney(orderTotalCents(order), lang)}</span>
        </Line>
      </Lines>
      <How>
        <Icon name={order.fulfilment === 'delivery' ? 'truck' : 'bag'} />
        <span>
          {t(`fulfilment.${order.fulfilment}`)}
          {cookingDate !== null ? ` · ${formatDay(cookingDate, lang)}` : ''}
        </span>
      </How>
      {order.note ? (
        <Tint $tone="ready">
          <Icon name="note" />
          <TintText>
            <strong>{t('detail.noteFrom', { name: order.firstName })}</strong>
            <span>{order.note}</span>
          </TintText>
        </Tint>
      ) : null}

      {first ? (
        <Big>
          <Button variant="primary" fullWidth disabled={saving} onClick={() => a.onStep(first)}>
            {t(`detail.action.${first}`)}
          </Button>
          {more.map((status) => (
            <Button key={status} fullWidth disabled={saving} onClick={() => a.onStep(status)}>
              {t(`detail.action.${status}`)}
            </Button>
          ))}
        </Big>
      ) : null}
      {failed ? (
        <Errors role="alert">
          <span>{t('error.change')}</span>
          <Button onClick={a.onRetry}>{t('error.retry')}</Button>
        </Errors>
      ) : null}

      <Helpers>
        <Helper
          icon="coin"
          label={order.paid ? t('detail.markUnpaid') : t('detail.markPaid')}
          onClick={() => a.setPaid(!order.paid)}
        />
        <Helper
          icon="lock"
          label={order.locked ? t('detail.unlock') : t('detail.lock')}
          disabled={saving || final}
          onClick={a.onLock}
        />
        <Helper icon="chat" label={t('detail.sendLink')} onClick={a.onWhatsApp} />
        <Helper
          icon="bell"
          label={t('detail.nudge')}
          disabled={saving || final}
          onClick={a.onNudge}
        />
      </Helpers>

      {canCancel ? (
        <ConfirmButton
          fullWidth
          label={t('detail.cancel')}
          confirmLabel={t('detail.cancelConfirm')}
          disabled={saving}
          onConfirm={a.onCancel}
        />
      ) : null}

      <Details>
        <Summary>
          <Icon name="history" />
          {t('detail.history')}
        </Summary>
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
      </Details>
    </Body>
  );
}
