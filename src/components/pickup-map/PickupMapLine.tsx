import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { pickupDirectionsUrl } from '../../../shared/pickupAddress';
import { PICKUP_MAP_NS } from './i18n/register';
import { PickupMapPanel } from './PickupMapPanel';
import type { PickupMapInfo } from './pickupMapInfo';

// Plan 076 (additive only): one small line under the pickup place: address · View on map · Directions.
// Drawn only when the place has an address; nothing else on the screen changes.

const Line = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
  line-height: 1.5;
`;
const Address = styled.span`
  overflow-wrap: anywhere;
`;
const action = ({ theme }: { theme: { c: Record<string, string> } }) => `
  padding: 0.25rem 0;
  color: ${theme.c.text};
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
`;
const LinkButton = styled.button`
  ${action}
  border: 0;
  background: none;
`;
const LinkAnchor = styled.a`
  ${action}
`;

export function PickupMapLine({ info }: Readonly<{ info: PickupMapInfo | undefined }>) {
  const { t } = useTranslation(PICKUP_MAP_NS);
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  if (!info) return null;
  return (
    <>
      <Line data-testid="pickup-map-line">
        <Address>
          <span aria-hidden="true">📍 </span>
          {info.address}
        </Address>
        <span aria-hidden="true">·</span>
        <LinkButton
          ref={opener}
          type="button"
          aria-label={t('line.viewOnMapLabel', { place: info.place })}
          onClick={() => setOpen(true)}
        >
          {t('line.viewOnMap')}
        </LinkButton>
        <span aria-hidden="true">·</span>
        <LinkAnchor
          href={pickupDirectionsUrl(info)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('line.directionsLabel', { place: info.place })}
        >
          {t('line.directions')}
        </LinkAnchor>
      </Line>
      {open ? <PickupMapPanel info={info} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
