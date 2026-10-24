import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Kitchen } from '../../shared/domain';
import { KitchenBanner } from '../components/KitchenBanner';
import { registerInstallI18n } from '../components/install';
import { registerCustomerI18n } from '../features/customer-menu';
import { registerCustomerOrdersI18n } from '../features/customer-orders';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { AppRoutes } from './AppRoutes';
import { createAppStore } from './store';

// Plan 123: a tall (2:1, 1200 x 600) phone banner. Only its bottom 3:1 shows like any banner; in the iPhone
// home-screen app (`--sat` > 0) the same picture reaches up over the clock band, with no blur and no fade, and
// the thin page fade stays off while the banner is on screen. The shape is read from the loaded picture.
// jsdom cannot lay CSS out, so these tests read the rules the page rendered.

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
  registerCustomerOrdersI18n();
  registerInstallI18n();
  await i18n.changeLanguage('en');
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const pageCss = () =>
  Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent)
    .join('')
    .replace(/\s+/g, '');

/** Whether any class of this element has a `::before` rule (a fade) in the page. */
const hasFade = (element: Element) =>
  element.className.split(' ').some((name) => pageCss().includes(`.${name}::before{`));

const BANNER = '/samples/banner.jpg';
const BACKGROUND = '/samples/banner-bg.jpg';
const kitchen = (images: Kitchen['images']): Kitchen =>
  ({ name: 'Dapur', slug: 'dapur', images }) as unknown as Kitchen;

/** Tells the page the picture's pixel size and fires its load, like the browser does. */
function loaded(picture: HTMLElement, width: number, height: number) {
  Object.defineProperty(picture, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(picture, 'naturalHeight', { value: height, configurable: true });
  fireEvent.load(picture);
}

const bandHeight = (px: number) =>
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(px);

function renderBanner(images: Kitchen['images'], onHoldFade?: (hold: boolean) => void) {
  return render(
    <AppThemeProvider>
      <KitchenBanner
        kitchen={kitchen(images)}
        lang="en"
        placeholder="Dapur"
        {...(onHoldFade ? { onHoldFade } : {})}
      />
    </AppThemeProvider>,
  );
}
const bannerPicture = () => screen.getByAltText('Dapur banner');

describe('a tall phone banner on the customer pages (plan 123)', () => {
  it('shows only the bottom 3:1: cover-fitted, anchored at the bottom, in a 3:1 box', async () => {
    renderBanner({ phoneBanner: BANNER });
    const picture = bannerPicture();
    expect(picture.parentElement?.getAttribute('data-ratio')).toBe('3 / 1');
    loaded(picture, 1200, 600);
    await waitFor(() => expect(picture).toHaveStyle({ objectFit: 'cover' }));
    expect(picture).toHaveStyle({ objectPosition: 'center bottom' });
  });

  it('an old 3:1 banner is untouched: whole picture, no anchoring, the 1.0.44 fade and blur', () => {
    bandHeight(62);
    renderBanner({ phoneBanner: BANNER });
    const picture = bannerPicture();
    loaded(picture, 1200, 400);
    expect(picture).toHaveStyle({ objectFit: 'contain' });
    expect(getComputedStyle(picture).objectPosition).not.toBe('center bottom');
    expect(hasFade(picture.parentElement?.parentElement as Element)).toBe(true);
    expect(screen.getByTestId('status-bar-blur').getAttribute('src')).toBe(BANNER);
  });

  it('the wide banner used as a fallback (not 2:1) stays whole too', () => {
    renderBanner({ desktopBanner: BANNER });
    const picture = bannerPicture();
    loaded(picture, 3840, 328);
    expect(picture).toHaveStyle({ objectFit: 'contain' });
  });

  it('with --sat > 0: the picture reaches up over the clock band, with no blur, no band picture, no fade', async () => {
    bandHeight(62);
    renderBanner({ phoneBanner: BANNER, bannerBackgroundImage: BACKGROUND });
    // Before the shape is known the band behaves as in 1.0.44.
    expect(screen.getByTestId('status-bar-picture').getAttribute('src')).toBe(BACKGROUND);
    const picture = bannerPicture();
    const top = picture.parentElement?.parentElement as Element;
    expect(hasFade(top)).toBe(true);
    loaded(picture, 1200, 600);
    await waitFor(() => expect(screen.queryByTestId('status-bar-picture')).toBeNull());
    expect(screen.queryByTestId('status-bar-blur')).toBeNull();
    expect(screen.queryByTestId('status-bar-band')).toBeNull();
    expect(hasFade(top)).toBe(false);
    // One image: it starts a safe-area band above its 3:1 box and is taller by exactly that band.
    expect(pageCss()).toContain('top:calc(var(--sat)*-1);height:calc(100%+var(--sat))');
    // No second download: the only picture is the banner's own.
    expect(document.querySelectorAll('img')).toHaveLength(1);
  });

  it('keeps the reveal rule: the tall picture is invisible until it has loaded', () => {
    renderBanner({ phoneBanner: BANNER });
    expect(bannerPicture().getAttribute('data-reveal')).toBe('hidden');
  });

  it('tells the shell to hold its fixed fade from the first render, and while a tall banner is on screen', async () => {
    const observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
          observers.push(callback);
        }
        observe = () => undefined;
        disconnect = () => undefined;
      },
    );
    const report = vi.fn();
    renderBanner({ phoneBanner: BANNER }, report);
    // Regression (iPhone, 1.0.44.1): a fixed fade at the top edge over the not yet known picture blurred and
    // dimmed it on iOS 26. Nothing fixed may be there on the first render.
    expect(report).toHaveBeenLastCalledWith(true);
    expect(observers).toHaveLength(0); // not known to be tall yet: nothing watched
    loaded(bannerPicture(), 1200, 600);
    await waitFor(() => expect(observers).toHaveLength(1));
    expect(report).toHaveBeenLastCalledWith(true); // still held until the observer says otherwise
    observers[0]?.([{ isIntersecting: true }]);
    expect(report).toHaveBeenLastCalledWith(true);
    observers[0]?.([{ isIntersecting: false }]);
    expect(report).toHaveBeenLastCalledWith(false);
  });

  it('a 3:1 banner lets go of the fade as soon as its shape is known', () => {
    const report = vi.fn();
    renderBanner({ phoneBanner: BANNER }, report);
    expect(report).toHaveBeenLastCalledWith(true);
    loaded(bannerPicture(), 1200, 400);
    expect(report).toHaveBeenLastCalledWith(false);
  });

  it('no banner picture never holds the fade', () => {
    const report = vi.fn();
    renderBanner(undefined, report);
    expect(report).toHaveBeenLastCalledWith(false);
    expect(report).not.toHaveBeenCalledWith(true);
  });
});

