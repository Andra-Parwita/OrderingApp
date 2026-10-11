// COPY of each theme's light-mode page background in src/theme/designTokens.ts (`brands.<theme>.light.bg`).
// The Worker needs it for `<meta name="theme-color">` (plan 024) and shared/ may not import src/.
// src/theme/themeColours.test.ts fails if the two drift apart.
import type { ThemeName } from './themes';

export const THEME_BAR_COLOUR: Record<ThemeName, string> = {
  onde: '#F6F2E8',
  bali: '#F1F4F4',
  sumatra: '#F7F0EE',
  sunda: '#F2F2F7',
  jawa: '#F6F0E6',
};
