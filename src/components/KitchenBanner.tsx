import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import { styled } from 'styled-components';
import type { Kitchen, Language } from '../../shared/domain';
import { bannerAlt, phoneBannerSrc } from '../../shared/kitchenImages';
import { ImageSlot } from '../ui';
import { bandPicture, bannerFade, blurBand, blurImage } from './statusBarFade';

const BannerTop = styled.div<{ $background?: string }>`
  /* The safe-area band (0 px except in an iPhone home-screen app, plan 122) carries the picture's colour,
     and, once loaded, the kitchen's background picture or a blurred copy of the banner (BandPictures). */
  padding-top: var(--sat);
  background: ${({ theme, $background }) => $background ?? theme.c.surf2};
  ${bannerFade}
`;
const Band = styled.div`
  ${blurBand}
`;
const BlurredCopy = styled.img<{ $shown: boolean }>`
  ${blurImage}
`;
const BackgroundPicture = styled.img<{ $shown: boolean }>`
  ${bandPicture}
`;

/** Reveal rule shared by both band pictures: invisible until loaded and decoded (or already complete). */
function useReveal() {
  const ref = useRef<HTMLImageElement>(null);
  const [shown, setShown] = useState(false);
  useLayoutEffect(() => {
    const img = ref.current;
    if (img?.complete && img.naturalWidth > 0) setShown(true);
  }, []);
  const onLoad = () => {
    const img = ref.current;
    const show = () => setShown(true);
    if (img && typeof img.decode === 'function') img.decode().then(show, show);
    else show();
  };
  return { ref, shown, onLoad };
}

/** The soft, enlarged copy of the banner picture. It uses the banner's own address: no extra download. */
function BlurredCopyImage({ src }: Readonly<{ src: string }>) {
  const { ref, shown, onLoad } = useReveal();
  return (
    <BlurredCopy
      ref={ref}
      src={src}
      alt=""
      loading="eager"
      decoding="async"
      data-testid="status-bar-blur"
      $shown={shown}
      onLoad={onLoad}
    />
  );
}

function BackgroundPictureImage({ src, onFail }: Readonly<{ src: string; onFail: () => void }>) {
  const { ref, shown, onLoad } = useReveal();
  return (
    <BackgroundPicture
      ref={ref}
      src={src}
      alt=""
      loading="eager"
      decoding="async"
      data-testid="status-bar-picture"
      $shown={shown}
      onLoad={onLoad}
      onError={onFail}
    />
  );
}

/**
 * What fills the safe-area band behind the clock (plan 122), in this order: the kitchen's banner background
 * picture; else, or if that fails to load, the blurred banner copy; else nothing (the colour band). Decoration:
 * no alt text, hidden from readers, never takes a tap.
 *
 * The band is `--sat` tall, so it is 0 px outside the iPhone home-screen app. An `<img>` in a 0 px box is still
 * fetched, so the background picture is mounted only once the band is measured above 0 px: no extra download in
 * browsers or on Android (the blurred copy reuses the banner's own address, so it costs nothing).
 */
function BandPictures({
  src,
  backgroundSrc,
}: Readonly<{ src: string | undefined; backgroundSrc: string | undefined }>) {
  const bandRef = useRef<HTMLDivElement>(null);
  const [underBar, setUnderBar] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  useLayoutEffect(() => {
    setUnderBar((bandRef.current?.offsetHeight ?? 0) > 0);
  }, []);
  const wantsBackground = backgroundSrc !== undefined && !failed;
  let content = null;
  if (wantsBackground && underBar) {
    content = <BackgroundPictureImage src={backgroundSrc} onFail={() => setFailed(true)} />;
  } else if (src && (!wantsBackground || underBar === false)) {
    content = <BlurredCopyImage key={src} src={src} />;
  }
  return (
    <Band ref={bandRef} aria-hidden="true" data-testid="status-bar-band">
      {content}
    </Band>
  );
}

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
  const src = phoneBannerSrc(kitchen.images) ?? kitchen.bannerImageUrl;
  return (
    <BannerTop $background={kitchen.images?.bannerBackground}>
      <ImageSlot
        aspectRatio="3 / 1"
        background={kitchen.images?.bannerBackground}
        src={src}
        alt={bannerAlt(kitchen, lang)}
        placeholder={placeholder}
        eager
        reveal
      />
      {/* After the picture in the page order (the picture comes first for readers); it paints in the safe-area band above it. */}
      <BandPictures
        key={kitchen.images?.bannerBackgroundImage ?? ''}
        src={src}
        backgroundSrc={kitchen.images?.bannerBackgroundImage}
      />
    </BannerTop>
  );
}
