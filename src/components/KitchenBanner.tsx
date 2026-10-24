import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { css, styled } from 'styled-components';
import type { Kitchen, Language } from '../../shared/domain';
import { bannerAlt, phoneBannerSrc } from '../../shared/kitchenImages';
import { ImageSlot } from '../ui';
import { bandPicture, bannerFade, blurBand, blurImage } from './statusBarFade';

// A tall (2:1) banner (plan 123) has no fade: its own top part runs behind the clock, as drawn.
const tallTop = css`
  position: relative;
`;
const BannerTop = styled.div<{ $background?: string; $tall: boolean }>`
  /* The safe-area band (0 px except in an iPhone home-screen app, plan 122) carries the picture's colour,
     and, once loaded, the kitchen's background picture or a blurred copy of the banner (BandPictures). A tall
     banner's picture reaches up over it instead (plan 123). */
  padding-top: var(--sat);
  background: ${({ theme, $background }) => $background ?? theme.c.surf2};
  ${({ $tall }) => ($tall ? tallTop : bannerFade)}
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

/**
 * Tells the shell whether the thin page fade (plan 122) must stay off: true while a tall banner is in view, so
 * the fade never darkens it (plan 123). Without IntersectionObserver the banner counts as in view.
 */
function useTallBannerInView(
  box: RefObject<HTMLDivElement | null>,
  tall: boolean,
  report: ((inView: boolean) => void) | undefined,
) {
  useEffect(() => {
    if (!report || !tall) return;
    const element = box.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      report(true);
      return () => report(false);
    }
    const observer = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      if (last) report(last.isIntersecting);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      report(false);
    };
  }, [box, tall, report]);
}

/**
 * The kitchen's banner picture, on top of the customer pages (Menu, My orders, Settings).
 *
 * A tall (2:1, plan 123) picture shows only its bottom 3:1 here, like any banner; in the iPhone home-screen app it
 * reaches up over the safe-area band, one image, no blur and no fade. `onTallInView` tells the shell while that
 * tall banner is on screen.
 */
export function KitchenBanner({
  kitchen,
  lang,
  placeholder,
  onTallInView,
}: Readonly<{
  kitchen: Kitchen;
  lang: Language;
  placeholder: string;
  onTallInView?: (inView: boolean) => void;
}>) {
  const shellOwns = useContext(ShellOwnsBanner);
  const src = phoneBannerSrc(kitchen.images) ?? kitchen.bannerImageUrl;
  // The address of the banner found to be tall; a new picture starts again as not tall.
  const [tallSrc, setTallSrc] = useState<string | undefined>(undefined);
  const tall = src !== undefined && tallSrc === src;
  const onTall = useCallback((isTall: boolean) => setTallSrc(isTall ? src : undefined), [src]);
  const boxRef = useRef<HTMLDivElement>(null);
  useTallBannerInView(boxRef, tall && !shellOwns, onTallInView);
  if (shellOwns) return null;
  return (
    <BannerTop ref={boxRef} $background={kitchen.images?.bannerBackground} $tall={tall}>
      <ImageSlot
        aspectRatio="3 / 1"
        background={kitchen.images?.bannerBackground}
        src={src}
        alt={bannerAlt(kitchen, lang)}
        placeholder={placeholder}
        eager
        reveal
        anchorTall
        intoSafeArea
        onTall={onTall}
      />
      {/* After the picture in the page order (the picture comes first for readers); it paints in the safe-area band above it. */}
      {tall ? null : (
        <BandPictures
          key={kitchen.images?.bannerBackgroundImage ?? ''}
          src={src}
          backgroundSrc={kitchen.images?.bannerBackgroundImage}
        />
      )}
    </BannerTop>
  );
}
