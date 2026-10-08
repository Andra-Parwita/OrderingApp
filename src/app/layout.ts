// Seller layout sizes. From 1024 px the bottom tab bar becomes a left rail and the order list
// becomes a table with a slide-over panel (D-031). Below that, including 820 to 1023 px, the
// phone layout is used as it is.
export const DESKTOP_MIN_PX = 1024;
export const DESKTOP_QUERY = `(min-width: ${DESKTOP_MIN_PX}px)`;
export const RAIL_WIDTH = '14rem';
export const RAIL_WIDTH_COLLAPSED = '3.5rem';
// The seller banner image area never grows past this; wider screens show the seller's colour.
export const BANNER_MAX_WIDTH = '1600px';
