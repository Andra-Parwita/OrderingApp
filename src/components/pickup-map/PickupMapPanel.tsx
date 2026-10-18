import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { pickupDirectionsUrl, pickupEmbedUrl } from '../../../shared/pickupAddress';
import { SlideOver } from '../../ui';
import { PICKUP_MAP_NS } from './i18n/register';
import type { PickupMapInfo } from './pickupMapInfo';

// Plan 076: the map panel of a pickup place, like the seller's Deliveries panel. It is mounted only
// after "View on map" is tapped, so no map loads before then. Without a Maps key it shows the
// address and Directions only.

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding: 0 ${({ theme }) => theme.spacing.xl}
    calc(${({ theme }) => theme.spacing.xl} + env(safe-area-inset-bottom, 0rem));
  h2,
  p {
    margin: 0;
  }
  iframe {
    width: 100%;
    height: min(45vh, 22rem);
    height: min(45dvh, 22rem);
    /* The embed must not swallow finger drags that scroll the panel. */
    pointer-events: none;
    border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
    border-radius: 0.75rem;
  }
`;
const Fact = styled.p`
  display: flex;
  flex-direction: column;
  overflow-wrap: anywhere;
  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: ${({ theme }) => theme.type.size.sm};
  }
`;
const BigLink = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 3rem;
  border-radius: 0.75rem;
  background: ${({ theme }) => theme.colour.accent};
  color: ${({ theme }) => theme.colour.onAccent};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  text-decoration: none;
`;

type Props = Readonly<{
  info: PickupMapInfo;
  onClose: () => void;
  /** Extra content under the facts (the seller's "is the pin right?" buttons). */
  children?: React.ReactNode;
}>;

export function PickupMapPanel({ info, onClose, children }: Props) {
  const { t } = useTranslation(PICKUP_MAP_NS);
  return (
    <SlideOver label={info.place} closeLabel={t('panel.close')} onClose={onClose}>
      <Body>
        <h2>{info.place}</h2>
        {info.mapsKey ? (
          <iframe
            title={t('panel.mapTitle', { place: info.place })}
            src={pickupEmbedUrl(info, info.mapsKey)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        ) : null}
        <Fact>
          <b>{info.address}</b>
        </Fact>
        {info.whenText ? (
          <Fact>
            <small>{t('panel.pickupTime')}</small>
            {info.whenText}
          </Fact>
        ) : null}
        {info.directions ? (
          <Fact>
            <small>{t('panel.findingIt')}</small>
            {info.directions}
          </Fact>
        ) : null}
        {children}
        <BigLink href={pickupDirectionsUrl(info)} target="_blank" rel="noopener noreferrer">
          {t('panel.directions')}
        </BigLink>
      </Body>
    </SlideOver>
  );
}
