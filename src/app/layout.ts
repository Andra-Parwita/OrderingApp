// Seller layout sizes (plan 001 stage 2, D-067). The phone subset is below 600 px; from 600 px an
// upright tablet (768 to 1024) already gets the full tablet app: left panel, table, side panel.
// The names keep "DESKTOP" because the screens in `features/` read them; they now mean "not a phone".
export const DESKTOP_MIN_PX = 600;
export const DESKTOP_QUERY = `(min-width: ${DESKTOP_MIN_PX}px)`;
// The seller banner image area never grows past this; wider screens show the seller's colour.
export const BANNER_MAX_WIDTH = '1600px';
// Height of the banner once it shrinks to a strip on task screens (handoff: 40 to 44 px showing, once the sheet rises 16 px over it).
export const BANNER_STRIP_HEIGHT = '3.5rem';
// Sign-in pages (D-051): from this width the kitchen picture sits left of the form, below it above.
export const SPLIT_MIN_PX = 768;
export const SPLIT_QUERY = `(min-width: ${SPLIT_MIN_PX}px)`;
