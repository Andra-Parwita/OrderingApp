import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeAll, describe, expect, it } from 'vitest';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { BrandLogo } from './BrandLogo';
import { BrandColumn } from './BrandPanel';

beforeAll(async () => {
  await initI18n();
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
});

describe('BrandLogo', () => {
  it('has the same animated letters and icon in the left brand bar as on the form side', () => {
    render(
      <AppThemeProvider>
        <MemoryRouter>
          <BrandColumn page="admin" />
          <BrandLogo />
        </MemoryRouter>
      </AppThemeProvider>,
    );
    const [bar, form] = screen.getAllByRole('img', { name: 'ShaggyBobo' }) as [
      HTMLElement,
      HTMLElement,
    ];
    const letters = (el: HTMLElement) =>
      [...el.querySelectorAll('span[aria-hidden] span')].filter((l) => l.textContent?.length === 1);
    expect(letters(bar)).toHaveLength(10);
    expect(letters(bar).map((l) => l.className)).toEqual(letters(form).map((l) => l.className));
    expect(getComputedStyle(letters(bar)[0]!).display).toBe('inline-block');
    expect(bar.querySelector('img')?.className).toBe(form.querySelector('img')?.className);
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('');
    expect(css).toMatch(/animation:[^;]*6s ease-in-out infinite/);
    expect(css).toMatch(/animation:[^;]*4s ease-in-out infinite/);
  });

  it('lays the left column header over the scene without a solid background', () => {
    render(
      <AppThemeProvider>
        <MemoryRouter>
          <BrandColumn page="admin" />
        </MemoryRouter>
      </AppThemeProvider>,
    );
    const header = screen.getByTestId('brand-header');
    const style = getComputedStyle(header);
    expect(style.position).toBe('absolute');
    expect(style.top).toBe('0px');
    expect(style.backgroundColor).toMatch(/^(|transparent|rgba\(0, 0, 0, 0\))$/);
    expect(header.querySelector('[aria-label="ShaggyBobo"]')).not.toBeNull();
  });
});
