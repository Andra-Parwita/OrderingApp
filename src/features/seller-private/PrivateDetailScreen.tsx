import type { i18n as I18n } from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { styled } from 'styled-components';
import { addressLine } from '../../../shared/address';
import { formatCookingDate } from '../../../shared/dates';
import type { SellerOrder } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { nextStatuses } from '../../../shared/status';
import { pickText } from '../../../shared/text';
import { Button, Icon, PageHeader, Pill, WarningDialog } from '../../ui';
import { PRIVATE_NS } from './i18n/register';
import { orderStillToPay, readableAddress, stepIndex, stepsFor, toneOf, totalCents } from './model';
import { AddressLinks, Card, ErrorLine, Muted, Page, useLang } from './privateShared';
import {
  actionCleared,
  cancelRequested,
  detailClosed,
  detailOpened,
  refreshRequested,
  statusRequested,
  type PrivateRootState,
} from './privateSlice';
import { usePrivatePolling } from './usePrivateDue';

// Plan 081: one private order. Everyone on the team sees it and moves its status; only an owner
// edits or cancels it (the server holds the same line).

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};

  .code {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .pill {
    margin-left: auto;
  }
`;
const Steps = styled.ol`
  display: flex;
  margin: ${({ theme }) => theme.spacing.xs} 0 0;
  padding: 0;
  list-style: none;

  li {
    position: relative;
    flex: 1;
    padding-top: 1.5rem;
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.75rem;
    text-align: center;
  }
  li::before {
    content: '';
    position: absolute;
    top: 0.4375rem;
    left: 50%;
    z-index: 1;
    width: 0.75rem;
    height: 0.75rem;
    transform: translateX(-50%);
    border: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.ctrl};
    border-radius: 50%;
    background: ${({ theme }) => theme.c.surf};
  }
  li::after {
    content: '';
    position: absolute;
    top: 0.75rem;
    left: -50%;
    width: 100%;
    height: ${({ theme }) => theme.border.focus};
    background: ${({ theme }) => theme.c.line};
  }
  li:first-child::after {
    display: none;
  }
  li[data-state='done']::before {
    border-color: ${({ theme }) => theme.c.fill};
    background: ${({ theme }) => theme.c.fill};
  }
  li[data-state='done']::after,
  li[data-state='current']::after {
    background: ${({ theme }) => theme.c.fill};
  }
  li[data-state='current'] {
    color: ${({ theme }) => theme.c.text};
    font-weight: 700;
  }
  li[data-state='current']::before {
    border-color: ${({ theme }) => theme.c.fill};
  }
`;
const Facts = styled.dl`
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr);
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  margin: 0;
  font-size: 0.9375rem;

  dt {
    padding-top: 0.125rem;
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
  }
  dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
`;
const Items = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.xs} 0;
    border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
    font-variant-numeric: tabular-nums;
  }
  li:last-child {
    border-bottom: 0;
  }
  .qty {
    min-width: 2.2rem;
    font-weight: 700;
  }
  .name {
    flex: 1;
  }
  .each {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
  }
  .sum {
    min-width: 3.5rem;
    font-weight: 600;
    text-align: right;
  }
`;
const Totals = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding-top: ${({ theme }) => theme.spacing.sm};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-variant-numeric: tabular-nums;

  div {
    display: flex;
    justify-content: space-between;
  }
  .total {
    font-weight: 700;
  }
  .still {
    color: ${({ theme }) => theme.c.warn};
    font-weight: 700;
  }
  .ok {
    color: ${({ theme }) => theme.c.atext};
    font-weight: 700;
  }
