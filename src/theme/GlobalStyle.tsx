import { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }
  html { color-scheme: ${({ theme }) => theme.mode}; }
  body {
    margin: 0;
    background: ${({ theme }) => theme.colour.bg};
    color: ${({ theme }) => theme.colour.text};
    font-family: ${({ theme }) => theme.type.family};
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
