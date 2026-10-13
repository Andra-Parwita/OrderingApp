import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SELLER_HELP_PATH } from '../../shared/help';
import {
  CUSTOMER_TOPICS,
  HelpScreen,
  TOPICS,
  registerSellerHelpI18n,
} from '../features/seller-help';
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
  screen
    .getAllByRole('button')
    .filter((b) => b.hasAttribute('aria-controls') && b.getAttribute('role') !== 'tab');

describe('Help page', () => {
  it('lists all 13 topics in English and in Indonesian', async () => {
    expect(TOPICS).toHaveLength(13);
    render(help());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Seller help');
    expect(topicButtons()).toHaveLength(13);
    expect(topicButtons()[0]).toHaveTextContent('Get started');
    fireEvent.click(screen.getByRole('button', { name: 'ID' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bantuan penjual'),
    );
    expect(topicButtons()).toHaveLength(13);
    expect(topicButtons()[0]).toHaveTextContent('Mulai');
  });

  it('search filters the topics, and says so when nothing is found', () => {
    render(help());
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'invite' } });
    const found = topicButtons().length;
    expect(found).toBeGreaterThan(0);
    expect(found).toBeLessThan(13);
    fireEvent.change(box, { target: { value: 'zzzzqq' } });
    expect(screen.getByText('Nothing found. Try another word.')).toBeInTheDocument();
  });

  it('?topic=4 opens that topic', () => {
    render(help(`${SELLER_HELP_PATH}?topic=4`));
    const buttons = topicButtons();
    expect(buttons[3]).toHaveAttribute('aria-expanded', 'true');
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Put the app on your');
  });

  it('has a Seller help and a Customer help tab; ?tab=customer opens the second', () => {
    const first = render(help());
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((x) => x.textContent)).toEqual(['Seller help', 'Customer help']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(topicButtons()).toHaveLength(TOPICS.length);
    first.unmount();
    render(help(`${SELLER_HELP_PATH}?tab=customer&topic=2`));
    expect(screen.getByRole('tab', { name: 'Customer help' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(CUSTOMER_TOPICS.length).toBeGreaterThan(0);
    expect(topicButtons()).toHaveLength(CUSTOMER_TOPICS.length);
    expect(topicButtons()[1]).toHaveAttribute('aria-expanded', 'true');
    expect(topicButtons()[0]).toHaveTextContent('How does a customer order?');
  });

  it('arrow keys move between the tabs', () => {
    render(help());
    const [seller, customer] = screen.getAllByRole('tab');
    fireEvent.keyDown(seller!, { key: 'ArrowRight' });
    expect(customer).toHaveAttribute('aria-selected', 'true');
    expect(customer).toHaveFocus();
    fireEvent.keyDown(customer!, { key: 'ArrowLeft' });
    expect(seller).toHaveAttribute('aria-selected', 'true');
  });

  it('search covers the current tab and points to the other tab when only it matches', () => {
    render(help());
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'lost their order' } });
    expect(screen.getByText('Nothing found. Try another word.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Found in Customer help \(1\)/ }));
    expect(screen.getByRole('tab', { name: 'Customer help' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(topicButtons()).toHaveLength(1);
  });

  it('shows the Customer help tab in Indonesian', async () => {
    await i18n.changeLanguage('id');
    render(help(`${SELLER_HELP_PATH}?tab=customer`));
    expect(screen.getByRole('tab', { name: 'Bantuan pelanggan' })).toBeInTheDocument();
    expect(topicButtons()[0]).toHaveTextContent('Bagaimana pelanggan memesan?');
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

  it('the first-setup page links to topic 3 ("Help with your invite key")', async () => {
    routes('/seller/setup');
    const link = await screen.findByRole('link', { name: 'Help with your invite key' });
    expect(link).toHaveAttribute('href', `${SELLER_HELP_PATH}?topic=3`);
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
