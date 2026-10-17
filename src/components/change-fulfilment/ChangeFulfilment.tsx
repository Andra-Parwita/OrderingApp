import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { checkOnMapUrl, isAddressReadable, type DeliveryAddress } from '../../../shared/address';
import type { Fulfilment, Order } from '../../../shared/domain';
import {
  ADDRESS_NOTES_MAX,
  ADDRESS_POSTCODE_MAX,
  ADDRESS_STREET_MAX,
  ADDRESS_SUBURB_MAX,
} from '../../../shared/limits';
import type { PickupPlace } from '../../../shared/menusContract';
import { fulfilmentChangedText } from '../../../shared/pushText';
import { changeOrderFulfilment } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { fetchPickupPlaces } from '../../api/menus';
import { Button, Icon, Segmented, TextField } from '../../ui';
import { useModalFocus } from '../../ui/patterns/modal';
import { QuietMapLinks } from '../QuietMapLinks';
import { CHANGE_FULFILMENT_NS } from './i18n/register';

// Plan 083: "Change" next to an order's Pickup / Delivery line. The seller (owner or chef) opens a
// sheet (bottom sheet on a phone, dialog from 600 px) to move the order between pickup (a place) and
// delivery (an address), and chooses whether to tell the customer. One component for the menu
// orders and the private ones; the host only refreshes its list when `onChanged` is called.

type OrderLike = Pick<
  Order,
  'code' | 'firstName' | 'language' | 'fulfilment' | 'pickupPlaceId' | 'address'
>;

export type ChangeFulfilmentProps = Readonly<{
  order: OrderLike;
  /** This menu's own pickup times, when they differ from the place's usual ones (menu orders). */
  windows?: ReadonlyArray<Pick<PickupPlace, 'id' | 'window'>>;
  onChanged: () => void;
}>;

const Wrap = styled.span`
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
`;
const LinkButton = styled.button`
  margin: -0.625rem 0 -0.625rem 0.125rem;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 0.375rem;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.1875rem;
  cursor: pointer;
`;
const Saved = styled.span`
  color: ${({ theme }) => theme.c.conf};
  font-size: 0.8125rem;
`;
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: ${({ theme }) => theme.colour.scrim};

  @media (min-width: 37.5rem) {
    align-items: center;
    padding: ${({ theme }) => theme.spacing.xl};
  }
`;
const Sheet = styled.div`
  width: 100%;
  max-width: 32.5rem;
  max-height: 100dvh;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadPhone}px
    calc(${({ theme }) => theme.spacing.lg} + env(safe-area-inset-bottom));
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px
    ${({ theme }) => theme.size.radiusSheet}px 0 0;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};

  @media (min-width: 37.5rem) {
    max-height: 100%;
    border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  }
  &:focus {
    outline: none;
  }
  h2 {
    margin: 0;
    font-size: 1.0625rem;
  }
`;
const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.md};
`;
const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
`;
const Full = styled.div`
  & > div {
    display: flex;
    width: 100%;
  }
  & button {
    flex: 1;
  }
`;
const Radios = styled.fieldset`
  margin: 0;
  padding: 0;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  overflow: hidden;

  legend {
    padding: 0;
    font-size: 0.8125rem;
    font-weight: 600;
  }
`;
const RadioRow = styled.label<{ $on: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 3.25rem;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme, $on }) => ($on ? theme.c.tint : 'transparent')};
  cursor: pointer;

  &:last-child {
    border-bottom: 0;
  }
  input {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: ${({ theme }) => theme.c.fill};
  }
  .name {
    flex: 1;
  }
  .times {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }
  .now {
    margin-inline-start: ${({ theme }) => theme.spacing.xs};
    padding: 0 0.5rem;
    border-radius: 62rem;
    background: ${({ theme }) => theme.c.tint};
    color: ${({ theme }) => theme.c.atext};
    font-size: 0.6875rem;
    font-weight: 600;
  }
`;
const Row2 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Hint = styled.p`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: flex-start;
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;

  svg {
    width: 1rem;
    height: 1rem;
    margin-top: 0.125rem;
  }
`;
const Tick = styled.label`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  align-items: flex-start;
  cursor: pointer;

  input {
    flex: none;
    width: 1.375rem;
    height: 1.375rem;
    margin: 0.0625rem 0 0;
    accent-color: ${({ theme }) => theme.c.fill};
  }
  b {
    font-weight: 600;
  }
`;
const Preview = styled.div`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf2};
  font-size: 0.875rem;
  overflow-wrap: anywhere;

  small {
    display: block;
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.75rem;
  }
`;
const Two = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const ErrorLine = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.danger};
  font-size: 0.875rem;
