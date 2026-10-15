import { brandColour } from '../../theme/brandTokens';

// The About page's own art values (plan 075): the hero's faded scene, in the brand's colours, light
// and dark. Kept here so the styled components use tokens (D-006).

export const heroArt = {
  beige: brandColour.beige,
  /** Scrollbar thumb: the brand orange, lighter in dark mode for contrast on the card. */
  scroll: { light: brandColour.bobo, dark: '#E8954F' },
  scrollHover: { light: '#b8611f', dark: '#F0A566' },
  /** The whole hero is dimmed a little in dark mode. */
  darkFilter: 'brightness(0.82) saturate(0.95)',
  sceneOpacity: 0.72,
  /** The hero slot's fixed shapes (width / height), so nothing shifts while the Lottie loads. */
  aspectPhone: '390 / 104',
  aspectTablet: '672 / 130',
  /** The fade over the picture inside the card (the page colour toward the bottom). */
  fade: {
    light:
      'linear-gradient(to bottom, rgba(234, 219, 194, 0.1) 0%, rgba(234, 219, 194, 0) 30%, rgba(234, 219, 194, 0) 60%, rgba(234, 219, 194, 0.55) 100%)',
    dark: 'linear-gradient(to bottom, rgba(18, 20, 17, 0.15) 0%, rgba(18, 20, 17, 0) 30%, rgba(18, 20, 17, 0) 60%, rgba(18, 20, 17, 0.6) 100%)',
  },
} as const;

/** Pop-out drone Lottie, owner approved 16 Oct: phone 390 x 104 slot, tablet 672 x 130 slot. */
export const LOTTIE_SRC = {
  phone: '/brand/lottie/shaggybobo-phone-popout.json',
  tablet: '/brand/lottie/shaggybobo-tablet-popout.json',
} as const;
