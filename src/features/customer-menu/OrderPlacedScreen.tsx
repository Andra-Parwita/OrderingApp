import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { CustomerOrder, Language } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import { formatCookingDate, formatWindow } from '../../../shared/dates';
import { formatOrderCode } from '../../../shared/orderCode';
import { isReturningCustomer } from '../../api/device/myOrders';
import { buildWhatsAppText, whatsAppUrl } from '../../api/device/whatsapp';
import { PageTopBar } from '../../components/CustomerPage';
import {
  InstallOverlay,
  UpdatesCard,
  useOrderInstall,
  type InstallOverride,
} from '../../components/install';
import { OrderQr } from '../../components/OrderQr';
import { orderCodeLabel } from '../../components/orderCodeLabel';
import { setKitchenBrand } from '../../theme/kitchenBrand';
import { Icon } from '../../ui';
import { menuRequested, orderRequested } from './customerSlice';
import { CUSTOMER_NS } from './i18n/register';
import { Page, StateMessage, useLang } from './layout';
import { MenuIcon } from './menuIcons';
import { MainButton } from './menuParts';
import { ScreenBoundary } from './ScreenBoundary';
import { selectMenu, selectMenuSlug, selectOrder } from './selectors';

// "Order placed" (spec §4.3): the code with a small QR, Send on WhatsApp, the optional updates
// card and two links. The full-screen QR and the order page are separate routes.

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.lg}
    calc(var(--customer-tabbar-height, 0rem) + var(--sab) + ${({ theme }) => theme.spacing.xl});
`;
const Heading = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  text-align: center;

  h1 {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    margin: 0;
    font-size: ${({ theme }) => theme.type.size.xl};
    line-height: 1.2;
    font-weight: 700;
    color: ${({ theme }) => theme.c.conf};
  }
  p {
    margin: 0;
    color: ${({ theme }) => theme.c.muted};
  }
`;
const Tick = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: ${({ theme }) => theme.border.focus} solid currentColor;
  border-radius: 50%;
`;
const CodeCard = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  padding: ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: 1.25rem;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  text-align: left;
  cursor: pointer;

  svg {
    border-radius: ${({ theme }) => theme.radius.sm};
  }
`;
const CodeText = styled.span`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};

  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: ${({ theme }) => theme.type.size.sm};
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  b {
    font-family: ${({ theme }) => theme.font.mono};
    font-size: 2rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    line-height: 1.1;
  }
  span {
    display: inline-flex;
    align-items: center;
    color: ${({ theme }) => theme.c.atext};
    font-weight: 700;
  }
`;
const Help = styled.p`
  margin: 0;
  text-align: center;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Links = styled.div`
  display: flex;
  justify-content: space-between;
`;
const LinkButton = styled.button<{ $quiet?: boolean }>`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0;
  border: 0;
  background: none;
  color: ${({ theme, $quiet }) => ($quiet ? theme.c.muted : theme.c.atext)};
  font: inherit;
  font-weight: 600;
  cursor: pointer;
