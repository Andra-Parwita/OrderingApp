import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Kitchen } from '../../shared/domain';
import { KitchenBanner } from '../components/KitchenBanner';
import indexHtml from '../../index.html?raw';
import { registerInstallI18n } from '../components/install';
import { registerCustomerI18n } from '../features/customer-menu';
import { registerCustomerOrdersI18n } from '../features/customer-orders';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { AppRoutes } from './AppRoutes';
import { createAppStore } from './store';

// Plan 122: the iPhone home-screen app draws the page under the status bar. `--sat` (the safe-area inset,
// 0 everywhere except there) decides everything: the banner grows by it, the fades are `min(<px>, --sat * 1000)`
// tall (0 px unless `--sat` > 0), and a page with no banner is padded down by it. jsdom cannot lay CSS out,
// so these tests read the rules the page rendered.

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
});

/** The style text of the page, with white space removed so a rule can be matched on its own. */
const pageCss = () =>
  Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent)
    .join('')
    .replace(/\s+/g, '');

function renderAt(path: string) {
  return render(
    <Provider store={createAppStore()}>
      <AppThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AppThemeProvider>
    </Provider>,
  );
}

const BANNER_FADE = 'height:min(60px,calc(var(--sat)*1000))';
const PAGE_FADE = 'height:min(40px,calc(var(--sat)*1000))';
const BLUR_BAND = 'height:var(--sat);overflow:hidden';
const BANNER_HEIGHT = '--customer-banner-height:calc(min(100vw,30rem)/3+var(--sat))';

