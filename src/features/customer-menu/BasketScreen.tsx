import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector, useStore } from 'react-redux';
import {
  addressForRequest,
  addressLine,
  isAddressComplete,
  type DeliveryAddress,
} from '../../../shared/address';
import type { Fulfilment } from '../../../shared/domain';
import { savedAddress } from '../../api/device/address';
import { savedFirstName } from '../../api/device/firstName';
import { setKitchenBrand } from '../../theme/kitchenBrand';
import { PageHeader } from '../../ui';
import { AddressSection } from './AddressSection';
import {
  BasketView,
  EmptyBasketView,
  fulfilmentOptions,
  PickupPlaceView,
  YourNameView,
  type ClosedReason,
} from './CheckoutViews';
import {
  checkoutSet,
  editCleared,
  editRequested,
  menuRequested,
  placeRequested,
  placeReset,
  quantitySet,
  updateRequested,
  type CustomerRootState,
  type FailureCode,
} from './customerSlice';
import { CUSTOMER_NS } from './i18n/register';
import { Page, StateMessage, useLang } from './layout';
import { ScreenBoundary } from './ScreenBoundary';
import {
  selectBasketCount,
  selectBasketLines,
  selectBasketTotalCents,
  selectCheckout,
  selectEdit,
  selectMenu,
  selectMenuSlug,
  selectNotices,
  selectPlace,
  selectUpdate,
} from './selectors';

// The checkout flow (spec §4.2) as three routed pages: the basket, the pickup place and your name.
// They share their fields through the store (`checkout`), so Back and Next lose nothing. The
// presentational views are in CheckoutViews.tsx (the fixtures page feeds the same ones).

export type CheckoutStep = 'basket' | 'pickup' | 'name';

/** Failures that mean "the basket or the menu moved": the basket page says what changed. */
const BASKET_PROBLEMS: ReadonlyArray<FailureCode> = [
  'sold_out',
  'exceeds_remaining',
  'cutoff_passed',
  'ordering_closed',
  'kitchen_closed',
];

function otherErrorKey(
  code: FailureCode,
  fulfilment: Fulfilment,
  offered: ReadonlyArray<Fulfilment>,
): string {
  if (code === 'order_locked') return 'basket.errors.order_locked';
  if (code === 'fulfilment_unavailable') {
    // Say which one is missing when the menu on screen tells us.
    return offered.includes(fulfilment)
      ? 'basket.errors.fulfilment_unavailable'
      : `basket.errors.fulfilment_unavailable_${fulfilment}`;
  }
  return 'basket.errors.other';
}

const noop = () => undefined;

type Props = Readonly<{
  /** The seller whose menu this basket is for (from the route); an edited order uses its own. */
  slug?: string;
  step?: CheckoutStep;
  /** Back one page (the dishes, the basket or, when changing an order, the order). */
  onBack: () => void;
  /** Basket: on to "your name". */
  onNext?: () => void;
  /** Basket: open the pickup place page. */
  onChangePlace?: () => void;
  /** Your name: a basket problem came back from the server; go and show it on the basket. */
  onToBasket?: () => void;
  onPlaced: (token: string) => void;
  /** Change-order mode: the private token of the order being changed (loaded by EditOrderFlow). */
  editToken?: string;
  /** Change-order mode: called once the change is saved. */
  onUpdated?: (token: string) => void;
}>;

let pendingClear: ReturnType<typeof setTimeout> | undefined;

/**
 * Change-order mode: loads the order's lines into the basket once for all its pages, and empties
 * the basket again when the customer leaves them. The customer shell remounts a page on every
 * route change, so the clean-up waits one tick: moving between the change-order pages cancels it.
 */
export function EditOrderFlow({
  token,
  children,
}: Readonly<{ token: string; children: ReactNode }>) {
  const dispatch = useDispatch();
  const store = useStore<CustomerRootState>();
  useEffect(() => {
    clearTimeout(pendingClear);
    const { edit } = store.getState().customer;
    if (!(edit.status === 'ready' && edit.order.token === token)) dispatch(editRequested(token));
    return () => {
      pendingClear = setTimeout(() => dispatch(editCleared()), 0);
    };
  }, [dispatch, store, token]);
  return children;
}

