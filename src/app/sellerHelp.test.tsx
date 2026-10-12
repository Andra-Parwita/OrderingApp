import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SELLER_HELP_PATH } from '../../shared/help';
import { HelpScreen, TOPICS, registerSellerHelpI18n } from '../features/seller-help';
import { InviteBox } from '../features/seller-setup/InviteBox';
import { registerSellerSetupI18n } from '../features/seller-setup';
import { initI18n } from '../i18n/init';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { AppRoutes } from './AppRoutes';
import { navIdsFor } from './sellerNav';
import { createAppStore } from './store';

// Plan 058, D-095: the seller Help page and every way to it.

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  registerSellerSetupI18n();
  registerSellerHelpI18n();
  await i18n.changeLanguage('en');
});
afterEach(async () => {
  vi.unstubAllGlobals();
  localStorage.clear();
  await i18n.changeLanguage('en');
});

const help = (path = SELLER_HELP_PATH) => (
  <AppThemeProvider>
    <MemoryRouter initialEntries={[path]}>
      <HelpScreen logo={null} mascot={null} />
    </MemoryRouter>
  </AppThemeProvider>
);

const topicButtons = () =>
  screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-controls'));

describe('Help page', () => {
  it('lists all 11 topics in English and in Indonesian', async () => {
    expect(TOPICS).toHaveLength(11);
    render(help());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Seller help');
    expect(topicButtons()).toHaveLength(11);
    expect(topicButtons()[0]).toHaveTextContent('Get started');
    fireEvent.click(screen.getByRole('button', { name: 'ID' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bantuan penjual'),
    );
    expect(topicButtons()).toHaveLength(11);
    expect(topicButtons()[0]).toHaveTextContent('Mulai');
  });

  it('search filters the topics, and says so when nothing is found', () => {
    render(help());
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'invite' } });
    const found = topicButtons().length;
    expect(found).toBeGreaterThan(0);
    expect(found).toBeLessThan(11);
    fireEvent.change(box, { target: { value: 'zzzzqq' } });
    expect(screen.getByText('Nothing found. Try another word.')).toBeInTheDocument();
  });

  it('?topic=3 opens that topic', () => {
    render(help(`${SELLER_HELP_PATH}?topic=3`));
    const buttons = topicButtons();
    expect(buttons[2]).toHaveAttribute('aria-expanded', 'true');
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Put the app on your');
  });

  it('is noindex', () => {
    const { unmount } = render(help());
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    unmount();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});

describe('ways to Help', () => {
  it('is in the left menu of every role, right after Settings for the owner', () => {
    const owner = navIdsFor('seller');
    expect(owner.indexOf('help')).toBe(owner.indexOf('settings') + 1);
    expect(navIdsFor('chef')).toContain('help');
    expect(navIdsFor('helper')).toContain('help');
  });

  const routes = (path: string) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 401 }))),
    );
    return render(
      <Provider store={createAppStore()}>
        <AppThemeProvider>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </AppThemeProvider>
      </Provider>,
    );
  };

  it('opens signed out at the constant, and /seller/help is not a route', async () => {
    const first = routes(SELLER_HELP_PATH);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Seller help');
    first.unmount();
    routes('/seller/help');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Page not found');
    expect(screen.queryByText('Seller help')).toBeNull();
  });

  it('the sign-in page links to it ("Need help?")', async () => {
    routes('/seller/sign-in?kitchen=onde-onde');
    const link = await screen.findByRole('link', { name: 'Need help?' });
    expect(link).toHaveAttribute('href', SELLER_HELP_PATH);
  });

  it('the first-setup page links to topic 2 ("Help with your invite key")', async () => {
    routes('/seller/setup');
    const link = await screen.findByRole('link', { name: 'Help with your invite key' });
    expect(link).toHaveAttribute('href', `${SELLER_HELP_PATH}?topic=2`);
  });

  it('the invite message ends with the help line, in English and Indonesian', async () => {
    const { unmount } = render(
      <AppThemeProvider>
        <InviteBox
          name="Wati"
          slug="onde-onde"
          kitchen="Onde Onde"
          role="chef"
          keyText="DLV-AAAA-BBBB"
          onDone={() => undefined}
        />
      </AppThemeProvider>,
    );
    const box = screen.getByRole<HTMLTextAreaElement>('textbox');
    const link = `${window.location.origin}${SELLER_HELP_PATH}`;
    expect(box.value).toContain(`Help: ${link}`);
    unmount();
    await i18n.changeLanguage('id');
    render(
      <AppThemeProvider>
        <InviteBox
          name="Wati"
          slug="onde-onde"
          kitchen="Onde Onde"
          role="helper"
          keyText="DLV-AAAA-BBBB"
          onDone={() => undefined}
        />
      </AppThemeProvider>,
    );
    expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toContain(`Bantuan: ${link}`);
  });
});
