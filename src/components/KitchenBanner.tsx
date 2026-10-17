import { styled } from 'styled-components';
import type { Kitchen, Language } from '../../shared/domain';
import { bannerAlt, phoneBannerSrc } from '../../shared/kitchenImages';
import { ImageSlot } from '../ui';

const BannerTop = styled.div<{ $background?: string }>`
  padding-top: var(--sat);
  background: ${({ theme, $background }) => $background ?? theme.c.surf2};
`;

/** The kitchen's banner picture, on top of the customer pages (Menu, My orders, Settings). */
export function KitchenBanner({
  kitchen,
  lang,
  placeholder,
}: Readonly<{ kitchen: Kitchen; lang: Language; placeholder: string }>) {
  return (
    <BannerTop $background={kitchen.images?.bannerBackground}>
      <ImageSlot
        aspectRatio="3 / 1"
        background={kitchen.images?.bannerBackground}
        src={phoneBannerSrc(kitchen.images) ?? kitchen.bannerImageUrl}
        alt={bannerAlt(kitchen, lang)}
        placeholder={placeholder}
      />
    </BannerTop>
  );
}
