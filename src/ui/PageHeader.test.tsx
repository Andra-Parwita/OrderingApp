import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from 'styled-components';
import { lightTheme } from '../theme/themes';
import { PageHeader } from './PageHeader';

// Plan 122: the safe area is the header's stick offset (`--sat`, 0 outside an iPhone home-screen app), never
// its padding, so under a banner (or the shell's own padding) the header adds no second gap, and the seller
// app (where `--sat` is 0) is laid out exactly as before.

const pageCss = () =>
  Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent)
    .join('')
    .replace(/\s+/g, '');

describe('PageHeader and the safe area', () => {
  it('sticks below the notch and adds no safe-area padding of its own', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <PageHeader title="Basket" />
      </ThemeProvider>,
    );
    const css = pageCss();
    expect(css).toContain('position:sticky;top:calc(var(--top-bars,0rem)+var(--sat,0rem))');
    expect(css).not.toContain('safe-area-inset-top');
    expect(css).not.toMatch(/padding:calc\(/);
  });
});
