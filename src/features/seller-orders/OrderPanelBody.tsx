import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Order } from '../../../shared/domain';
import { formatAuditDiff } from '../../../shared/auditDiff';
import { formatDay, formatDayTime } from '../../../shared/dates';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { pickText } from '../../../shared/text';
import { Button, Icon, WarningDialog, type IconName } from '../../ui';
import { SELLER_NS } from './i18n/register';
import { StatusMark } from './StatusMark';
import { actorLabel, orderTotalCents } from './orderText';
import { selectCookingDate, selectCurrent } from './sellerOrdersSelectors';
import { auditText, useOrderActions } from './useOrderActions';

// The order beside the list (384 px; handoff, Home): changed note, items, the customer's note,
// details, recent changes. One main button pinned at the bottom (OrderPanelActions).

const Head = styled.header`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;
const HeadTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Title = styled.h2`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
  margin: 0;
  font-size: 1.375rem;
  font-weight: 700;

  code {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 0.9375rem;
    font-weight: 600;
    color: ${({ theme }) => theme.c.muted};
  }
  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
const CloseButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  border: 0;
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: transparent;
  color: ${({ theme }) => theme.c.muted};
  cursor: pointer;
`;
const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;

  svg {
    width: 1rem;
    height: 1rem;
  }
`;
const MetaItem = styled.span<{ $warn?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme, $warn }) => ($warn ? theme.c.warn : 'inherit')};
`;
const Notice = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.warnTint};
  color: ${({ theme }) => theme.c.text};
  font-size: 0.875rem;
  overflow-wrap: anywhere;

  svg {
    flex: none;
    color: ${({ theme }) => theme.c.warn};
  }
  strong {
    display: block;
  }
  span {
    color: ${({ theme }) => theme.c.muted};
  }
`;
const Group = styled.h3`
  margin: ${({ theme }) => theme.spacing.lg} 0 ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;
const ItemRow = styled.div<{ $total?: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-size: ${({ $total }) => ($total ? '1rem' : '0.9375rem')};
  font-weight: ${({ $total }) => ($total ? 700 : 400)};
  font-variant-numeric: tabular-nums;

  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
  }
`;
const NoteText = styled.p`
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;
const Details = styled.dl`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  margin: 0;
  font-size: 0.875rem;

  dt {
    color: ${({ theme }) => theme.c.muted};
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
`;
const Recent = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  padding: 0;
  font-size: 0.875rem;
  list-style: none;

  small {
    display: block;
    color: ${({ theme }) => theme.c.muted};
  }
`;
const ErrorLine = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.c.danger};
`;

export function OrderPanelBody({
  order,
  onClose,
}: Readonly<{ order: Order; onClose?: () => void }>) {
  const { t } = useTranslation(SELLER_NS);
  const current = useSelector(selectCurrent);
  const cookingDate = useSelector(selectCookingDate);
  const a = useOrderActions(order);
  const { lang, failed, audit, kind, diff, lastEdit } = a;

  const place =
    current.status === 'ready'
      ? current.view.pickupPoints.find((point) => point.id === order.pickupPlaceId)
      : undefined;
  const when = cookingDate !== null ? formatDay(cookingDate, lang) : '';
  const pickupText = [
    place ? `${place.place} · ${when}, ${place.window.start}–${place.window.end}` : when,
  ]
    .filter((part) => part !== '')
    .join('');
  const metaIcon: IconName = order.fulfilment === 'delivery' ? 'truck' : 'bag';

  return (
    <>
      <Head>
        <HeadTop>
          <Title>
            <code>{formatOrderCode(order.code)}</code>
            <span>{order.firstName}</span>
          </Title>
          {onClose ? (
            <CloseButton type="button" aria-label={t('detail.close')} onClick={onClose}>
              <Icon name="x" />
            </CloseButton>
          ) : null}
        </HeadTop>
        <Meta>
          <StatusMark status={order.status} />
          <MetaItem>
            <Icon name={metaIcon} />
            {t(`fulfilment.${order.fulfilment}`)}
          </MetaItem>
          <MetaItem $warn={!order.paid}>
            {order.paid ? <Icon name="check" /> : null}
            {order.paid ? t('live.paid') : t('live.notPaid')}
          </MetaItem>
        </Meta>
      </Head>

      {order.changed ? (
        <Notice>
          <Icon name="pencil" />
          <div>
            <strong>
              {t('panel.changedBy', { name: order.firstName, when: formatDayTime(lastEdit, lang) })}
            </strong>
            <span>{diff ? formatAuditDiff(diff, lang) : t('audit.edited')}</span>
            <div>
              <Button variant="quiet" disabled={a.saving} onClick={a.onSeen}>
                {t('detail.seen')}
              </Button>
            </div>
          </div>
        </Notice>
      ) : null}
      {kind === 'new' ? (
        <Notice>
          <Icon name="chat" />
          <div>
            <strong>{t('orders.newCustomer')}</strong>
            <span>{t('detail.bannerNew')}</span>
            <div>
              <Button variant="quiet" disabled={a.saving} onClick={a.onWaReceived}>
                {t('detail.markWa')}
              </Button>
            </div>
          </div>
        </Notice>
      ) : null}

      <Group>{t('panel.items')}</Group>
      <div>
        {order.lines.map((line) => (
          <ItemRow key={line.itemId}>
            <span>
              {pickText(line.name, lang)}
              {pickText(line.size, lang) ? <small> · {pickText(line.size, lang)}</small> : null}
            </span>
            <small>×{line.qty}</small>
            <span>{formatMoney(line.priceCents * line.qty, lang)}</span>
          </ItemRow>
        ))}
        <ItemRow $total>
          <span>{t('detail.total')}</span>
          <span />
          <span>{formatMoney(orderTotalCents(order), lang)}</span>
        </ItemRow>
      </div>

      {order.note ? (
        <>
          <Group>{t('panel.noteFrom', { name: order.firstName })}</Group>
          <NoteText>{order.note}</NoteText>
        </>
      ) : null}

      <Group>{t('detail.status')}</Group>
      <Details>
        <dt>{t(order.fulfilment === 'delivery' ? 'panel.delivery' : 'panel.pickup')}</dt>
        <dd>{pickupText}</dd>
        <dt>{t('panel.language')}</dt>
        <dd>{t(order.language === 'id' ? 'panel.langId' : 'panel.langEn')}</dd>
        <dt>{t('panel.whatsapp')}</dt>
        <dd>{order.waReceived ? t('panel.waYes') : t('panel.waNo')}</dd>
        <dt>{t('panel.enteredBy')}</dt>
        <dd>
          {order.enteredBy
            ? actorLabel(order.enteredBy, t)
            : t('panel.enteredByCustomer', { name: order.firstName })}
        </dd>
        <dt>{t('panel.customer')}</dt>
        <dd>{order.returning ? t('panel.custReturning') : t('panel.custNew')}</dd>
        <dt>{t('panel.canChange')}</dt>
        <dd>{order.locked ? t('panel.canNo') : t('panel.canYes')}</dd>
        {order.collectedAt ? (
          <>
            <dt>{t('status.collected')}</dt>
            <dd>
              {t('panel.collected', { when: formatDayTime(order.collectedAt, lang) })}
              {' · '}
              {order.collectedBy === 'customer'
                ? t('panel.collectedByCustomer')
                : t('panel.collectedBySeller')}
            </dd>
          </>
        ) : null}
      </Details>

      <Group>{t('panel.recent')}</Group>
      <Recent>
        {audit.map((entry) => (
          <li key={`${entry.at}-${entry.what}-${entry.detail ?? ''}`}>
            {actorLabel(entry.by, t)} · {auditText(entry, t, lang)}
            <small>{formatDayTime(entry.at, lang)}</small>
          </li>
        ))}
      </Recent>
      {failed ? (
        <ErrorLine role="alert">
          <span>{t('error.change')}</span>
          <Button onClick={a.onRetry}>{t('error.retry')}</Button>
        </ErrorLine>
      ) : null}
    </>
  );
}

const Foot = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};

  & > button:first-child {
    min-height: ${({ theme }) => theme.size.mainAction + 4}px;
    font-size: 1rem;
  }
`;
const Pair = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Plain = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.xs};
`;
const Danger = styled(Button)`
  color: ${({ theme }) => theme.c.danger};
