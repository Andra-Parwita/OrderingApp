import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it } from 'vitest';
import { makeTheme } from '../theme/themes';
import { WalkingMascot } from './BrandMascot';

describe('WalkingMascot', () => {
  it('stacks the layers back to front and hides the closed eyes at rest', () => {
    render(
      <ThemeProvider theme={makeTheme('onde', 'light')}>
        <WalkingMascot />
      </ThemeProvider>,
    );
    const root = screen.getByTestId('mascot');
    expect(root).toHaveAttribute('aria-hidden', 'true');
    const names = [...root.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(names).toEqual([
      '/brand/mascot-leg-right.webp',
      '/brand/mascot-leg-left.webp',
      '/brand/mascot-body.webp',
      '/brand/mascot-eyes-closed.webp',
      '/brand/mascot-arm-spoon.webp',
    ]);
    expect(root.querySelector('.lids')).toHaveStyle({ opacity: '0' });
    expect(root.querySelector('.shadow')).not.toBeNull();
    expect(root.innerHTML).not.toMatch(/leaf|leaves/i);
  });
});
