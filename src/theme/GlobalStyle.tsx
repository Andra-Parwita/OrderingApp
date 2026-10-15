import { createGlobalStyle } from 'styled-components';
import { brandSize } from './brandTokens';
import { TOP_BARS } from './screen';

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }
  :root {
    --sat: env(safe-area-inset-top, 0px);
    --sab: env(safe-area-inset-bottom, 0px);
    /* The mascot's legs shifted right (plan 044): edit it on <html> in DevTools to try values live. */
    --legs-x: ${brandSize.legsX};
  }
  html { color-scheme: ${({ theme }) => theme.mode}; }
  body {
    margin: 0;
    /* Plan 080: the top bars (update, notice, offline) push the page down. */
    padding-top: ${TOP_BARS};
    background: ${({ theme }) => theme.colour.bg};
    color: ${({ theme }) => theme.colour.text};
    font-family: ${({ theme }) => theme.font.ui};
    font-size: ${({ theme }) => theme.type.size.md};
    line-height: ${({ theme }) => theme.type.lineHeight.normal};
    font-variant-numeric: tabular-nums;
  }
  :focus-visible {
    outline: 2px solid ${({ theme }) => theme.colour.focus};
    outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition: none !important; animation: none !important; }
  }
`;
