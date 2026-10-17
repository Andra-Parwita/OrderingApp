import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { checkOnMapUrl, directionsUrl, type DeliveryAddress } from '../../../shared/address';
import type { Language } from '../../../shared/domain';
import { QuietMapLinks } from '../../components/QuietMapLinks';
import { isIphone } from '../../components/isIphone';
import { SCREEN_HEIGHT } from '../../theme/screen';
import { PRIVATE_NS } from './i18n/register';

// Pieces the three Private screens share: the page frame, a card, and the map links.

export const Page = styled.main`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${SCREEN_HEIGHT};
  max-width: 45rem;
  margin: 0 auto;
  padding: ${({ theme }) => theme.size.pagePadPhone}px;
  padding-bottom: ${({ theme }) => theme.spacing.xl};
`;
export const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf};
`;
export const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.8125rem;
`;
export const ErrorLine = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.danger};
  font-size: 0.875rem;
`;

/** The seller's language, for names and dates (the screens' own strings follow i18n). */
export function useLang(): Language {
  const { i18n } = useTranslation(PRIVATE_NS);
  return i18n.resolvedLanguage === 'id' ? 'id' : 'en';
}

/** Directions: the phone's maps app (Apple Maps on an iPhone). */
export function directionsHref(address: DeliveryAddress): string {
  return directionsUrl(address, isIphone());
}

/** Directions and Map for a delivery address, as quiet icon links (the order's detail page). */
export function AddressLinks({ address }: Readonly<{ address: DeliveryAddress }>) {
  const { t } = useTranslation(PRIVATE_NS);
  return (
    <QuietMapLinks
      directions={{ href: directionsHref(address), label: t('directions') }}
      map={{ href: checkOnMapUrl(address, isIphone()), label: t('viewOnMap') }}
    />
  );
}
