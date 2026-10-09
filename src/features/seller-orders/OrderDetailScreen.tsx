import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Order } from '../../../shared/domain';
import { formatOrderCode } from '../../../shared/orderCode';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Button, Icon, WarningDialog, type IconName } from '../../ui';
import { ContactFields, getContact, getContactDigits, saveContact } from './contacts';
import { FeedbackHost } from './FeedbackHost';
import { SELLER_NS } from './i18n/register';
import { OrderPanelBody } from './OrderPanelBody';
import { ScreenErrorBoundary } from './ScreenErrorBoundary';
import { selectList, selectOrderByCode } from './sellerOrdersSelectors';
import {
  pollingStarted,
  pollingStopped,
  refreshRequested,
  type SellerOrdersRootState,
} from './sellerOrdersSlice';
import { useOrderActions } from './useOrderActions';
import { openOrderLink } from './whatsappLink';

// One order on a phone (plan 001 stage 11; handoff, Home, phone): the same body as the tablet's
// side panel, a full-screen page with a pinned foot. "Confirm & send on WhatsApp" is the one main
// button; Mark paid, Lock, Nudge, Cancel (with a warning) and a quiet Mark collected follow.
// The customer's number and delivery address are saved on this phone only (D-059).

export type OrderDetailScreenProps = Readonly<{
  code: string;
  onBack: () => void;
}>;

const Page = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
`;
const Bar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 3.25rem;
  padding: 0 ${({ theme }) => theme.size.pagePadPhone}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Code = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  font-weight: 600;
  color: ${({ theme }) => theme.c.muted};
`;
const Scroll = styled.div`
  flex: 1;
  padding: ${({ theme }) => theme.size.pagePadPhone}px;
`;
const Foot = styled.div`
  position: sticky;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadPhone}px
    calc(${({ theme }) => theme.spacing.md} + env(safe-area-inset-bottom));
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.bg};

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
const Rows = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0 ${({ theme }) => theme.size.pagePadPhone}px ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const ActionRow = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  min-height: 3rem;
  padding: 0 ${({ theme }) => theme.spacing.xs};
  border: 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: transparent;
  color: ${({ theme, $danger }) => ($danger ? theme.c.danger : theme.c.text)};
  font: inherit;
  text-align: start;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
  svg {
    width: 1.25rem;
    height: 1.25rem;
  }
  small {
    margin-inline-start: auto;
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.875rem;
  }
`;
const Quiet = styled(Button)`
  color: ${({ theme }) => theme.c.text};
`;
const ContactBlock = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.xl};
  padding-top: ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  h3 {
    margin: 0;
    font-size: 0.9375rem;
  }
`;
const Saved = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.conf};
  font-size: 0.875rem;
`;
const Message = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.size.pagePadPhone}px;
  color: ${({ theme }) => theme.c.muted};
`;
const ErrorBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.size.pagePadPhone}px;
  color: ${({ theme }) => theme.c.danger};
`;

/** The number and address kept on this phone for this order. */
function ContactSection({ order }: Readonly<{ order: Order }>) {
  const { t } = useTranslation(SELLER_NS);
  const slug = currentSellerSlug();
  const [phone, setPhone] = useState(() => getContact(slug, order.code)?.phone ?? '');
  const [address, setAddress] = useState(() => getContact(slug, order.code)?.address ?? '');
  const [status, setStatus] = useState<'idle' | 'invalid' | 'saved' | 'volatile'>('idle');
  const onSave = useCallback(() => {
    const result = saveContact(slug, order.code, { phone, address });
    setStatus(result === 'invalid_phone' ? 'invalid' : result === 'saved' ? 'saved' : 'volatile');
    if (result !== 'invalid_phone') setPhone(getContact(slug, order.code)?.phone ?? '');
  }, [slug, order.code, phone, address]);
  const edit = (setter: (next: string) => void) => (next: string) => {
    setStatus('idle');
    setter(next);
  };
  return (
    <ContactBlock aria-label={t('contact.title')}>
      <h3>{t('contact.title')}</h3>
      <ContactFields
        phone={phone}
        address={address}
        onPhone={edit(setPhone)}
        onAddress={edit(setAddress)}
        phoneInvalid={status === 'invalid'}
        showAddress={order.fulfilment === 'delivery'}
      />
      <div>
        <Button onClick={onSave}>{t('contact.save')}</Button>
      </div>
      {status === 'saved' ? <Saved role="status">{t('contact.saved')}</Saved> : null}
      {status === 'volatile' ? <Saved role="status">{t('contact.notPersisted')}</Saved> : null}
    </ContactBlock>
  );
}

