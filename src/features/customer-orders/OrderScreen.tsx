import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import type { CustomerOrder } from '../../../shared/domain';
import { setKitchenBrand } from '../../theme/kitchenBrand';
import { markInboxSeen, readMyOrders } from '../../api/device/myOrders';
import { buildWhatsAppText, whatsAppUrl } from '../../api/device/whatsapp';
import { ArchivedOrderView, EarlierOrderView } from './ClosedOrderViews';
import { ORDERS_NS } from './i18n/register';
import { OfflineNote, Page, ScreenBoundary, StateMessage, isOffline, useLang } from './layout';
import { OrderPageView } from './OrderPageView';
import { orderInfo } from './orderInfo';
import { OrderQrView } from './OrderQrView';
import { selectCancel, selectCollect, selectMenus, selectOrderPage } from './selectors';
import {
  cancelRequested,
  collectRequested,
  orderRefreshRequested,
  orderRequested,
  type FailureCode,
} from './slice';

/** How often the open order page reloads. Replaced by push / live updates in phase 4-5. */
export const POLL_MS = 15_000;

function cancelErrorKey(code: FailureCode): string {
  switch (code) {
    case 'order_locked':
    case 'ordering_closed':
    case 'cutoff_passed':
    case 'week_closed':
      return `order.errors.${code}`;
    default:
      return 'order.errors.other';
  }
}

