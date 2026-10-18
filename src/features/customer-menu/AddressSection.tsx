import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import {
  addressLine,
  checkOnMapUrl,
  isAddressComplete,
  type DeliveryAddress,
} from '../../../shared/address';
import {
  ADDRESS_NOTES_MAX,
  ADDRESS_POSTCODE_MAX,
  ADDRESS_STREET_MAX,
  ADDRESS_SUBURB_MAX,
} from '../../../shared/limits';
import { isIphone } from '../../components/isIphone';
import { BottomSheet, Button, SlideOver } from '../../ui';
import { Field, Input } from './CheckoutForms';
import { CUSTOMER_NS } from './i18n/register';
import { MenuIcon } from './menuIcons';

// Plan 071 (D-099): the delivery address at checkout. Guided fields (street, suburb, postcode, notes
// for the driver), "Check on map", an optional "Use my location", and the kitchen's privacy line.
// With no saved address the form opens when Delivery is picked; with one, a compact card shows it.

const BLANK: DeliveryAddress = { street: '', suburb: '', postcode: '' };

const Wrap = styled.div`
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.25s ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
  &[data-open='true'] {
    grid-template-rows: 1fr;
  }
  > div {
    min-height: 0;
    overflow: hidden;
    visibility: hidden;
    /* Closing: hide after the slide; opening: visible at once so the field can take focus. */
    transition: visibility 0s linear 0.25s;
    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }
  &[data-open='true'] > div {
    visibility: visible;
    transition-delay: 0s;
  }
`;
const Inner = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
`;
const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr 7rem;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Card = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: 0.75rem;
  background: ${({ theme }) => theme.c.surf};
  p {
    flex: 1;
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
  }
`;
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const smallButton = ({
  theme,
}: {
  theme: { c: Record<string, string>; border: { hairline: string } };
}) => `
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 2.5rem;
  padding: 0 0.875rem;
  border: ${theme.border.hairline} solid ${theme.c.ctrl};
  border-radius: 0.75rem;
  background: ${theme.c.surf};
  color: ${theme.c.text};
  font: inherit;
  font-size: 0.9375rem;
  text-decoration: none;
  cursor: pointer;
`;
const SmallButton = styled.button`
  ${smallButton}
  &:disabled {
    opacity: 0.55;
    cursor: default;
  }
`;
const SmallLink = styled.a`
  ${smallButton}
  &[aria-disabled='true'] {
    opacity: 0.55;
    pointer-events: none;
  }
`;
const Status = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const Privacy = styled.div`
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
  line-height: 1.45;
  p {
    margin: 0;
  }
  b {
    color: ${({ theme }) => theme.c.text};
  }
`;
const LinkButton = styled.button`
  display: block;
  margin-top: ${({ theme }) => theme.spacing.xs};
  padding: 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
`;
const Panel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: 0 ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg};
  h2,
  p {
    margin: 0;
  }
  iframe {
    width: 100%;
    height: 60vh;
    border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
    border-radius: 0.75rem;
  }
`;
const Locate = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.xs};
`;
const Chip = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: 0.75rem;
  background: ${({ theme }) => theme.c.surf};