`;
const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Two = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export function PrivateDetailScreen({
  code,
  canEdit,
  openOrderLink,
}: Readonly<{
  code: string;
  canEdit: boolean;
  /** Opens WhatsApp with the order link (the orders feature's, passed in by the app). */
  openOrderLink: (i18n: I18n, order: SellerOrder) => void;
}>) {
  const { t, i18n } = useTranslation(PRIVATE_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { detail, load, action } = useSelector((state: PrivateRootState) => state.sellerPrivate);
  const [asking, setAsking] = useState(false);
  const [copied, setCopied] = useState(false);
  const pageRef = useRef<HTMLElement | null>(null);
  usePrivatePolling();
  const shown = detail?.code === code;
  // The screen scrolls inside the seller shell: open at the top (the editor leaves it scrolled).
  useEffect(() => {
    for (let node = pageRef.current?.parentElement; node; node = node.parentElement) {
      if (node.scrollTop > 0) node.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, [code, shown]);
  useEffect(() => {
    dispatch(detailOpened(code));
    return () => {
      dispatch(detailClosed());
      dispatch(actionCleared());
    };
  }, [dispatch, code]);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const order = detail && detail.code === code ? detail : null;
  const back = () => void navigate('/seller/private');
  const header = <PageHeader title={t('detail.title')} backLabel={t('back')} onBack={back} />;
  if (!order) {
    return (
      <>
        {header}
        <Page>
          {load === 'error' ? (
            <Card>
              <ErrorLine role="alert">{t('detail.notFound')}</ErrorLine>
              <div>
                <Button onClick={() => dispatch(refreshRequested())}>{t('retry')}</Button>
              </div>
            </Card>
          ) : (
            <Muted role="status">{t('loading')}</Muted>
          )}
        </Page>
      </>
    );
  }

  const cancelled = order.status === 'cancelled';
  const forward = nextStatuses(order).find((status) => status !== 'cancelled');
  const canCancel = canEdit && nextStatuses(order).includes('cancelled');
  const total = totalCents(order);
  const deposit = order.private?.depositCents ?? 0;
  const still = orderStillToPay(order);
  const address = readableAddress(order);
  const current = stepIndex(order);
  const eventDate = order.private?.eventDate;
  const when = [eventDate ? formatCookingDate(eventDate, lang) : '', order.private?.eventTime ?? '']
    .filter((part) => part !== '')
    .join(', ');
  const failed = action.status === 'error' ? action : null;

  const copy = () => {
    void navigator.clipboard
      ?.writeText(formatOrderCode(order.code))
      .then(() => setCopied(true))
      .catch(() => undefined);
  };

  return (
    <>
      {header}
      <Page ref={pageRef}>
        <Card>
          <Head>
            <span className="code">{formatOrderCode(order.code)}</span>
            <span className="pill">
              <Pill tone={toneOf(order.status)}>{t(`status.${order.status}`)}</Pill>
            </span>
          </Head>
          <Muted>{t('detail.code')}</Muted>
          {cancelled ? null : (
            <Steps aria-label={t('detail.steps')}>
              {stepsFor(order.fulfilment).map((status, index) => (
                <li
                  key={status}
                  data-state={index < current ? 'done' : index === current ? 'current' : 'next'}
                  aria-current={index === current ? 'step' : undefined}
                >
                  {t(`status.${status}`)}
                </li>
              ))}
            </Steps>
          )}
        </Card>

        <Card>
          <Facts>
            <dt>{t('detail.customer')}</dt>
            <dd>
              <b>{order.firstName}</b>
            </dd>
            <dt>{t('detail.when')}</dt>
            <dd>
              {when} · {t(order.fulfilment)}
            </dd>
            {order.fulfilment === 'delivery' ? (
              <>
                <dt>{t('detail.deliverTo')}</dt>
                <dd>
                  {address ? (
                    <>
                      {addressLine(address)}
                      {address.notes ? (
                        <>
                          <br />
                          <Muted as="span">{address.notes}</Muted>
                        </>
                      ) : null}
                      {cancelled ? null : <AddressLinks address={address} />}
                    </>
                  ) : (
                    <Muted as="span">{t('detail.noAddress')}</Muted>
                  )}
                </dd>
              </>
            ) : null}
            {order.note ? (
              <>
                <dt>{t('detail.note')}</dt>
                <dd>{order.note}</dd>
              </>
            ) : null}
          </Facts>
        </Card>

        <Card aria-label={t('detail.items')}>
          <Items>
            {order.lines.map((line) => (
              <li key={line.itemId}>
                <span className="qty">{line.qty}×</span>
                <span className="name">{pickText(line.name, lang)}</span>
                <span className="each">{formatMoney(line.priceCents, lang)}</span>
                <span className="sum">{formatMoney(line.priceCents * line.qty, lang)}</span>
              </li>
            ))}
          </Items>
          <Totals>
            <div className="total">
              <span>{t('detail.total')}</span>
              <span>{formatMoney(total, lang)}</span>
            </div>
            {cancelled ? null : order.paid ? (
              <div className="ok">
                <span>{t('detail.paidInFull')}</span>
                <span>{formatMoney(total, lang)}</span>
              </div>
            ) : (
              <>
                {deposit > 0 ? (
                  <div>
                    <span>{t('detail.deposit')}</span>
                    <span>{formatMoney(deposit, lang)}</span>
                  </div>
                ) : null}
                {still > 0 ? (
                  <div className="still">
                    <span>{t('detail.still')}</span>
                    <span>{formatMoney(still, lang)}</span>
                  </div>
                ) : (
                  <div className="ok">
                    <span>{t('detail.nothingToPay')}</span>
                  </div>
                )}
              </>
            )}
          </Totals>
        </Card>

        {failed ? <ErrorLine role="alert">{t('detail.actionError')}</ErrorLine> : null}
        <Actions>
          {forward ? (
            <Button
              variant="primary"
              fullWidth
              disabled={action.status === 'saving'}
              onClick={() => dispatch(statusRequested({ code: order.code, to: forward }))}
            >
              {t('detail.next', { status: t(`status.${forward}`) })}
            </Button>
          ) : null}
          {cancelled ? null : (
            <Button fullWidth onClick={() => openOrderLink(i18n, order)}>
              <Icon name="chat" />
              {t('detail.send')}
            </Button>
          )}
          <Two>
            <Button onClick={copy}>{copied ? t('detail.copied') : t('detail.copy')}</Button>
            {canEdit && !cancelled ? (
              <Button onClick={() => void navigate(`/seller/private/${order.code}/edit`)}>
                <Icon name="pencil" />
                {t('detail.edit')}
              </Button>
            ) : null}
          </Two>
          {canCancel ? (
            <Button variant="destructive" fullWidth onClick={() => setAsking(true)}>
              {t('detail.cancelOrder')}
            </Button>
          ) : null}
        </Actions>
      </Page>
      {asking ? (
        <WarningDialog
          title={t('detail.askTitle', { name: order.firstName })}
          cancelLabel={t('detail.askKeep')}
          continueLabel={t('detail.askGo')}
          onCancel={() => setAsking(false)}
          onContinue={() => {
            setAsking(false);
            dispatch(cancelRequested(order.code));
          }}
        >
          {t('detail.askBody')}
        </WarningDialog>
      ) : null}
    </>
  );
}
