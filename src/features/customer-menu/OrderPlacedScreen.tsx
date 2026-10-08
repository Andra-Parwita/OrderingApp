import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Order, OrderStatus } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { pickText } from '../../../shared/text';
import type { StatusTone } from '../../theme/tokens';
import { Button, Pill } from '../../ui';
import { menuRequested, orderRequested } from './customerSlice';
import { formatCookingDate, formatWindow } from '../../../shared/dates';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { CUSTOMER_NS } from './i18n/register';
import { Block, Muted, Page, StateMessage, Strong, Title, TopBar, useLang } from './layout';
import { ScreenBoundary } from './ScreenBoundary';
import { selectMenu, selectOrder } from './selectors';
import { buildWhatsAppText, whatsAppUrl } from './whatsapp';

const Code = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.lg};
  text-align: center;
  font-size: ${({ theme }) => theme.type.size.xl};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  letter-spacing: ${({ theme }) => theme.spacing.xs};
`;

const Qr = styled.div`
  align-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(${({ theme }) => theme.minTapTarget} * 3);
  height: calc(${({ theme }) => theme.minTapTarget} * 3);
  background: ${({ theme }) => theme.colour.surface};
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.sm};
  text-align: center;
`;

const Lines = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Line = styled.li`
  display: flex;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing.xs} 0;
`;

const Total = styled(Line)`
  margin-top: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

const Centered = styled(Muted)`
  text-align: center;
`;

function toneOf(status: OrderStatus): StatusTone {
  switch (status) {
    case 'ordered':
      return 'ordered';
    case 'confirmed':
      return 'confirmed';
    case 'ready_for_pickup':
      return 'ready';
    case 'out_for_delivery':
      return 'outForDelivery';
    case 'collected':
    case 'delivered':
      return 'done';
    case 'cancelled':
      return 'cancelled';
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

type Props = Readonly<{
  /** The order's private token (from the order link, or from placing the order). */
  token: string;
  /** Opens "Change or cancel" (batch 2); a no-op until then. */
  onChange: () => void;
}>;

function PlacedBody({ order, onChange }: Readonly<{ order: Order; onChange: () => void }>) {
  const { t, i18n } = useTranslation(CUSTOMER_NS);
  const lang = useLang();
  const menu = useSelector(selectMenu);

  const pickup = menu.status === 'ready' ? menu.data.week.pickupPoints[0] : undefined;
  const dayText =
    menu.status === 'ready' ? formatCookingDate(menu.data.week.cookingDate, lang) : null;
  const when =
    dayText && pickup
      ? `${dayText}, ${formatWindow(pickup.window.start, pickup.window.end, lang)}`
      : null;
  // The message is in the customer's language (the one the order was placed in).
  const waText = buildWhatsAppText(order, i18n.getFixedT(order.language, CUSTOMER_NS), when);
  const openWhatsApp = useCallback(() => {
    window.open(whatsAppUrl(waText), '_blank', 'noopener,noreferrer');
  }, [waText]);

  const totalCents = order.lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0);
  const how = order.fulfilment === 'delivery' ? t('placed.delivery') : t('placed.pickup');

  return (
    <>
      <Block>
        <Centered>{t('placed.yourNumber')}</Centered>
        <Code data-testid="order-code">{formatOrderCode(order.code)}</Code>
        <Qr>{t('placed.qrLabel')}</Qr>
      </Block>
      <Block>
        <Lines>
          {order.lines.map((line) => (
            <Line key={line.itemId}>
              <span>
                {line.qty}× {pickText(line.name, lang)}
              </span>
              <Strong>{formatMoney(line.priceCents * line.qty, lang)}</Strong>
            </Line>
          ))}
          <Total>
            <span>{t('placed.total')}</span>
            <span>{formatMoney(totalCents, lang)}</span>
          </Total>
        </Lines>
        <Muted>
          {[how, when].filter(Boolean).join(' · ')} ·{' '}
          <Pill tone={toneOf(order.status)}>{t(`status.${order.status}`)}</Pill>
        </Muted>
        {order.note ? <Muted>{t('placed.note', { note: order.note })}</Muted> : null}
      </Block>
      <Block>
        <Button variant="primary" fullWidth onClick={openWhatsApp}>
          {t('placed.whatsapp')}
        </Button>
        <Button fullWidth disabled>
          {t('placed.updates')} ({t('placed.comingSoon')})
        </Button>
        <Centered>{t('placed.saved')}</Centered>
        <Button variant="quiet" fullWidth onClick={onChange}>
          {t('placed.change')}
        </Button>
      </Block>
    </>
  );
}

function PlacedContent({ token, onChange }: Props) {
  const { t } = useTranslation(CUSTOMER_NS);
  const dispatch = useDispatch();
  const order = useSelector(selectOrder);
  const menu = useSelector(selectMenu);

  const loaded = order.status === 'ready' && order.order.token === token;
  const load = useCallback(() => {
    dispatch(orderRequested(token));
  }, [dispatch, token]);
  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  // The pickup date and time come from the menu; it is only needed when it is not loaded yet.
  const menuIdle = menu.status === 'idle';
  useEffect(() => {
    if (menuIdle) dispatch(menuRequested());
  }, [dispatch, menuIdle]);

  return (
    <Page>
      <TopBar>
        <Title>{t('placed.title')}</Title>
        <LanguageSwitch />
      </TopBar>
      {order.status === 'ready' && loaded ? (
        <PlacedBody order={order.order} onChange={onChange} />
      ) : order.status === 'error' ? (
        <StateMessage alert text={t('placed.loadError')} onRetry={load} />
      ) : (
        <StateMessage text={t('common.loading')} />
      )}
    </Page>
  );
}

export function OrderPlacedScreen(props: Props) {
  return (
    <ScreenBoundary>
      <PlacedContent {...props} />
    </ScreenBoundary>
  );
}