`;

type Props = Readonly<{
  kitchenName: string;
  /** The public Maps Embed key: with it "See my address" opens a panel; without, the Maps app. */
  mapsKey?: string;
  /** Delivery is the chosen way: the section is open. */
  delivery: boolean;
  /** What would be sent: the typed address, or else the one remembered on this phone. */
  value: DeliveryAddress | null;
  /** The address remembered on this phone. */
  saved: DeliveryAddress | null;
  /** Changing an order that already has an address (readable or not). */
  kept?: 'saved' | 'unreadable' | undefined;
  disabled?: boolean;
  onChange: (next: DeliveryAddress | null) => void;
}>;

export function AddressSection({
  kitchenName,
  mapsKey,
  delivery,
  value,
  saved,
  kept,
  disabled = false,
  onChange,
}: Props) {
  const { t } = useTranslation(CUSTOMER_NS);
  const ids = [useId(), useId(), useId(), useId()] as const;
  const street = useRef<HTMLInputElement>(null);
  const hasCard = isAddressComplete(value) || kept === 'saved';
  const [card, setCard] = useState(hasCard);
  const [place, setPlace] = useState<'idle' | 'busy' | 'ok' | 'denied' | 'unavailable'>('idle');
  const [how, setHow] = useState(false);
  const [panel, setPanel] = useState<false | 'address' | 'pin'>(false);
  const howButton = useRef<HTMLButtonElement>(null);
  const wasDelivery = useRef(delivery);
  const wantsFocus = useRef(false);

  // Focus the first field when the form opens because the customer chose Delivery or Change.
  useEffect(() => {
    if (delivery && !wasDelivery.current && !card) wantsFocus.current = true;
    wasDelivery.current = delivery;
    if (wantsFocus.current && delivery && !card) {
      wantsFocus.current = false;
      // After the next paint: while it slides open the field is still hidden.
      requestAnimationFrame(() => street.current?.focus({ preventScroll: true }));
    }
  }, [delivery, card]);

  const current = value ?? BLANK;
  const set = useCallback(
    (key: 'street' | 'suburb' | 'postcode' | 'notes') => (event: ChangeEvent<HTMLInputElement>) => {
      const next: DeliveryAddress = { ...current, [key]: event.target.value };
      // The pin belonged to the old address.
      if (key !== 'notes') {
        delete next.lat;
        delete next.lng;
        setPlace('idle');
      }
      onChange(next);
    },
    [current, onChange],
  );
  const change = useCallback(() => {
    wantsFocus.current = true;
    onChange(value ?? saved ?? BLANK);
    setCard(false);
  }, [onChange, value, saved]);
  const different = useCallback(() => {
    wantsFocus.current = true;
    setPlace('idle');
    onChange({ ...BLANK });
  }, [onChange]);
  const useSaved = useCallback(() => {
    setPlace('idle');
    onChange(null);
    setCard(true);
  }, [onChange]);
  const locate = useCallback(() => {
    // Location needs a secure page (https); on a plain http page the browser can refuse without a word.
    if (
      typeof navigator === 'undefined' ||
      !navigator.geolocation ||
      window.isSecureContext === false
    ) {
      setPlace('unavailable');
      return;
    }
    setPlace('busy');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({ ...current, lat: position.coords.latitude, lng: position.coords.longitude });
        setPlace('ok');
      },
      () => setPlace('denied'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, [current, onChange]);

  const showCard = card && hasCard;
  const complete = isAddressComplete(current);
  const pinned = value?.lat !== undefined && value.lng !== undefined;
  const removePin = useCallback(() => {
    const next: DeliveryAddress = { ...current };
    delete next.lat;
    delete next.lng;
    setPlace('idle');
    onChange(next);
  }, [current, onChange]);
  const line = value && isAddressComplete(value) ? addressLine(value) : '';
  const notes = value?.notes?.trim();

  return (
    <Wrap data-open={delivery} data-testid="address-section">
      <div>
        <Inner>
          {kept === 'unreadable' && !showCard ? (
            <Status role="alert">{t('address.unreadable')}</Status>
          ) : null}
          {showCard ? (
            <Card>
              <MenuIcon name="pin" size="1.5rem" />
              <p>
                {kept === 'saved' && !value ? (
                  t('address.kept')
                ) : (
                  <>
                    <b>{line}</b>
                    {notes ? ` · ${notes}` : ''}
                    {value?.lat !== undefined ? (
                      <Status as="span"> · {t('address.pinned')}</Status>
                    ) : null}
                  </>
                )}
              </p>
              <SmallButton type="button" onClick={change} disabled={disabled}>
                {t('address.change')}
              </SmallButton>
            </Card>
          ) : (
            <>
              <Field label={t('address.street')} help="" htmlFor={ids[0]}>
                <Input
                  ref={street}
                  id={ids[0]}
                  value={current.street}
                  onChange={set('street')}
                  maxLength={ADDRESS_STREET_MAX}
                  autoComplete="address-line1"
                  disabled={disabled}
                  required
                />
              </Field>
              <Row>
                <Field label={t('address.suburb')} help="" htmlFor={ids[1]}>
                  <Input
                    id={ids[1]}
                    value={current.suburb}
                    onChange={set('suburb')}
                    maxLength={ADDRESS_SUBURB_MAX}
                    autoComplete="address-level2"
                    disabled={disabled}
                    required
                  />
                </Field>
                <Field label={t('address.postcode')} help="" htmlFor={ids[2]}>
                  <Input
                    id={ids[2]}
                    value={current.postcode}
                    onChange={set('postcode')}
                    maxLength={ADDRESS_POSTCODE_MAX}
                    inputMode="numeric"
                    autoComplete="postal-code"
                    disabled={disabled}
                    required
                  />
                </Field>
              </Row>
              <Field
                label={t('address.notes')}
                optional={t('checkout.optional')}
                help={t('address.notesHelp')}
                counter={`${String((current.notes ?? '').length)}/${String(ADDRESS_NOTES_MAX)}`}
                htmlFor={ids[3]}
              >
                <Input
                  id={ids[3]}
                  value={current.notes ?? ''}
                  onChange={set('notes')}
                  maxLength={ADDRESS_NOTES_MAX}
                  disabled={disabled}
                />
              </Field>
              {!complete ? <Status>{t('address.required')}</Status> : null}
              <Actions>
                {mapsKey ? (
                  <SmallButton
                    type="button"
                    onClick={() => setPanel('address')}
                    disabled={disabled || !complete}
                  >
                    {t('address.checkOnMap')}
                  </SmallButton>
                ) : (
                  <SmallLink
                    href={checkOnMapUrl(current)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!complete}
                  >
                    {t('address.checkOnMap')}
                  </SmallLink>
                )}
                {isIphone() ? (
                  <SmallLink
                    href={checkOnMapUrl(current, true)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!complete}
                  >
                    {t('address.checkOnAppleMaps')}
                  </SmallLink>
                ) : null}
              </Actions>
              <Status>{t('address.checkOnMapHint')}</Status>
              {pinned && value ? (
                <Chip role="status">
                  <span>{t('address.locationAdded')}</span>
                  {mapsKey ? (
                    <SmallButton type="button" onClick={() => setPanel('pin')}>
                      {t('address.viewOnMap')}
                    </SmallButton>
                  ) : (
                    <SmallLink
                      href={`https://www.google.com/maps/search/?api=1&query=${String(value.lat)},${String(value.lng)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('address.viewOnMap')}
                    </SmallLink>
                  )}
                  <SmallButton type="button" onClick={removePin} disabled={disabled}>
                    {t('address.removeLocation')}
                  </SmallButton>
                </Chip>
              ) : (
                <Locate>
                  <SmallButton
                    type="button"
                    onClick={locate}
                    disabled={disabled || place === 'busy'}
                    aria-busy={place === 'busy'}
                  >
                    {place === 'busy' ? t('address.locating') : t('address.useLocation')}
                  </SmallButton>
                  <Status>{t('address.locationHint')}</Status>
                  {place === 'denied' ? (
                    <Status role="status">{t('address.locationDenied')}</Status>
                  ) : null}
                  {place === 'unavailable' ? (
                    <Status role="status">{t('address.locationUnavailable')}</Status>
                  ) : null}
                </Locate>
              )}
              {saved !== null || kept === 'saved' ? (
                <Actions>
                  <SmallButton type="button" onClick={different} disabled={disabled}>
                    {t('address.useDifferent')}
                  </SmallButton>
                  {saved !== null ? (
                    <SmallButton type="button" onClick={useSaved} disabled={disabled}>
                      {t('address.useSaved')}
                    </SmallButton>
                  ) : null}
                </Actions>
              ) : null}
            </>
          )}
          {panel && mapsKey ? (
            <SlideOver
              label={t('address.checkTitle')}
              closeLabel={t('address.close')}
              onClose={() => setPanel(false)}
            >
              <Panel>
                <h2>{t('address.checkTitle')}</h2>
                <iframe
                  title={t('address.mapTitle')}
                  src={`https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${encodeURIComponent(
                    pinned && value
                      ? `${String(value.lat)},${String(value.lng)}`
                      : addressLine(current),
                  )}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
                <p>
                  <b>{t('address.pinRight')}</b>
                </p>
                <Actions>
                  <Button onClick={() => setPanel(false)}>{t('address.pinYes')}</Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setPanel(false);
                      requestAnimationFrame(() => street.current?.focus());
                    }}
                  >
                    {t('address.pinFix')}
                  </Button>
                </Actions>
              </Panel>
            </SlideOver>
          ) : null}
          <Privacy>
            <p>
              <b>🔒 {t('address.privacyLead')}</b>{' '}
              {t('address.privacyRest', { kitchen: kitchenName })}
            </p>
            <LinkButton ref={howButton} type="button" onClick={() => setHow(true)}>
              {t('address.howTitle')}
            </LinkButton>
            {how ? (
              <BottomSheet
                title={t('address.howTitle')}
                onClose={() => {
                  setHow(false);
                  howButton.current?.focus();
                }}
              >
                <p>
                  <b>🔒 {t('address.privacyLead')}</b>{' '}
                  {t('address.privacyRest', { kitchen: kitchenName })}
                </p>
                <ul>
                  <li>{t('address.how1')}</li>
                  <li>{t('address.how2', { kitchen: kitchenName })}</li>
                  <li>{t('address.how3')}</li>
                  <li>{t('address.how4')}</li>
                  <li>{t('address.how5')}</li>
                </ul>
              </BottomSheet>
            ) : null}
          </Privacy>
        </Inner>
      </div>
    </Wrap>
  );
}