`;
const Quiet = styled(Button)`
  color: ${({ theme }) => theme.c.text};
`;

/** The pinned buttons: one main step, two helpers, then plain Lock, Nudge, Cancel and a quiet Mark collected. */
export function OrderPanelActions({ order }: Readonly<{ order: Order }>) {
  const { t } = useTranslation(SELLER_NS);
  const a = useOrderActions(order);
  const [asking, setAsking] = useState(false);
  // Collected is the quiet button below (D-069 Q4), so it is never the main step here.
  const main = a.forward.find((status) => status !== 'collected');
  const canCollect = order.fulfilment === 'pickup' && !a.final;
  return (
    <Foot>
      {main ? (
        <Button variant="primary" fullWidth disabled={a.saving} onClick={() => a.onStep(main)}>
          <Icon name="check" />
          {t(`detail.action.${main}`)}
        </Button>
      ) : null}
      <Pair>
        <Button onClick={a.onWhatsApp}>
          <Icon name="chat" />
          {t('detail.sendLink')}
        </Button>
        <Button disabled={a.saving} onClick={() => a.setPaid(!order.paid)}>
          <Icon name="coin" />
          {order.paid ? t('detail.markUnpaid') : t('detail.markPaid')}
        </Button>
      </Pair>
      <Plain>
        <Quiet variant="quiet" disabled={a.saving || a.final} onClick={a.onLock}>
          <Icon name="lock" />
          {order.locked ? t('panel.unlock') : t('panel.lock')}
        </Quiet>
        <Quiet variant="quiet" disabled={a.saving || a.final} onClick={a.onNudge}>
          <Icon name="bell" />
          {t('panel.nudge')}
        </Quiet>
        {a.canCancel ? (
          <Danger variant="quiet" disabled={a.saving} onClick={() => setAsking(true)}>
            <Icon name="x" />
            {t('detail.cancel')}
          </Danger>
        ) : null}
      </Plain>
      {canCollect ? (
        <Quiet variant="quiet" fullWidth disabled={a.saving} onClick={a.onCollected}>
          {t('detail.action.collected')}
        </Quiet>
      ) : null}
      {asking ? (
        <WarningDialog
          title={t('panel.cancelTitle', { name: order.firstName })}
          cancelLabel={t('panel.cancelKeep')}
          continueLabel={t('panel.cancelGo')}
          onCancel={() => setAsking(false)}
          onContinue={() => {
            setAsking(false);
            a.onCancel();
          }}
        >
          {t('panel.cancelBody', { name: order.firstName })}
        </WarningDialog>
      ) : null}
    </Foot>
  );
}
