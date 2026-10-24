import { act, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Kitchen } from '../../shared/domain';
import { registerCustomerI18n } from '../features/customer-menu';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { ShellBanner } from './ShellBanner';
import { createAppStore } from './store';

// Hotfix 1.0.43.3: the banner stays the quiet block until the picture has loaded and decoded.

const kitchen = {
  name: 'Della Vee',
  images: { phoneBanner: '/images/sellers/s1/phoneBanner-abc.jpg' },
} as unknown as Kitchen;

function setComplete(complete: boolean) {
  Object.defineProperty(HTMLImageElement.prototype, 'complete', {
    configurable: true,
    get: () => complete,
  });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
    configurable: true,
    get: () => (complete ? 1200 : 0),
  });
}

function draw() {
  return render(
    <Provider store={createAppStore()}>
      <AppThemeProvider>
        <ShellBanner state={{ kind: 'kitchen', kitchen }} />
      </AppThemeProvider>
    </Provider>,
  );
}

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  registerCustomerI18n();
  await i18n.changeLanguage('en');
});

afterEach(() => {
  setComplete(false);
  Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
});

describe('ShellBanner reveal', () => {
  it('keeps the placeholder while the picture downloads, then fades it in', async () => {
    setComplete(false);
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: () => Promise.resolve(),
    });
    draw();
    const img = screen.getByRole('img', { hidden: true });
    expect(img.getAttribute('data-reveal')).toBe('hidden');
    expect(img.getAttribute('src')).toBe('/images/sellers/s1/phoneBanner-abc.jpg');
    await act(async () => {
      img.dispatchEvent(new Event('load'));
      await Promise.resolve();
    });
    expect(img.getAttribute('data-reveal')).toBe('fade');
  });

  it('shows a picture that is already complete at once, with no fade', () => {
    setComplete(true);
    draw();
    expect(screen.getByRole('img').getAttribute('data-reveal')).toBe('shown');
  });

  it('shows after load when decode is not supported or fails', async () => {
    setComplete(false);
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: vi.fn(() => Promise.reject(new Error('x'))),
    });
    draw();
    const img = screen.getByRole('img', { hidden: true });
    await act(async () => {
      img.dispatchEvent(new Event('load'));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(img.getAttribute('data-reveal')).toBe('fade');
  });
});
