import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { ThemeProvider } from 'styled-components';
import { GlobalStyle } from './GlobalStyle';
import { darkTheme, lightTheme } from './themes';
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

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const device = useSyncExternalStore(subscribe, deviceDark, () => false);
  const preference = useThemePreference();
  const dark = preference === 'auto' ? device : preference === 'dark';
  const theme = dark ? darkTheme : lightTheme;
  useThemeColourMeta(theme.colour.bg);
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      {children}
    </ThemeProvider>
  );
}