describe('the shell page fade over a tall banner (plan 123)', () => {
  it('is hidden while the tall banner is in view and appears when it has scrolled away', async () => {
    const observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
          observers.push(callback);
        }
        observe = () => undefined;
        disconnect = () => undefined;
      },
    );
    render(
      <Provider store={createAppStore()}>
        <AppThemeProvider>
          <MemoryRouter initialEntries={['/onde-onde']}>
            <AppRoutes />
          </MemoryRouter>
        </AppThemeProvider>
      </Provider>,
    );
    const copy = await screen.findByTestId('status-bar-blur');
    const real = screen.getAllByRole('img').find((img) => img !== copy && img.getAttribute('src'));
    const wrap = (await screen.findByRole('navigation', { name: 'Customer' }))
      .parentElement as Element;
    // Regression: shape not known yet, so no fixed fade over the picture on the first paint.
    expect(hasFade(wrap)).toBe(false);
    loaded(real as HTMLElement, 1200, 600);
    await waitFor(() => expect(observers.length).toBeGreaterThan(0));
    const watch = observers[observers.length - 1];
    watch?.([{ isIntersecting: true }]);
    await waitFor(() => expect(hasFade(wrap)).toBe(false));
    watch?.([{ isIntersecting: false }]);
    await waitFor(() => expect(hasFade(wrap)).toBe(true));
  });

  it('a 3:1 banner gets the thin fade (as in 1.0.44) once its shape is known', async () => {
    render(
      <Provider store={createAppStore()}>
        <AppThemeProvider>
          <MemoryRouter initialEntries={['/onde-onde']}>
            <AppRoutes />
          </MemoryRouter>
        </AppThemeProvider>
      </Provider>,
    );
    const copy = await screen.findByTestId('status-bar-blur');
    const real = screen.getAllByRole('img').find((img) => img !== copy && img.getAttribute('src'));
    const wrap = (await screen.findByRole('navigation', { name: 'Customer' }))
      .parentElement as Element;
    expect(hasFade(wrap)).toBe(false);
    loaded(real as HTMLElement, 1200, 400);
    await waitFor(() => expect(hasFade(wrap)).toBe(true));
  });
});
