// ShaggyBobo's own branding (plan 028): the admin pages and the seller's first set-up. These are
// the brand's fixed art values, the same in light and dark themes, kept here so the styled
// components use tokens (D-006). Dark brown text (#2B1D12) on beige (#EADBC2) is well above 4.5:1.

export const brandColour = {
  beige: '#EADBC2',
  ink: '#2B1D12',
  /** The logo's "Shaggy" on light, and the dark-mode logo box. */
  logoInk: '#392619',
  logoInkOnDark: '#FFFDF7',
  logoBoxDark: '#2B1D12',
  bobo: '#E87520',
  /** The leaves on the logo and the walking mascot (the owner's pick), as `--mascot-leaf` on :root. */
  leaf: '#A34F38',
  /** The version pill's status dot. */
  dot: '#7FAF6E',
  /** The skin around the walking mascot's eyes and the eye outline, sampled from the picture. */
  skin: '#FCB448',
  eyeOutline: '#5A2D14',
} as const;

export const brandSize = {
  /** The header and footer of the brand column, and the phone's top and bottom bars. */
  bar: '72px',
  phoneBar: '56px',
  logoHeight: '32px',
  logoGap: '4px',
  logoFontSize: '15.5px',
  logoLetterSpacing: '-0.7px',
  logoBoxPadding: '6px 14px 6px 10px',
  hairline: '1px',
  footerRowGap: '4px',
  /** The letters' hop and the mascot's bounce. */
  hop: '-3px',
  bounce: '-12px',
  /** The mascot's feet above the footer (owner: "like 50px from footer top"), and its widest. */
  mascotBottom: '50px',
  mascotMaxWidth: '380px',
} as const;

export const brandShadow = {
  mascot: 'drop-shadow(0 14px 10px rgb(43 29 18 / 30%))',
} as const;
