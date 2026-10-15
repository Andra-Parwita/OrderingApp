import { useCallback, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { checkOnMapUrl } from '../../../shared/address';
import {
  ADDRESS_POSTCODE_MAX,
  ADDRESS_STREET_MAX,
  ADDRESS_SUBURB_MAX,
} from '../../../shared/limits';
import { Button, TextField } from '../../ui';
import { joinAddress, type AddressParts } from './addressParts';
import { PICKUP_MAP_NS } from './i18n/register';
import { PickupMapPanel } from './PickupMapPanel';

// Plan 076: the seller's "Address (optional)" row of a pickup place. Guided fields, Check on map
// and Use my location (plan 071's ideas, kept apart from the customer checkout). Finding notes
// are not repeated here: the place's own Directions fields (EN / ID) already serve.

const Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Label = styled.span`
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Fields = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1.2fr) minmax(0, 0.8fr);
  gap: ${({ theme }) => theme.spacing.md};
  @media (max-width: 40rem) {
    grid-template-columns: 1fr;
  }
`;
const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const LinkOut = styled.a`
  color: ${({ theme }) => theme.c.text};
`;

type Props = Readonly<{
  place: string;
  value: AddressParts;
  onChange: (next: AddressParts) => void;
  /** The public Maps Embed key; without it Check on map opens Google Maps in a new tab. */
  mapsKey?: string | undefined;
  disabled?: boolean;
}>;

export function AddressEditor({ place, value, onChange, mapsKey, disabled = false }: Props) {
  const { t } = useTranslation(PICKUP_MAP_NS);
  const line = joinAddress(value);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState(false);
  const [locate, setLocate] = useState<'idle' | 'busy' | 'denied' | 'unavailable'>('idle');
  const pinned = value.lat !== null && value.lng !== null;

  const field =
    (key: 'street' | 'suburb' | 'postcode') => (event: ChangeEvent<HTMLInputElement>) => {
      // A pin belonged to the old address.
      onChange({ ...value, [key]: event.target.value, lat: null, lng: null });
      setLocate('idle');
    };
  const useLocation = useCallback(() => {
    if (!navigator.geolocation || window.isSecureContext === false) {
      setLocate('unavailable');
      return;
    }
    setLocate('busy');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({ ...value, lat: position.coords.latitude, lng: position.coords.longitude });
        setLocate('idle');
      },
      () => setLocate('denied'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, [onChange, value]);
  const remove = () => {
    onChange({ street: '', suburb: '', postcode: '', lat: null, lng: null });
    setOpen(false);
  };

  return (
    <Group data-testid="address-editor">
      <Label>{t('editor.label')}</Label>
      {open ? (
        <>
          <Fields>
            <TextField
              label={t('editor.street')}
              value={value.street}
              maxLength={ADDRESS_STREET_MAX}
              autoComplete="off"
              disabled={disabled}
              onChange={field('street')}
            />
            <TextField
              label={t('editor.suburb')}
              value={value.suburb}
              maxLength={ADDRESS_SUBURB_MAX}
              autoComplete="off"
              disabled={disabled}
              onChange={field('suburb')}
            />
            <TextField
              label={t('editor.postcode')}
              value={value.postcode}
              maxLength={ADDRESS_POSTCODE_MAX}
              inputMode="numeric"
              autoComplete="off"
              disabled={disabled}
              onChange={field('postcode')}
            />
          </Fields>
          <Muted>{line === '' ? t('editor.required') : t('editor.notesHint')}</Muted>
          <Row>
            {mapsKey ? (
              <Button disabled={disabled || line === ''} onClick={() => setPanel(true)}>
                {t('editor.checkOnMap')}
              </Button>
            ) : (
              <LinkOut
                href={checkOnMapUrl({
                  street: value.street.trim(),
                  suburb: value.suburb.trim(),
                  postcode: value.postcode.trim(),
                })}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={line === ''}
              >
                {t('editor.checkOnMap')}
              </LinkOut>
            )}
            {pinned ? (
              <>
                <Muted role="status">{t('editor.pinAdded')}</Muted>
                <Button
                  variant="quiet"
                  disabled={disabled}
                  onClick={() => onChange({ ...value, lat: null, lng: null })}
                >
                  {t('editor.removePin')}
                </Button>
              </>
            ) : (
              <Button
                disabled={disabled || line === '' || locate === 'busy'}
                aria-busy={locate === 'busy'}
                onClick={useLocation}
              >
                {locate === 'busy' ? t('editor.locating') : t('editor.useLocation')}
              </Button>
            )}
          </Row>
          {!pinned ? <Muted>{t('editor.locationHint')}</Muted> : null}
          {locate === 'denied' ? <Muted role="status">{t('editor.denied')}</Muted> : null}
          {locate === 'unavailable' ? <Muted role="status">{t('editor.unavailable')}</Muted> : null}
          <Row>
            <Button variant="quiet" disabled={line === ''} onClick={() => setOpen(false)}>
              {t('editor.done')}
            </Button>
            <Button variant="quiet" disabled={disabled} onClick={remove}>
              {t('editor.remove')}
            </Button>
          </Row>
        </>
      ) : line === '' ? (
        <Row>
          <Muted>{t('editor.none')}</Muted>
          <Button disabled={disabled} onClick={() => setOpen(true)}>
            {t('editor.add')}
          </Button>
        </Row>
      ) : (
        <Row>
          <span>
            {line}
            {pinned ? <Muted as="span"> · {t('editor.pinned')}</Muted> : null}
          </span>
          <Button disabled={disabled} onClick={() => setOpen(true)}>
            {t('editor.change')}
          </Button>
          <Button variant="quiet" disabled={disabled} onClick={remove}>
            {t('editor.remove')}
          </Button>
        </Row>
      )}
      {panel && mapsKey ? (
        <PickupMapPanel
          info={{
            place,
            address: line,
            ...(value.lat !== null && value.lng !== null ? { lat: value.lat, lng: value.lng } : {}),
            mapsKey,
          }}
          onClose={() => setPanel(false)}
        >
          <Muted>
            <b>{t('editor.pinRight')}</b>
          </Muted>
          <Button onClick={() => setPanel(false)}>{t('editor.pinYes')}</Button>
        </PickupMapPanel>
      ) : null}
    </Group>
  );
}
