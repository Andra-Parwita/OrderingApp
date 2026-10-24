import { css } from 'styled-components';

// Plan 122: on an iPhone home-screen app the page draws under the status bar (black-translucent) and the
// clock is white. A soft dark fade behind it keeps it readable on a pale picture or page.
//
// The one switch is `--sat` (= env(safe-area-inset-top), GlobalStyle): it is 0 in every browser, on
// Android and in the iPhone Safari tab, and above 0 only where the page runs under the bar. The fade's
// height is `min(<fade px>, --sat * 1000)`, so it is 0 px (paints nothing, no JS, no flash) unless
// `--sat` > 0. It is a pseudo-element: no node for screen readers, and it never takes a tap.

// The fade heights are exact device pixels (the approved mock-up), not theme spacing.
const BANNER_FADE_PX = '60px';
const PAGE_FADE_PX = '40px';

const ink = (alpha: number): string => `rgba(20, 17, 12, ${alpha})`;

/** The banner's fade (60 px; rgb(20,17,12): .62 at the edge, .60 at 24 px, .50 at 40 px, .22 at 52 px, 0 at 60 px). */
export const bannerFade = css`
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1;
    height: min(${BANNER_FADE_PX}, calc(var(--sat) * 1000));
    pointer-events: none;
    background: linear-gradient(
      180deg,
      ${ink(0.62)} 0,
      ${ink(0.6)} 40%,
      ${ink(0.5)} 66.7%,
      ${ink(0.22)} 86.7%,
      ${ink(0)} 100%
    );
  }
`;

/** A page with no banner: a thinner, softer fade (40 px, .35 to 0), fixed so the clock stays readable while scrolling. */
export const pageFade = css`
  &::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 6;
    height: min(${PAGE_FADE_PX}, calc(var(--sat) * 1000));
    pointer-events: none;
    background: linear-gradient(
      180deg,
      ${ink(0.35)} 0,
      ${ink(0.3)} 40%,
      ${ink(0.16)} 70%,
      ${ink(0)} 100%
    );
  }
`;

// The blurred band (plan 122 follow-up): in the safe-area band above a banner picture, a soft, enlarged,
// slightly darkened copy of the same picture, so the clock sits on "the picture continuing" instead of a flat
// colour. The real picture below stays whole (3:1, uncropped). Same `--sat` switch: the band is `--sat` tall,
// so it is 0 px (nothing painted) everywhere but the iPhone home-screen app.
const BLUR_PX = '20px';
const BLUR_DIM = 0.85; // brightness: the copy reads a little darker than the picture
const BLUR_BLEED_PX = '48px'; // the copy reaches this far past the band, so the blurred edges are clipped away
const BLUR_REVEAL_MS = '120ms';

/** The clip around the blurred copy: exactly the safe-area band, behind the real picture and the fade. */
export const blurBand = css`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--sat);
  overflow: hidden;
  pointer-events: none;
`;

/** The blurred copy itself: bigger than the band (cover), hidden until its picture has loaded and decoded. */
export const blurImage = css<{ $shown: boolean }>`
  position: absolute;
  top: -${BLUR_BLEED_PX};
  left: -${BLUR_BLEED_PX};
  right: -${BLUR_BLEED_PX};
  bottom: -${BLUR_BLEED_PX};
  width: calc(100% + 2 * ${BLUR_BLEED_PX});
  height: calc(100% + 2 * ${BLUR_BLEED_PX});
  object-fit: cover;
  object-position: center top;
  filter: blur(${BLUR_PX}) brightness(${BLUR_DIM});
  opacity: ${({ $shown }) => ($shown ? 1 : 0)};
  transition: opacity ${BLUR_REVEAL_MS} ease-out;
`;

/**
 * The kitchen's own banner background picture (1280 x 256), shown instead of the blurred copy when the kitchen
 * has one: cover-fitted and centred into the band, sharp and not enlarged beyond cover. Same reveal as the blur.
 */
export const bandPicture = css<{ $shown: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  opacity: ${({ $shown }) => ($shown ? 1 : 0)};
  transition: opacity ${BLUR_REVEAL_MS} ease-out;
`;
