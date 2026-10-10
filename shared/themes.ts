// The kitchen's colour themes (D-064). Kept apart so the public menu contract can use them
// without importing the menus contract (which imports the menu contract).
export const THEMES = ['onde', 'bali', 'sumatra', 'sunda', 'jawa'] as const;
export type ThemeName = (typeof THEMES)[number];
export const DEFAULT_THEME: ThemeName = 'onde';
