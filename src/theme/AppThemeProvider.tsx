import { useSyncExternalStore, type ReactNode } from 'react';
import { ThemeProvider } from 'styled-components';
import { GlobalStyle } from './GlobalStyle';
import { darkTheme, lightTheme } from './themes';

const QUERY = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

const prefersDark = () => window.matchMedia(QUERY).matches;

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const dark = useSyncExternalStore(subscribe, prefersDark, () => false);
  return (
    <ThemeProvider theme={dark ? darkTheme : lightTheme}>
      <GlobalStyle />
      {children}
    </ThemeProvider>
  );
}
