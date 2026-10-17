import { createContext, useContext } from 'react';
import { styled } from 'styled-components';
import type { Kitchen, Language } from '../../shared/domain';
import { bannerAlt, phoneBannerSrc } from '../../shared/kitchenImages';
import { ImageSlot } from '../ui';

const BannerTop = styled.div<{ $background?: string }>`
  padding-top: var(--sat);
  background: ${({ theme, $background }) => $background ?? theme.c.surf2};
`;

/**
 * True inside the customer shell's page area: the shell draws the banner once, above the sliding
 * page (plan 093), so the pages leave theirs out. Elsewhere (seller preview, fixtures) it is false.
 */
export const ShellOwnsBanner = createContext(false);

/** The kitchen's banner picture, on top of the customer pages (Menu, My orders, Settings). */
export function KitchenBanner({
  kitchen,
  lang,
  placeholder,
}: Readonly<{ kitchen: Kitchen; lang: Language; placeholder: string }>) {
  const shellOwns = useContext(ShellOwnsBanner);
  if (shellOwns) return null;
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
