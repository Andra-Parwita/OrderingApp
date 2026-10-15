// Plan 080: the top bars (update, maintenance notice, offline) push the page down. They keep
// `--top-bars` (their total height, 0 with none) on <html>; full-screen layouts use these helpers
// instead of their own `100dvh`, and pinned headers / slide-in panels start at TOP_BARS.
export const TOP_BARS_VAR = '--top-bars';
/** CSS: the height of the bars showing now. */
export const TOP_BARS = `var(${TOP_BARS_VAR}, 0rem)`;
/** CSS: the screen height minus the bars. */
export const SCREEN_HEIGHT = `calc(100dvh - ${TOP_BARS})`;
/** CSS: the same with the old 100vh fallback. */
export const SCREEN_HEIGHT_VH = `calc(100vh - ${TOP_BARS})`;
/** CSS: the screen height minus the bars and one more length (e.g. the customer tab bar). */
export const screenHeightMinus = (extra: string): string => `calc(100dvh - ${TOP_BARS} - ${extra})`;
