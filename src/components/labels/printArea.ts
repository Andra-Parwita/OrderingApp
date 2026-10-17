import { css } from 'styled-components';

/**
 * Print only the element marked `data-print-area`, at the page corner (plan 084). Every ancestor of
 * the area is plain flow, so its absolute 0,0 is the page's corner: a fixed, off-screen or positioned
 * parent would carry it off the page or down the sheet. Put it inside `@media print`.
 */
export const printAreaCss = css`
  html,
  body {
    height: auto;
    margin: 0;
    background: white;
  }
  body * {
    visibility: hidden;
  }
  [data-print-area],
  [data-print-area] * {
    visibility: visible;
  }
  :has([data-print-area]) {
    position: static !important;
    inset: auto !important;
    transform: none !important;
    overflow: visible !important;
  }
  [data-print-area] {
    position: absolute;
    top: 0;
    left: 0;
  }
  [data-no-print] {
    display: none;
  }
`;
