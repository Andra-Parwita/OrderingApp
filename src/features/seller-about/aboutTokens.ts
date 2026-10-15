import { brandColour } from '../../theme/brandTokens';

// The About page's own art values (plan 075): the hero's faded scene, in the brand's colours, light
// and dark. Kept here so the styled components use tokens (D-006).

export const heroArt = {
  beige: brandColour.beige,
  /** Scrollbar thumb: the brand orange, lighter in dark mode for contrast on the card. */
  scroll: { light: brandColour.bobo, dark: '#E8954F' },
  scrollHover: { light: '#b8611f', dark: '#F0A566' },
  /** The wash over the scene: clear in the middle, the hero's colour toward the bottom. */
  wash: {
    light:
      'linear-gradient(180deg, rgba(234, 219, 194, 0.1) 0%, rgba(234, 219, 194, 0) 45%, rgba(234, 219, 194, 0.55) 100%)',
    dark: 'linear-gradient(180deg, rgba(18, 20, 17, 0.15) 0%, rgba(18, 20, 17, 0) 45%, rgba(18, 20, 17, 0.6) 100%)',
  },
  /** The whole hero is dimmed a little in dark mode. */
  darkFilter: 'brightness(0.82) saturate(0.95)',
  sceneOpacity: 0.72,
  /** Heights, as rem: phone 104 px, tablet 130 px. */
  heightPhone: '6.5rem',
  heightTablet: '8.125rem',
} as const;

/** Lottie files by screen shape: phone 1200 x 320, tablet 1200 x 231 (the hero's aspect decides). */
export const LOTTIE_SRC = {
  phone: '/brand/lottie/shaggybobo-phone-calm.json',
  tablet: '/brand/lottie/shaggybobo-tablet-calm.json',
} as const;
/** Between the two files' aspect ratios (3.75 and 5.2): wider than this takes the tablet file. */
export const WIDE_ASPECT = 4.5;
