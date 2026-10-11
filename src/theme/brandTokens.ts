// ShaggyBobo's own branding (plan 036): the admin pages and the seller's first set-up. These are
// the brand's fixed art values, the same in light and dark themes, kept here so the styled
// components use tokens (D-006). Dark brown text (#2B1D12) on beige (#EADBC2) is well above 4.5:1.

export const brandColour = {
  beige: '#EADBC2',
  ink: '#2B1D12',
  bobo: '#d9772b',
  /** The version pill's status dot. */
  dot: '#7FAF6E',
} as const;

/** The pill around the icon and wordmark (plan 044), light and dark: background, border, "Shaggy", shadow. */
export const brandPill = {
  light: {
    bg: '#fff6ea',
    border: '#ead8bf',
    word: '#2a1d14',
    shadow: '0 1px 2px rgb(60 40 20 / 8%), 0 4px 14px rgb(60 40 20 / 6%)',
  },
  dark: { bg: '#2a1d14', border: '#3a2a1d', word: '#fff', shadow: 'none' },
} as const;

export const brandSize = {
  /** The header and footer of the brand column, and the phone's top and bottom bars. */
  bar: '72px',
  phoneBar: '56px',
  logoHeight: '32px',
  logoGap: '8px',
  logoFontSize: '15.5px',
  logoLetterSpacing: '-0.7px',
  logoBoxPadding: '8px 14px 8px 10px',
  pillRadius: '12px',
  hairline: '1px',
  footerRowGap: '4px',
  /** The letters' hop and the mascot's bounce. */
  hop: '-3px',
  /** The mascot's feet above the footer (owner: "like 50px from footer top"), and its widest. */
  mascotBottom: '50px',
  mascotMaxWidth: '380px',
  /** Both legs shifted right on the canvas (`--legs-x`, try it in DevTools). */
  legsX: '15px',
  mascotShadowBlur: '3px',
} as const;

/** The mascot's ground shadow (one number to tune the darkness). */
export const brandShadow = {
  ground: 'rgba(0, 0, 0, 0.7)',
} as const;
