import { createGlobalStyle } from 'styled-components';
import { brandColour } from './brandTokens';

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }
  :root {
    --sat: env(safe-area-inset-top, 0px);
    --sab: env(safe-area-inset-bottom, 0px);
    /* The ShaggyBobo leaf colour (plan 028): edit it here in DevTools to try others live. */
    --mascot-leaf: ${brandColour.leaf};
  }
  html { color-scheme: ${({ theme }) => theme.mode}; }
  body {
    margin: 0;
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
