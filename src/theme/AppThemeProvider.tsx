import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { ThemeProvider } from 'styled-components';
import { GlobalStyle } from './GlobalStyle';
import type { Brand } from './designTokens';
import { useKitchenBrand } from './kitchenBrand';
import { makeTheme } from './themes';
import { useThemePreference } from './themePreference';

const QUERY = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

const deviceDark = () => window.matchMedia(QUERY).matches;

/** Keeps `<meta name="theme-color">` (the browser bar on phones) on the page background. */
function useThemeColourMeta(colour: string): void {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = colour;
  }, [colour]);
}

/**
 * The colour theme is the kitchen's (stage 10): the seller app sets it with `setKitchenBrand`
 * (kitchenBrand.ts). A `brand` prop wins, for tests and previews; Onde Onde until it is known.
 */
export function AppThemeProvider({
  children,
  brand: forced,
}: {
  children: ReactNode;
  brand?: Brand;
}) {
  const kitchen = useKitchenBrand();
  const brand = forced ?? kitchen;
  const device = useSyncExternalStore(subscribe, deviceDark, () => false);
  const preference = useThemePreference();
  const dark = preference === 'auto' ? device : preference === 'dark';
  const theme = useMemo(() => makeTheme(brand, dark ? 'dark' : 'light'), [brand, dark]);
  useThemeColourMeta(theme.colour.bg);
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      {children}
    </ThemeProvider>
  );
}