`;

type FormState = {
  mode: Fulfilment;
  placeId: string;
  street: string;
  suburb: string;
  postcode: string;
  notes: string;
  tell: boolean;
};

function readableOf(order: OrderLike): DeliveryAddress | null {
  const a = order.address;
  return a && 'address' in a ? a.address : null;
}

function Sheet083({
  order,
  windows,
  onClose,
  onSaved,
}: Readonly<{
  order: OrderLike;
  windows: ChangeFulfilmentProps['windows'];
  onClose: () => void;
  onSaved: (told: boolean) => void;
}>) {
  const { t } = useTranslation(CHANGE_FULFILMENT_NS);
  const titleId = useId();
  const { box, onKeyDown } = useModalFocus<HTMLDivElement>(onClose);
  const [places, setPlaces] = useState<ReadonlyArray<PickupPlace> | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const known = readableOf(order);
  const [form, setForm] = useState<FormState>({
    mode: order.fulfilment,
    placeId: order.pickupPlaceId ?? '',
    street: known?.street ?? '',
    suburb: known?.suburb ?? '',
    postcode: known?.postcode ?? '',
    notes: known?.notes ?? '',
    tell: true,
  });
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    let live = true;
    void fetchPickupPlaces(undefined, currentSellerSlug()).then((result) => {
      if (!live) return;
      const list = result.ok ? result.data.places : [];
      setPlaces(list);
      // First place preselected unless the order already has one of these.
      setForm((current) =>
        list.some((place) => place.id === current.placeId)
          ? current
          : { ...current, placeId: list[0]?.id ?? '' },
      );
    });
    return () => {
      live = false;
    };
  }, []);

  const times = (place: PickupPlace) => {
    const w = windows?.find((candidate) => candidate.id === place.id)?.window ?? place.window;
    return `${w.start}–${w.end}`;
  };
  const chosen = places?.find((place) => place.id === form.placeId);
  const { street, suburb, postcode, notes } = form;
  const address = useMemo<DeliveryAddress>(
    () => ({
      street: street.trim(),
      suburb: suburb.trim(),
      postcode: postcode.trim(),
      ...(notes.trim() !== '' ? { notes: notes.trim() } : {}),
    }),
    [street, suburb, postcode, notes],
  );
  const ready = form.mode === 'pickup' ? chosen !== undefined : isAddressReadable(address);
  const message =
    form.mode === 'delivery'
      ? fulfilmentChangedText(order.language, { delivery: true })
      : chosen
        ? fulfilmentChangedText(order.language, { pickup: chosen.place, times: times(chosen) })
        : '';

  const save = useCallback(async () => {
    if (!ready || saving) return;
    setSaving(true);
    setFailed(false);
    const result = await changeOrderFulfilment(
      order.code,
      form.mode === 'pickup'
        ? { fulfilment: 'pickup', pickupPlaceId: form.placeId, notify: form.tell }
        : { fulfilment: 'delivery', address, notify: form.tell },
      undefined,
      currentSellerSlug(),
    );
    setSaving(false);
    if (result.ok) onSaved(form.tell);
    else setFailed(true);
  }, [ready, saving, order.code, form, address, onSaved]);

  return (
    <Overlay onClick={onClose}>
      <Sheet
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>{t('title')}</h2>
        <Muted>{order.firstName}</Muted>
        <Stack>
          <Full>
            <Segmented
              label={t('how', { name: order.firstName })}
              value={form.mode}
              options={[
                { value: 'pickup', label: t('pickup') },
                { value: 'delivery', label: t('delivery') },
              ]}
              onChange={(mode) => set('mode', mode)}
            />
          </Full>

          {form.mode === 'pickup' ? (
            places === null ? (
              <Muted role="status">{t('loadingPlaces')}</Muted>
            ) : places.length === 0 ? (
              <Muted>{t('noPlaces')}</Muted>
            ) : (
              <Radios>
                <legend>{t('place')}</legend>
                {places.map((place) => (
                  <RadioRow key={place.id} $on={place.id === form.placeId}>
                    <input
                      type="radio"
                      name="change-fulfilment-place"
                      checked={place.id === form.placeId}
                      onChange={() => set('placeId', place.id)}
                    />
                    <span className="name">
                      {place.place}
                      {order.fulfilment === 'pickup' && place.id === order.pickupPlaceId ? (
                        <span className="now">{t('now')}</span>
                      ) : null}
                    </span>
                    <span className="times">{times(place)}</span>
                  </RadioRow>
                ))}
              </Radios>
            )
          ) : (
            <>
              <TextField
                label={t('street')}
                value={form.street}
                maxLength={ADDRESS_STREET_MAX}
                autoComplete="off"
                onChange={(event) => set('street', event.target.value)}
              />
              <Row2>
                <TextField
                  label={t('suburb')}
                  value={form.suburb}
                  maxLength={ADDRESS_SUBURB_MAX}
                  autoComplete="off"
                  onChange={(event) => set('suburb', event.target.value)}
                />
                <TextField
                  label={`${t('postcode')} ${t('optional')}`}
                  value={form.postcode}
                  maxLength={ADDRESS_POSTCODE_MAX}
                  autoComplete="off"
                  onChange={(event) => set('postcode', event.target.value)}
                />
              </Row2>
              <TextField
                label={`${t('notes')} ${t('optional')}`}
                value={form.notes}
                maxLength={ADDRESS_NOTES_MAX}
                autoComplete="off"
                onChange={(event) => set('notes', event.target.value)}
              />
              {isAddressReadable(address) ? (
                <QuietMapLinks map={{ href: checkOnMapUrl(address), label: t('checkOnMap') }} />
              ) : null}
              <Hint>
                <Icon name="lock" />
                <span>{t('private')}</span>
              </Hint>
            </>
          )}

          <Tick>
            <input
              type="checkbox"
              checked={form.tell}
              onChange={(event) => set('tell', event.target.checked)}
            />
            <span>
              <b>{t('tell', { name: order.firstName })}</b>
              <Muted>{t('tellHint')}</Muted>
            </span>
          </Tick>
          {form.tell && message !== '' ? (
            <Preview>
              <small>{t('preview', { name: order.firstName })}</small>
              {message}
            </Preview>
          ) : null}
          {failed ? <ErrorLine role="alert">{t('error')}</ErrorLine> : null}
          <Two>
            <Button onClick={onClose}>{t('cancel')}</Button>
            <Button variant="primary" disabled={!ready || saving} onClick={() => void save()}>
              {saving ? t('saving') : t('save')}
            </Button>
          </Two>
          <Hint>
            <Icon name="lock" />
            <span>{t('cutoff', { name: order.firstName })}</span>
          </Hint>
        </Stack>
      </Sheet>
    </Overlay>
  );
}

/** The quiet "Change" link, its sheet, and the "Saved" line after it. Owners and chefs only: the host decides. */
export function ChangeFulfilment({ order, windows, onChanged }: ChangeFulfilmentProps) {
  const { t } = useTranslation(CHANGE_FULFILMENT_NS);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<'told' | 'quiet' | null>(null);
  const onSaved = useCallback(
    (told: boolean) => {
      setOpen(false);
      setSaved(told ? 'told' : 'quiet');
      onChanged();
    },
    [onChanged],
  );
  return (
    <Wrap>
      <LinkButton type="button" aria-label={t('changeAria')} onClick={() => setOpen(true)}>
        {t('change')}
      </LinkButton>
      {saved ? (
        <Saved role="status">
          {saved === 'told' ? t('saved', { name: order.firstName }) : t('savedQuiet')}
        </Saved>
      ) : null}
      {open ? (
        <Sheet083
          order={order}
          windows={windows}
          onClose={() => setOpen(false)}
          onSaved={onSaved}
        />
      ) : null}
    </Wrap>
  );
}