/** Loads the order on arrival (what My orders knew may be old) and, optionally, keeps it fresh. */
function useOrderPage(token: string, poll: boolean) {
  const dispatch = useDispatch();
  const page = useSelector(selectOrderPage);
  const load = useCallback(() => {
    dispatch(orderRequested(token));
  }, [dispatch, token]);
  useEffect(load, [load]);
  useEffect(() => {
    if (!poll) return undefined;
    const timer = window.setInterval(() => {
      dispatch(orderRefreshRequested(token));
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [dispatch, token, poll]);
  const order = page.status === 'ready' && page.order.token === token ? page.order : null;
  return { page, order, load };
}

/** The kitchen's colours (D-064) once its menu is known. */
function useKitchenBrand(slug: string | undefined) {
  const menu = useSelector(selectMenus)[slug ?? ''];
  const theme = menu?.theme ?? 'onde';
  useEffect(() => {
    setKitchenBrand(theme);
  }, [theme]);
  return menu;
}

type BodyProps = Readonly<{
  order: CustomerOrder;
  onBack: () => void;
  onChange: (token: string) => void;
  onShowQr: (token: string) => void;
  onOpenMenu: (slug: string) => void;
}>;

function OrderBody({ order, onBack, onChange, onShowQr, onOpenMenu }: BodyProps) {
  const { i18n, t } = useTranslation(ORDERS_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const menu = useKitchenBrand(order.seller.slug);
  const cancel = useSelector(selectCancel);
  const collect = useSelector(selectCollect);
  const [cancelOpen, setCancelOpen] = useState(false);

  const info = orderInfo(order, menu, lang);
  const token = order.token;

  const waText = buildWhatsAppText(
    order,
    i18n.getFixedT(order.language, ORDERS_NS),
    // The message is in the order's own language, so its date and time are too.
    order.fulfilment === 'pickup' ? orderInfo(order, menu, order.language).whenText : null,
  );
  const openWhatsApp = useCallback(() => {
    window.open(whatsAppUrl(waText, info.whatsappNumber), '_blank', 'noopener,noreferrer');
  }, [waText, info.whatsappNumber]);

  const doCancel = useCallback(() => {
    setCancelOpen(false);
    dispatch(cancelRequested(token));
  }, [dispatch, token]);
  const doCollect = useCallback(() => dispatch(collectRequested(token)), [dispatch, token]);
  const slug = order.seller.slug;
  const toMenu = useCallback(() => onOpenMenu(slug), [onOpenMenu, slug]);

  if (order.archived === true) {
    return (
      <EarlierOrderView
        order={order}
        menu={menu}
        lang={lang}
        paid={order.paid}
        onBack={onBack}
        onOpenMenu={toMenu}
      />
    );
  }
  return (
    <OrderPageView
      order={order}
      menu={menu}
      lang={lang}
      paid={order.paid}
      cancelOpen={cancelOpen}
      cancelling={cancel.status === 'submitting'}
      collecting={collect.status === 'submitting'}
      cancelError={cancel.status === 'failed' ? t(cancelErrorKey(cancel.code)) : undefined}
      collectError={collect.status === 'failed'}
      onBack={onBack}
      onShowQr={() => onShowQr(token)}
      onChange={() => onChange(token)}
      onAskCancel={() => setCancelOpen(true)}
      onKeepOrder={() => setCancelOpen(false)}
      onCancel={doCancel}
      onCollect={doCollect}
      onWhatsApp={openWhatsApp}
    />
  );
}

type Props = Readonly<{
  /** The order's private token (from My orders, or the link the seller sent). */
  token: string;
  /** Back to My orders. */
  onBack: () => void;
  /** Open the basket in edit mode for this order. */
  onChange: (token: string) => void;
  /** Open the full-screen QR. */
  onShowQr?: (token: string) => void;
  /** Open the kitchen's current menu. */
  onOpenMenu?: (slug: string) => void;
}>;

const toMenuByLink = (slug: string) => window.location.assign(`/${encodeURIComponent(slug)}`);

function OrderContent({ token, onBack, onChange, onShowQr = () => undefined, onOpenMenu }: Props) {
  const { t } = useTranslation(ORDERS_NS);
  const lang = useLang();
  const { page, order, load } = useOrderPage(token, true);
  const openMenu = onOpenMenu ?? toMenuByLink;

  // Seen: viewing the order clears its dot on My orders.
  useEffect(() => {
    if (order !== null) markInboxSeen(order);
  }, [order]);

  return (
    <Page>
      {order !== null && page.status === 'ready' && page.stale !== undefined ? (
        <OfflineNote offline={isOffline(page.stale)} onRetry={load} />
      ) : null}
      {order !== null ? (
        <OrderBody
          order={order}
          onBack={onBack}
          onChange={onChange}
          onShowQr={onShowQr}
          onOpenMenu={openMenu}
        />
      ) : page.status === 'expired' && page.order.token === token ? (
        <ExpiredContent
          order={page.order}
          code={readMyOrders().find((entry) => entry.token === token)?.code}
          lang={lang}
          onBack={onBack}
          onOpenMenu={openMenu}
        />
      ) : page.status === 'error' ? (
        <StateMessage alert text={t('order.loadError')} onRetry={load} />
      ) : (
        <StateMessage text={t('common.loading')} />
      )}
    </Page>
  );
}

function ExpiredContent({
  order,
  code,
  lang,
  onBack,
  onOpenMenu,
}: Readonly<{
  order: Extract<ReturnType<typeof selectOrderPage>, { status: 'expired' }>['order'];
  code?: string;
  lang: 'en' | 'id';
  onBack: () => void;
  onOpenMenu: (slug: string) => void;
}>) {
  const menu = useKitchenBrand(order.seller.slug);
  // No menu is loaded for a closed week (D-044): the logo shows only if the store already has it.
  return (
    <ArchivedOrderView
      order={order}
      code={code}
      kitchenName={menu?.kitchen.name ?? order.seller.name}
      logoSrc={menu?.kitchen.images?.railImage ?? undefined}
      lang={lang}
      onBack={onBack}
      onOpenMenu={() => onOpenMenu(order.seller.slug)}
    />
  );
}

export function OrderScreen(props: Props) {
  return (
    <ScreenBoundary>
      <OrderContent {...props} />
    </ScreenBoundary>
  );
}

/** order-qr: the full-screen code to show at pickup. */
function QrContent({ token, onBack }: Readonly<{ token: string; onBack: () => void }>) {
  const { t } = useTranslation(ORDERS_NS);
  const lang = useLang();
  const { page, order, load } = useOrderPage(token, false);
  const menu = useKitchenBrand(order?.seller.slug);
  return (
    <Page>
      {order !== null ? (
        <OrderQrView order={order} menu={menu} lang={lang} onBack={onBack} />
      ) : page.status === 'error' || page.status === 'expired' ? (
        <StateMessage alert text={t('order.loadError')} onRetry={load} />
      ) : (
        <StateMessage text={t('common.loading')} />
      )}
    </Page>
  );
}

export function OrderQrScreen(props: Readonly<{ token: string; onBack: () => void }>) {
  return (
    <ScreenBoundary>
      <QrContent {...props} />
    </ScreenBoundary>
  );
}
