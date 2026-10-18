import { keyframes, styled } from 'styled-components';

const turn = keyframes`to { transform: rotate(360deg); }`;

/** A small ring for a "Saving…" button (plan 103 fix 7, plan 105); it holds still with Reduce Motion. */
export const SavingSpinner = styled.span.attrs({ 'aria-hidden': true })`
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 0.125rem solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;

  @media (prefers-reduced-motion: no-preference) {
    animation: ${turn} 0.8s linear infinite;
  }
`;