function BasketContent({
  slug,
  step = 'basket',
  onBack,
  onNext = noop,
  onChangePlace = noop,
  onToBasket = noop,
  onPlaced,
  editToken,
  onUpdated,
}: Props) {
  const { t } = useTranslation(CUSTOMER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const menu = useSelector(selectMenu);
  const lines = useSelector(selectBasketLines);
  const count = useSelector(selectBasketCount);
  const totalCents = useSelector(selectBasketTotalCents);
  const place = useSelector(selectPlace);
  const edit = useSelector(selectEdit);
  const update = useSelector(selectUpdate);
  const notices = useSelector(selectNotices);
  const checkout = useSelector(selectCheckout);
  const menuSlug = useSelector(selectMenuSlug);
  const editing = editToken !== undefined;
  const [submitted, setSubmitted] = useState(false);
  // Plan 071: the address remembered on this phone (read once; the checkout may replace it).
  const [rememberedAddress] = useState(savedAddress);

  // The kitchen's colours (D-064).
  const theme = menu.status === 'ready' ? (menu.data.theme ?? 'onde') : undefined;
  useEffect(() => {
    if (theme !== undefined) setKitchenBrand(theme);
  }, [theme]);

  const editOrder = edit.status === 'ready' ? edit.order : null;
  // Plan 063: only the ways this menu offers; a delivery-only menu starts on delivery.
  const options = useMemo<ReadonlyArray<Fulfilment>>(
    () => (menu.status === 'ready' ? fulfilmentOptions(menu.data.week) : ['pickup']),
    [menu],
  );
  const wanted = checkout.fulfilment ?? editOrder?.fulfilment;
  const fulfilment: Fulfilment =
    wanted !== undefined && (editing || options.includes(wanted))
      ? wanted
      : (options[0] ?? 'pickup');
  const note = checkout.note ?? editOrder?.note ?? '';
  const firstName = editing ? (editOrder?.firstName ?? '') : checkout.firstName;
  // Plan 071: delivery addresses, when the server can keep them. A changed order that already has a
  // readable address keeps it unless the customer changes it.
  const addressesOn = menu.status === 'ready' && menu.data.addresses === true;
  const needsAddress = addressesOn && fulfilment === 'delivery';
  const keptState = editing ? editOrder?.addressState : undefined;
  const keepsAddress = keptState === 'saved' && checkout.address === null;
  const address: DeliveryAddress | null = keepsAddress
    ? null
    : (checkout.address ?? (keptState === undefined ? rememberedAddress : null));
  const addressBlocked = needsAddress && !keepsAddress && !isAddressComplete(address);
  const addressToSend = needsAddress && !keepsAddress ? addressForRequest(address) : null;
  const onAddress = useCallback(
    (value: DeliveryAddress | null) => dispatch(checkoutSet({ address: value })),
    [dispatch],
  );

  const updatedToken = update.status === 'done' && editToken !== undefined ? editToken : null;
  useEffect(() => {
    if (updatedToken !== null) onUpdated?.(updatedToken);
  }, [updatedToken, onUpdated]);

  // The menu of the seller in the route, or of the order being edited once it has loaded.
  const wantedSlug = editing ? editOrder?.seller.slug : slug;
  useEffect(() => {
    if (wantedSlug !== undefined && wantedSlug !== menuSlug) dispatch(menuRequested(wantedSlug));
  }, [dispatch, wantedSlug, menuSlug]);

  // A repeat customer doesn't retype their name: prefill it once from this phone (D-075). Only once
  // this kitchen's checkout is the live one, because opening a kitchen's menu empties the checkout.
  const prefilled = useRef(false);
  const typedName = checkout.firstName;
  useEffect(() => {
    if (prefilled.current || editing || menuSlug === null || menuSlug !== wantedSlug) return;
    prefilled.current = true;
    const saved = savedFirstName();
    if (saved !== '' && typedName === '') dispatch(checkoutSet({ firstName: saved }));
  }, [dispatch, editing, menuSlug, wantedSlug, typedName]);

  const placedToken = place.status === 'placed' ? place.token : null;
  useEffect(() => {
    if (placedToken !== null) onPlaced(placedToken);
  }, [placedToken, onPlaced]);

  const failure = editing ? update : place;
  const failedCode = failure.status === 'failed' ? failure.code : null;
  const basketProblem = failedCode !== null && BASKET_PROBLEMS.includes(failedCode);
  useEffect(() => {
    if (step === 'name' && basketProblem) onToBasket();
  }, [step, basketProblem, onToBasket]);

  const retryMenu = useCallback(() => {
    if (wantedSlug !== undefined) dispatch(menuRequested(wantedSlug));
  }, [dispatch, wantedSlug]);

  const onQty = useCallback(
    (itemId: string, qty: number) => {
      if (qty === 0 && lines.length === 1) {
        // The last line of an existing order stays: to remove it all, cancel the order instead.
        if (editing) return;
        dispatch(quantitySet({ itemId, qty }));
        onBack();
        return;
      }
      dispatch(quantitySet({ itemId, qty }));
    },
    [dispatch, lines.length, onBack, editing],
  );
  const onFulfilment = useCallback(
    (value: Fulfilment) => dispatch(checkoutSet({ fulfilment: value })),
    [dispatch],
  );
  const onSelectPlace = useCallback(
    (id: string) => dispatch(checkoutSet({ pickupPlaceId: id })),
    [dispatch],
  );
  const onFirstName = useCallback(
    (value: string) => dispatch(checkoutSet({ firstName: value })),
    [dispatch],
  );
  const onNote = useCallback((value: string) => dispatch(checkoutSet({ note: value })), [dispatch]);
  const goNext = useCallback(() => {
    // An old failure must not greet the next page.
    dispatch(placeReset());
    onNext();
  }, [dispatch, onNext]);

  // The menu's places with their times for this menu. A pickup order without a choice gets the first.
  const points = menu.status === 'ready' ? menu.data.week.pickupPoints : [];
  const chosen = points.some((point) => point.id === checkout.pickupPlaceId)
    ? checkout.pickupPlaceId
    : null;
  const pickupId =
    chosen ?? (editing ? editOrder?.pickupPlaceId : undefined) ?? points[0]?.id ?? undefined;

  const nameError =
    submitted && !editing && firstName.trim() === '' ? t('basket.firstNameRequired') : undefined;

  const submit = useCallback(() => {
    if (editing) {
      if (addressBlocked) return;
      dispatch(
        updateRequested({ fulfilment, note, ...(addressToSend ? { address: addressToSend } : {}) }),
      );
      return;
    }
    setSubmitted(true);
    if (firstName.trim() === '' || addressBlocked) return;
    dispatch(
      placeRequested({
        firstName,
        language: lang,
        fulfilment,
        note,
        ...(fulfilment === 'pickup' && pickupId !== undefined ? { pickupPlaceId: pickupId } : {}),
        ...(addressToSend ? { address: addressToSend } : {}),
      }),
    );
  }, [
    dispatch,
    editing,
    firstName,
    lang,
    fulfilment,
    note,
    pickupId,
    addressBlocked,
    addressToSend,
  ]);

  const header = (
    <PageHeader title={t('basket.title')} backLabel={t('common.back')} onBack={onBack} />
  );

  if (menu.status === 'error' || edit.status === 'error') {
    return (
      <Page>
        {header}
        <StateMessage
          alert
          text={edit.status === 'error' ? t('basket.errors.editLoad') : t('menu.loadError')}
          onRetry={retryMenu}
        />
      </Page>
    );
  }
  if (menu.status !== 'ready' || (editing && edit.status !== 'ready')) {
    return (
      <Page>
        {header}
        <StateMessage text={t('common.loading')} />
      </Page>
    );
  }
  if (placedToken !== null) return null;
  const { data } = menu;
  if (lines.length === 0) return <EmptyBasketView data={data} onBack={onBack} />;

  if (step === 'pickup') {
    return (
      <PickupPlaceView
        data={data}
        lang={lang}
        selectedId={pickupId}
        onSelect={onSelectPlace}
        onDone={onBack}
        onBack={onBack}
      />
    );
  }

  if (step === 'name') {
    return (
      <YourNameView
        data={data}
        lang={lang}
        editing={editing}
        firstName={firstName}
        note={note}
        nameError={nameError}
        failure={
          failedCode !== null && !basketProblem
            ? t(otherErrorKey(failedCode, fulfilment, options))
            : undefined
        }
        count={count}
        totalCents={totalCents}
        fulfilment={fulfilment}
        pickupId={pickupId}
        placing={place.status === 'submitting' || update.status === 'submitting'}
        addressBlocked={addressBlocked}
        addressLine={
          needsAddress && addressToSend
            ? t('checkout.deliveryTo', { address: addressLine(addressToSend) })
            : keepsAddress
              ? t('address.kept')
              : undefined
        }
        onFirstName={onFirstName}
        onNote={onNote}
        onSubmit={submit}
        onBack={onBack}
      />
    );
  }

  const { ordering } = data;
  const closed: ClosedReason | null = !ordering.open
    ? ordering.reason === 'kitchen_closed' || ordering.reason === 'not_published'
      ? 'closed_by_seller'
      : (ordering.reason ?? 'closed_by_seller')
    : failedCode === 'cutoff_passed'
      ? 'cutoff_passed'
      : failedCode === 'ordering_closed' || failedCode === 'kitchen_closed'
        ? 'closed_by_seller'
        : null;
  return (
    <BasketView
      data={data}
      lang={lang}
      lines={lines}
      totalCents={totalCents}
      fulfilment={fulfilment}
      pickupId={pickupId}
      editing={editing}
      notices={notices}
      closed={closed}
      stockProblem={failedCode === 'sold_out' || failedCode === 'exceeds_remaining'}
      onQty={onQty}
      onFulfilment={onFulfilment}
      onChangePlace={onChangePlace}
      onNext={goNext}
      onBack={onBack}
      addressBlocked={addressBlocked}
      addressSlot={
        addressesOn ? (
          <AddressSection
            kitchenName={data.kitchen.name}
            {...(data.mapsEmbedKey ? { mapsKey: data.mapsEmbedKey } : {})}
            delivery={fulfilment === 'delivery'}
            value={address}
            saved={rememberedAddress}
            kept={keptState}
            onChange={onAddress}
          />
        ) : undefined
      }
    />
  );
}

export function BasketScreen(props: Props) {
  return (
    <ScreenBoundary>
      <BasketContent {...props} />
    </ScreenBoundary>
  );
}
