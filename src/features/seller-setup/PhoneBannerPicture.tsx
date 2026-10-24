import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { PHONE_BANNER_TALL, slotSpec } from '../../../shared/imageSlots';
import { ImageSlot as Picture } from '../../ui';
import { SETUP_NS } from './i18n/register';

// The saved phone banner in its slot card (plan 123). A normal 3:1 banner is shown whole as always. A tall (2:1)
// one is shown whole too, with the seam marked: the top third is the part only the iPhone app shows (behind the
// clock), the bottom two thirds the banner everyone sees. Which one is read from the loaded picture.

const SEAM_SHARE = 100 / 3; // the top 200 px of 600
const Frame = styled.div`
  position: relative;
`;
const Seam = styled.div`
  position: absolute;
  top: ${SEAM_SHARE}%;
  left: 0;
  right: 0;
  border-top: ${({ theme }) => theme.border.focus} dashed ${({ theme }) => theme.colour.surface};
  box-shadow: 0 ${({ theme }) => theme.border.hairline} 0 ${({ theme }) => theme.colour.text};
  pointer-events: none;
`;
const Zone = styled.span<{ $below?: boolean }>`
  position: absolute;
  top: ${({ $below }) => ($below ? `${SEAM_SHARE}%` : '0')};
  left: ${({ theme }) => theme.spacing.xs};
  margin-top: ${({ theme }) => theme.spacing.xs};
  padding: 0 ${({ theme }) => theme.spacing.xs};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colour.surface};
  color: ${({ theme }) => theme.colour.text};
  font-size: ${({ theme }) => theme.type.size.sm};
  pointer-events: none;
`;

type Props = Readonly<{
  src: string | undefined;
  alt: string;
  background: string;
  placeholder: string;
}>;

export function PhoneBannerPicture({ src, alt, background, placeholder }: Props) {
  const { t } = useTranslation(SETUP_NS);
  const [tallSrc, setTallSrc] = useState<string | undefined>(undefined);
  const tall = src !== undefined && tallSrc === src;
  const onTall = useCallback((isTall: boolean) => setTallSrc(isTall ? src : undefined), [src]);
  const wide = slotSpec('phoneBanner');
  const shape = tall ? PHONE_BANNER_TALL : wide;
  return (
    <Frame>
      <Picture
        aspectRatio={`${shape.width} / ${shape.height}`}
        src={src}
        alt={alt}
        placeholder={placeholder}
        background={background}
        onTall={onTall}
      />
      {tall ? (
        <>
          <Seam aria-hidden="true" data-testid="phone-banner-seam" />
          <Zone>{t('images.tallTop')}</Zone>
          <Zone $below>{t('images.tallBottom')}</Zone>
        </>
      ) : null}
    </Frame>
  );
}
