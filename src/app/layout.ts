import { size } from '../theme/designTokens';

// Seller layout sizes (plan 001 stage 2, D-067). The phone subset is below 600 px; from 600 px an
// upright tablet (768 to 1024) already gets the full tablet app: left panel, table, side panel.
// The names keep "DESKTOP" because the screens in `features/` read them; they now mean "not a phone".
export const DESKTOP_MIN_PX = 600;
export const DESKTOP_QUERY = `(min-width: ${DESKTOP_MIN_PX}px)`;
// The left menu's top block (plan 040, D-093), derived from the menu's width so the banner stays in
// step: the logo is 2:1 across the open menu, the kitchen name (with its hairline) sits below it.
// The wide banner is exactly this tall, or shorter when the content is too narrow for its middle
// 1896 x 328 (BANNER_RATIO) to show uncut. Collapsed, the icon fills a square the width of the menu.
export const RAIL_LOGO_PX = size.navOpen / 2;
export const RAIL_NAME_PX = 48;
export const RAIL_TOP_PX = RAIL_LOGO_PX + RAIL_NAME_PX;
export const RAIL_TOP_COLLAPSED_PX = size.navCollapsed + 1; // the icon square and its hairline
export const BANNER_RATIO = '1896 / 328';
// The sheet slides over the banner after this much scrolling (plan 040).
export const BANNER_SCROLL_PX = 8;
// Height of the banner once it shrinks to a strip on task screens (handoff: 40 to 44 px showing, once the sheet rises 16 px over it).
export const BANNER_STRIP_HEIGHT = '3.5rem';
// Sign-in pages (D-051): from this width the kitchen picture sits left of the form, below it above.
export const SPLIT_MIN_PX = 768;
export const SPLIT_QUERY = `(min-width: ${SPLIT_MIN_PX}px)`;