function Row({
  icon,
  label,
  hint,
  danger,
  disabled,
  onClick,
}: Readonly<{
  icon: IconName;
  label: string;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}>) {
  return (
    <ActionRow type="button" $danger={danger} disabled={disabled} onClick={onClick}>
      <Icon name={icon} />
      {label}
      {hint ? <small>{hint}</small> : null}
    </ActionRow>
  );
}

function PhoneActions({ order }: Readonly<{ order: Order }>) {
  const { t, i18n } = useTranslation(SELLER_NS);
  const a = useOrderActions(order);
  const [asking, setAsking] = useState(false);
  const confirming = a.forward.includes('confirmed');
  // Collected is the quiet button below (D-069 Q4), so it is never the main step here.
  const main = a.forward.find((status) => status !== 'collected');
  const canCollect = order.fulfilment === 'pickup' && !a.final;
  const send = useCallback(
    () => openOrderLink(i18n, order, getContactDigits(currentSellerSlug(), order.code)),
    [i18n, order],
  );
  const confirmAndSend = useCallback(() => {
    a.onStep('confirmed');
    send();
  }, [a, send]);
  return (
    <>
      {a.failed ? (
        <ErrorBox role="alert">
          <span>{t('error.change')}</span>
          <Button onClick={a.onRetry}>{t('error.retry')}</Button>
        </ErrorBox>
      ) : null}
      <Rows>
        <Row
          icon="lock"
          label={order.locked ? t('panel.unlock') : t('panel.lock')}
          hint={order.locked ? t('phone.unlockHint') : t('phone.lockHint')}
          disabled={a.saving || a.final}
          onClick={a.onLock}
        />
        <Row
          icon="bell"
          label={t('panel.nudge')}
          hint={t('phone.nudgeHint')}
          disabled={a.saving || a.final}
          onClick={a.onNudge}
        />
        {a.canCancel ? (
          <Row
            icon="x"
            label={t('detail.cancel')}
            danger
            disabled={a.saving}
            onClick={() => setAsking(true)}
          />
        ) : null}
      </Rows>
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
      <Foot>
        {confirming ? (
          <Button variant="primary" fullWidth disabled={a.saving} onClick={confirmAndSend}>
            <Icon name="chat" />
            {t('phone.confirmSend')}
          </Button>
        ) : main ? (
          <Button variant="primary" fullWidth disabled={a.saving} onClick={() => a.onStep(main)}>
            <Icon name="check" />
            {t(`detail.action.${main}`)}
          </Button>
        ) : null}
        <Pair>
          {confirming ? (
            <Button disabled={a.saving} onClick={() => a.onStep('confirmed')}>
              <Icon name="check" />
              {t('phone.confirmOnly')}
            </Button>
          ) : (
            <Button onClick={send}>
              <Icon name="chat" />
              {t('detail.sendLink')}
            </Button>
          )}
          <Button disabled={a.saving} onClick={() => a.setPaid(!order.paid)}>
            <Icon name="coin" />
            {order.paid ? t('detail.markUnpaid') : t('detail.markPaid')}
          </Button>
        </Pair>
        {canCollect ? (
          <Quiet variant="quiet" fullWidth disabled={a.saving} onClick={a.onCollected}>
            {t('detail.action.collected')}
          </Quiet>
        ) : null}
      </Foot>
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

  return (
    <Page>
      <FeedbackHost />
      <Bar>
        <Button variant="quiet" onClick={onBack}>
          {t('detail.back')}
        </Button>
        {order ? <Code>{formatOrderCode(order.code)}</Code> : null}
      </Bar>
      <Scroll>
        {order ? (
          <>
            <OrderPanelBody order={order} />
            <ContactSection key={order.code} order={order} />
          </>
        ) : null}
        {!order && list.status === 'loading' ? (
          <Message role="status">{t('detail.loading')}</Message>
        ) : null}
        {!order && list.status === 'error' ? (
          <ErrorBox role="alert">
            <span>{t('error.load')}</span>
            <Button onClick={retry}>{t('error.retry')}</Button>
          </ErrorBox>
        ) : null}
        {!order && list.status === 'ready' ? <Message>{t('detail.notFound')}</Message> : null}
      </Scroll>
      {order ? <PhoneActions order={order} /> : null}
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