describe('iPhone status bar (plan 122)', () => {
  it('index.html, shared with seller and admin, keeps the default bar', () => {
    expect(indexHtml).not.toContain('apple-mobile-web-app-status-bar-style');
  });

  it('a page with a banner: the banner grows by the safe area and has the 60 px fade', async () => {
    renderAt('/onde-onde');
    await waitFor(() => expect(pageCss()).toContain('padding-top:var(--sat);background:'));
    const css = pageCss();
    expect(css).toContain(BANNER_HEIGHT); // pages below start where they did (banner height + notch)
    expect(css).toContain(BANNER_FADE);
    expect(css).toContain('rgba(20,17,12,0.62)0');
    expect(css).toContain('rgba(20,17,12,0.22)86.7%');
    expect(css).toContain('padding-top:0px;padding-bottom:var(--customer-tabbar-height)'); // the shell adds none
    // The fade is a pseudo-element: no node in the page, so nothing for a screen reader or a tap.
    expect(screen.queryByTestId('status-bar-fade')).toBeNull();
  });

  it('a page with a banner: a blurred copy of the picture fills the safe-area band, only under --sat', async () => {
    renderAt('/onde-onde');
    const copy = await screen.findByTestId('status-bar-blur');
    const banner = screen.getByTestId('status-bar-band');
    const real = screen.getAllByRole('img').find((img) => img !== copy && img.getAttribute('src'));
    // The same address as the banner picture (no extra download), as decoration.
    expect(copy?.getAttribute('src')).toBeTruthy();
    expect(copy?.getAttribute('src')).toBe(real?.getAttribute('src'));
    expect(copy?.getAttribute('alt')).toBe('');
    expect(banner.getAttribute('aria-hidden')).toBe('true');
    // Not loaded yet: invisible, so a half-loaded copy never shows.
    expect(getComputedStyle(copy as Element).opacity).toBe('0');
    // The clip is `--sat` tall (0 px unless the page runs under the bar); the copy is blurred, dimmed, cover.
    const css = pageCss();
    expect(css).toContain(BLUR_BAND);
    expect(css).toContain('filter:blur(20px)brightness(0.85)');
    expect(css).toContain('object-fit:cover');
  });

  it('the blurred copy shows once the banner picture has loaded', async () => {
    renderAt('/onde-onde');
    const copy = await screen.findByTestId<HTMLImageElement>('status-bar-blur');
    fireEvent.load(copy);
    await waitFor(() => expect(getComputedStyle(copy).opacity).toBe('1'));
  });

  it('a page with a banner also has the fixed thin fade behind the clock', async () => {
    renderAt('/onde-onde');
    await screen.findByTestId('status-bar-blur');
    const css = pageCss();
    expect(css).toContain(BANNER_FADE);
    expect(css).toContain(PAGE_FADE); // one fixed fade for every customer page, banner or not
    expect(css).toContain('position:fixed;top:0;left:0;right:0;z-index:6;height:min(40px');
  });

  it('without a banner: padded down by the safe area, with the thin 40 px fade', async () => {
    renderAt('/settings/start-fresh');
    await screen.findByRole('heading', { name: 'Start fresh' });
    const css = pageCss();
    expect(css).toContain('--customer-banner-height:var(--sat)');
    expect(css).toContain('padding-top:var(--sat);padding-bottom:var(--customer-tabbar-height)');
    expect(css).toContain(PAGE_FADE);
    expect(css).toContain('rgba(20,17,12,0.35)0');
  });

  it('the pages themselves no longer add the safe area under the shell', async () => {
    renderAt('/settings/start-fresh');
    await screen.findByRole('heading', { name: 'Start fresh' });
    // Back button and titles: the shell pads (or the banner covers) the safe area once.
    expect(pageCss()).not.toMatch(/margin-top:calc\(var\(--sat\)\+/);
    expect(pageCss()).not.toMatch(/padding:calc\(var\(--sat\)\+/);
  });

  describe('the safe-area band picture (A4)', () => {
    const BANNER = '/samples/banner.jpg';
    const BACKGROUND = '/samples/banner-bg.jpg';
    const kitchen = (images: Kitchen['images']): Kitchen =>
      ({ name: 'Dapur', slug: 'dapur', images }) as unknown as Kitchen;
    const bandHeight = (px: number) =>
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(px);
    const renderBanner = (images: Kitchen['images']) =>
      render(
        <AppThemeProvider>
          <KitchenBanner kitchen={kitchen(images)} lang="en" placeholder="Dapur" />
        </AppThemeProvider>,
      );

    it('with a background picture under the bar: shows it, cover-fitted and sharp, no blur', () => {
      bandHeight(62);
      renderBanner({ phoneBanner: BANNER, bannerBackgroundImage: BACKGROUND });
      const picture = screen.getByTestId('status-bar-picture');
      expect(picture.getAttribute('src')).toBe(BACKGROUND);
      expect(picture.getAttribute('alt')).toBe('');
      expect(screen.getByTestId('status-bar-band').getAttribute('aria-hidden')).toBe('true');
      expect(screen.queryByTestId('status-bar-blur')).toBeNull();
      const css = pageCss();
      expect(css).toContain('object-fit:cover;object-position:center;opacity:');
    });

    it('the background picture is invisible until it has loaded', async () => {
      bandHeight(62);
      renderBanner({ phoneBanner: BANNER, bannerBackgroundImage: BACKGROUND });
      const picture = screen.getByTestId('status-bar-picture');
      expect(getComputedStyle(picture).opacity).toBe('0');
      fireEvent.load(picture);
      await waitFor(() => expect(getComputedStyle(picture).opacity).toBe('1'));
    });

    it('a background picture that fails to load falls back to the blurred banner copy', async () => {
      bandHeight(62);
      renderBanner({ phoneBanner: BANNER, bannerBackgroundImage: BACKGROUND });
      fireEvent.error(screen.getByTestId('status-bar-picture'));
      const blur = await screen.findByTestId('status-bar-blur');
      expect(blur.getAttribute('src')).toBe(BANNER);
      expect(screen.queryByTestId('status-bar-picture')).toBeNull();
    });

    it('with no background picture: the blurred banner copy, with the banner address', () => {
      bandHeight(62);
      renderBanner({ phoneBanner: BANNER });
      expect(screen.getByTestId('status-bar-blur').getAttribute('src')).toBe(BANNER);
      expect(screen.queryByTestId('status-bar-picture')).toBeNull();
    });

    it('with no pictures: only the colour band', () => {
      bandHeight(62);
      renderBanner({ bannerBackground: '#eadfc8' });
      expect(screen.getByTestId('status-bar-band').childElementCount).toBe(0);
      expect(screen.queryByTestId('status-bar-picture')).toBeNull();
      expect(screen.queryByTestId('status-bar-blur')).toBeNull();
    });

    it('at --sat 0 (browsers, Android) the background picture is never requested', () => {
      bandHeight(0); // the band is `--sat` tall: 0 px, so the <img> is not even rendered
      renderBanner({ phoneBanner: BANNER, bannerBackgroundImage: BACKGROUND });
      expect(document.querySelector(`img[src="${BACKGROUND}"]`)).toBeNull();
      expect(screen.queryByTestId('status-bar-picture')).toBeNull();
      expect(screen.getByTestId('status-bar-blur').getAttribute('src')).toBe(BANNER); // as before
    });
  });
});