`;

type ViewProps = Readonly<{
  order: CustomerOrder;
  /** The kitchen's menu once loaded; the page works without it. */
  menu: MenuResponse | undefined;
  /** A customer who has ordered before can skip the WhatsApp message (D-027). */
  returning: boolean;
  onWhatsApp: () => void;
  onShowQr: () => void;
  onViewOrder: () => void;
  onChange: () => void;
  /** Fixtures and tests: fix what the install and notification flow detects. */
  install?: InstallOverride;
}>;

export function OrderPlacedView({
  order,
  menu,
  returning,
  onWhatsApp,
  onShowQr,
  onViewOrder,
  onChange,
  install: installOverride,
}: ViewProps) {
  const { t } = useTranslation(CUSTOMER_NS);
  const install = useOrderInstall(order.token, installOverride);
  const cook = menu?.seller.name ?? order.seller.name;
  const code = formatOrderCode(order.code);
  return (
    <>
      <PageTopBar
        kitchenName={menu?.kitchen.name ?? order.seller.name}
        logoSrc={menu?.kitchen.images?.railImage ?? undefined}
      />
      <Body>
        <Heading>
          <h1>
            <Tick>
              <Icon name="check" />
            </Tick>
            {t('placed.title')}
          </h1>
          <p>{t('placed.thanks', { name: order.firstName, cook })}</p>
        </Heading>
        <CodeCard type="button" onClick={onShowQr} data-testid="code-card">
          <CodeText>
            <small>{t('placed.orderNumber')}</small>
            <b role="img" aria-label={orderCodeLabel(order.code)} data-testid="order-code">
              {code}
            </b>
            <span>{t('placed.showQr')} ›</span>
          </CodeText>
          <OrderQr code={order.code} size={88} label={t('placed.qrAlt', { code })} />
        </CodeCard>
        <div>
          <MainButton type="button" onClick={onWhatsApp}>
            <MenuIcon name="chat" />
            {t('placed.whatsapp', { cook })}
          </MainButton>
          <Help>{returning ? t('placed.optional') : t('placed.whatsappHelp')}</Help>
        </div>
        <UpdatesCard controller={install} />
        <Links>
          <LinkButton type="button" onClick={onViewOrder}>
            {t('placed.viewOrder')}
          </LinkButton>
          <LinkButton type="button" $quiet onClick={onChange}>
            {t('placed.change')}
          </LinkButton>
        </Links>
        <Help>{t('placed.saved')}</Help>
      </Body>
      <InstallOverlay
        controller={install}
        kitchenName={menu?.kitchen.name ?? order.seller.name}
        iconSrc={menu?.kitchen.images?.railIcon}
        code={code}
        backLabel={t('placed.title')}
      />
    </>
  );
}

type Props = Readonly<{
  /** The order's private token (from the order link, or from placing the order). */
  token: string;
  /** Opens "Change or cancel": the order page, where both live. */
  onChange: () => void;
  /** Opens the order page ("View order details"). */
  onViewOrder?: () => void;
  /** Opens the full-screen QR. */
  onShowQr?: () => void;
  /** Kept for the old route wiring; the placed page has no back arrow (spec §4.3). */
  onBack?: () => void;
}>;

function PlacedBody({
  order,
  onChange,
  onViewOrder,
  onShowQr,
}: Readonly<{
  order: CustomerOrder;
  onChange: () => void;
  onViewOrder: () => void;
  onShowQr: () => void;
}>) {
  const { i18n } = useTranslation(CUSTOMER_NS);
  const lang: Language = useLang();
  const loadedMenu = useSelector(selectMenu);
  // Another seller's menu (still on screen from before) must not give this order its pickup.
  const menu =
    loadedMenu.status === 'ready' && loadedMenu.data.seller.slug === order.seller.slug
      ? loadedMenu.data
      : undefined;

  // The kitchen's colours (D-064).
  const theme = menu ? (menu.theme ?? 'onde') : undefined;
  useEffect(() => {
    if (theme !== undefined) setKitchenBrand(theme);
  }, [theme]);

  const points = menu?.week.pickupPoints ?? [];
  // The place the customer chose; an order without one counts as the menu's first.
  const pickup = points.find((point) => point.id === order.pickupPlaceId) ?? points[0];
  const dayText = menu ? formatCookingDate(menu.week.cookingDate, lang) : null;
  const when =
    dayText && pickup
      ? `${dayText}, ${formatWindow(pickup.window.start, pickup.window.end, lang)}`
      : null;
  // The message is in the customer's language (the one the order was placed in).
  const waText = buildWhatsAppText(order, i18n.getFixedT(order.language, CUSTOMER_NS), when);
  const whatsappNumber = menu?.kitchen.whatsappNumber;
  const openWhatsApp = useCallback(() => {
    window.open(whatsAppUrl(waText, whatsappNumber), '_blank', 'noopener,noreferrer');
  }, [waText, whatsappNumber]);
  const [returning] = useState(() => isReturningCustomer(order.seller.slug));

  return (
    <OrderPlacedView
      order={order}
      menu={menu}
      returning={returning}
      onWhatsApp={openWhatsApp}
      onShowQr={onShowQr}
      onViewOrder={onViewOrder}
      onChange={onChange}
    />
  );
}

function PlacedContent({ token, onChange, onViewOrder, onShowQr }: Props) {
  const { t } = useTranslation(CUSTOMER_NS);
  const dispatch = useDispatch();
  const order = useSelector(selectOrder);

  const loaded = order.status === 'ready' && order.order.token === token;
  const load = useCallback(() => {
    dispatch(orderRequested(token));
  }, [dispatch, token]);
  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  // The pickup date and time come from the menu; it is only needed when it is not loaded yet.
  const menuSlug = useSelector(selectMenuSlug);
  const orderSlug = loaded ? order.order.seller.slug : undefined;
  useEffect(() => {
    if (orderSlug !== undefined && orderSlug !== menuSlug) dispatch(menuRequested(orderSlug));
  }, [dispatch, orderSlug, menuSlug]);

  return (
    <Page>
      {order.status === 'ready' && loaded ? (
        <PlacedBody
          order={order.order}
          onChange={onChange}
          onViewOrder={onViewOrder ?? onChange}
          onShowQr={onShowQr ?? onChange}
        />
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
