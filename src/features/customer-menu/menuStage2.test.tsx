import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
import type { MenuResponse } from '../../../shared/menuContract';
import { quantitySet } from './customerSlice';
import { DishesScreen, HowItWorksScreen, MenuScreen } from './MenuScreen';
import { HOW_SEEN_KEY, hasSeenHowItWorks } from './howItWorksSeen';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';

// Plan 004 stage 2: menu home and its states, the picture viewer, dishes, how ordering works.

const noop = () => undefined;
const NUMBER = '61412345678';

beforeAll(() => setupI18n('en'));
beforeEach(() => localStorage.removeItem(HOW_SEEN_KEY));
afterEach(async () => {
  vi.restoreAllMocks();
  await act(() => i18n.changeLanguage('en'));
});

/** The menu as the mock API serves it, with a patch applied. */
async function useMenu(patch: (menu: MenuResponse) => MenuResponse): Promise<MenuResponse> {
  const body = (await (await fetch('/api/s/onde-onde/menu')).json()) as MenuResponse;
  const next = patch(body);
  server.use(http.get('*/api/s/onde-onde/menu', () => HttpResponse.json(next)));
  return next;
}

const withOrdering =
  (ordering: MenuResponse['ordering']) =>
  (menu: MenuResponse): MenuResponse => ({
    ...menu,
    kitchen: { ...menu.kitchen, whatsappNumber: NUMBER },
    ordering,
  });

function renderHome(onSeeDishes = noop, onHowItWorks = noop) {
  return renderWithStore(
    <MenuScreen slug="onde-onde" onSeeDishes={onSeeDishes} onHowItWorks={onHowItWorks} />,
  );
}

function renderDishes() {
  const store = createTestStore();
  renderWithStore(<DishesScreen slug="onde-onde" onBack={noop} onViewBasket={noop} />, store);
  return store;
}

describe('menu home', () => {
  it('shows the kitchen, the dates, the pickup row and the main button', async () => {
    const onSeeDishes = vi.fn();
    renderHome(onSeeDishes);
    expect(await screen.findByRole('heading', { name: 'Onde Onde' })).toBeVisible();
    expect(screen.getByText('Sat 10 Oct')).toBeVisible();
    expect(screen.getByText('Fri 9 Oct, 9 pm')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /^Pickup at/ }));
    expect(screen.getByText(/Glen Waverley · 2–5 pm/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'See dishes and order' }));
    expect(onSeeDishes).toHaveBeenCalledTimes(1);
  });

  it('shows the phone banner with its alt text in the current language', async () => {
    renderHome();
    const banner = await screen.findByRole('img', { name: 'Onde Onde — Indonesian homemade food' });
    expect(banner).toHaveAttribute('src', '/samples/banner-phone.jpg');
    await act(() => i18n.changeLanguage('id'));
    expect(
      await screen.findByRole('img', { name: 'Onde Onde — masakan rumahan Indonesia' }),
    ).toBeVisible();
  });

  it('has no EN / ID switch (it lives in Settings) and speaks Indonesian when the language is ID', async () => {
    renderHome();
    await screen.findByRole('heading', { name: 'Onde Onde' });
    expect(screen.queryByRole('radio', { name: 'ID' })).toBeNull();
    await act(() => i18n.changeLanguage('id'));
    expect(await screen.findByText('Sabtu, 10 Okt')).toBeVisible();
    expect(screen.getByText('Jumat, 9 Okt, 21.00')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Lihat menu dan pesan' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cara memesan' })).toBeVisible();
  });

  it('opens the full picture, closes it with the X and with Escape', async () => {
    await useMenu((menu) => ({ ...menu, pictureUrl: '/samples/rail.png' }));
    const onSeeDishes = vi.fn();
    renderHome(onSeeDishes);
    const open = await screen.findAllByRole('button', { name: 'See full picture' });
    fireEvent.click(open[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Menu picture' });
    expect(dialog).toBeVisible();
    expect(screen.getByText('Pinch to zoom · swipe down to close')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'See full picture' })[0]!);
    await screen.findByRole('dialog');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    // The viewer's own button goes to the dishes.
    fireEvent.click(screen.getAllByRole('button', { name: 'See full picture' })[0]!);
    const inside = await screen.findByRole('dialog');
    fireEvent.click(within(inside).getByRole('button', { name: 'See dishes and order' }));
    expect(onSeeDishes).toHaveBeenCalledTimes(1);
  });

  it('opens "How ordering works" by itself once, then only from the row', async () => {
    const onHow = vi.fn();
    const first = renderHome(noop, onHow);
    await screen.findByRole('button', { name: 'See dishes and order' });
    await waitFor(() => expect(onHow).toHaveBeenCalledTimes(1));
    expect(hasSeenHowItWorks()).toBe(true);
    first.unmount();

    renderHome(noop, onHow);
    await screen.findByRole('button', { name: 'See dishes and order' });
    expect(onHow).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'How ordering works' }));
    expect(onHow).toHaveBeenCalledTimes(2);
  });

  it('does not open it by itself when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const onHow = vi.fn();
    renderHome(noop, onHow);
    await screen.findByRole('button', { name: 'See dishes and order' });
    expect(onHow).not.toHaveBeenCalled();
  });
});

describe('menu states', () => {
  it('paused: says so, offers WhatsApp and a link to the dishes', async () => {
    await useMenu(withOrdering({ open: false, reason: 'closed_by_seller' }));
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const onSeeDishes = vi.fn();
    renderHome(onSeeDishes);
    expect(await screen.findByText('Not taking orders right now')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'See dishes and order' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Message the seller on WhatsApp' }));
    expect(open).toHaveBeenCalledWith(`https://wa.me/${NUMBER}`, '_blank', 'noopener,noreferrer');
    fireEvent.click(screen.getByRole('button', { name: 'See the dishes anyway' }));
    expect(onSeeDishes).toHaveBeenCalledTimes(1);
  });

  it('closed: uses the date and the cut-off, never a weekday word', async () => {
    await useMenu(withOrdering({ open: false, reason: 'cutoff_passed' }));
    renderHome();
    expect(await screen.findByText('Orders for Sat 10 Oct are closed')).toBeVisible();
    expect(screen.getByText(/The cut-off was Fri 9 Oct, 9 pm\./)).toBeVisible();
    expect(screen.queryByText(/this saturday/i)).toBeNull();
  });

  it('opens the WhatsApp chat picker when the number is not known', async () => {
    await useMenu((menu) => ({ ...menu, ordering: { open: false, reason: 'closed_by_seller' } }));
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    renderHome();
    fireEvent.click(await screen.findByRole('button', { name: 'Message the seller on WhatsApp' }));
    expect(open).toHaveBeenCalledWith('https://wa.me/', '_blank', 'noopener,noreferrer');
  });

  it('not published: "The menu isn\'t out yet"', async () => {
    server.use(
      http.get('*/api/s/onde-onde/menu', () =>
        HttpResponse.json({ error: 'week_not_published', message: 'no' }, { status: 409 }),
      ),
    );
    renderHome();
    expect(await screen.findByText("The menu isn't out yet")).toBeVisible();
  });

  it('load error: a skeleton, then an error card; Try again loads the menu', async () => {
    server.use(
      http.get('*/api/s/onde-onde/menu', () => new HttpResponse(null, { status: 500 }), {
        once: true,
      }),
    );
    renderHome();
    expect(await screen.findByText("We couldn't load the menu")).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Onde Onde' })).toBeVisible();
  });
});

describe('dishes', () => {
  it('shows only + before the first add, then − qty +; the sticky bar has count and total', async () => {
    renderDishes();
    await screen.findByText('Chicken lemper');
    expect(screen.queryByRole('button', { name: /^Remove one/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /View basket/ })).toBeNull();
    const lemper = screen.getByRole('button', { name: 'Add one Chicken lemper' });
    fireEvent.click(lemper);
    fireEvent.click(lemper);
    fireEvent.click(screen.getByRole('button', { name: 'Add one Thin battered tempeh' }));
    expect(screen.getByRole('button', { name: 'Remove one Chicken lemper' })).toBeVisible();
    expect(screen.getByText('3 items · $30.00')).toBeVisible();
    expect(screen.getByRole('button', { name: /View basket/ })).toBeVisible();
  });

  it('stops a limited dish at its portions left', async () => {
    const store = renderDishes();
    await screen.findByText('Chicken lemper');
    const more = screen.getByRole('button', { name: 'Add one Chicken lemper' });
    const menu = store.getState().customer.menu;
    const remaining =
      menu.status === 'ready'
        ? (menu.data.items.find((i) => i.id === 'lemper')?.remaining ?? 0)
        : 0;
    store.dispatch(quantitySet({ itemId: 'lemper', qty: remaining + 5 }));
    await waitFor(() => expect(more).toBeDisabled());
    expect(store.getState().customer.basket['lemper']).toBe(remaining);
  });

  it.each([
    [6, false],
    [5, true],
    [1, true],
  ])('with %i portions left, "N left" shown: %s', async (remaining, shown) => {
    await useMenu((menu) => ({
      ...menu,
      items: menu.items.map((item) =>
        item.id === 'lemper' ? { ...item, remaining, soldOut: false } : item,
      ),
    }));
    renderDishes();
    await screen.findByText('Chicken lemper');
    const left = screen.queryByText(`${remaining} left`);
    if (shown) expect(left).toBeVisible();
    else expect(left).toBeNull();
  });

  it('when the basket holds all that is left, + is off but − still works', async () => {
    await useMenu((menu) => ({
      ...menu,
      items: menu.items.map((item) =>
        item.id === 'lemper' ? { ...item, remaining: 2, soldOut: false } : item,
      ),
    }));
    renderDishes();
    await screen.findByText('2 left');
    const add = screen.getByRole('button', { name: 'Add one Chicken lemper' });
    fireEvent.click(add);
    expect(add).toBeEnabled();
    fireEvent.click(add);
    expect(add).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove one Chicken lemper' })).toBeEnabled();
  });

  it('sold out: a "Sold out" pill with no stepper', async () => {
    await useMenu((menu) => ({
      ...menu,
      items: menu.items.map((item) =>
        item.id === 'tempe-mendoan' ? { ...item, remaining: 0, soldOut: true } : item,
      ),
    }));
    renderDishes();
    await screen.findByText('Sold out');
    expect(screen.queryByRole('button', { name: 'Add one Thin battered tempeh' })).toBeNull();
    expect(screen.queryByText('0 left')).toBeNull();
  });

  it('closed: dishes show, nothing can be added and there is no basket bar', async () => {
    await useMenu(withOrdering({ open: false, reason: 'cutoff_passed' }));
    const store = renderDishes();
    await screen.findByText('Chicken lemper');
    store.dispatch(quantitySet({ itemId: 'lemper', qty: 2 }));
    expect(screen.queryByRole('button', { name: /View basket/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add one Chicken lemper' })).toBeDisabled();
  });

  it('names the dates under the title and speaks Indonesian', async () => {
    renderDishes();
    await screen.findByText('Chicken lemper');
    expect(screen.getByRole('heading', { name: 'Dishes' })).toBeVisible();
    expect(screen.getByText('Sat 10 Oct · order by Fri 9 Oct, 9 pm')).toBeVisible();
    await act(() => i18n.changeLanguage('id'));
    expect(await screen.findByText('Lemper ayam')).toBeVisible();
  });
});

describe('how ordering works', () => {
  it('has three steps and names the seller number in step 3', async () => {
    await useMenu(withOrdering({ open: true }));
    const onSeeDishes = vi.fn();
    renderWithStore(<HowItWorksScreen slug="onde-onde" onBack={noop} onSeeDishes={onSeeDishes} />);
    await screen.findByText('1. Pick your dishes');
    expect(screen.getByText('2. Place the order')).toBeVisible();
    expect(screen.getByText('3. Send it on WhatsApp')).toBeVisible();
    const number = screen.getByText('+61 412 345 678');
    expect(number).toHaveStyle({ whiteSpace: 'nowrap' });
    expect(hasSeenHowItWorks()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'See dishes and order' }));
    expect(onSeeDishes).toHaveBeenCalledTimes(1);
  });

  it('works without a number and in Indonesian', async () => {
    renderWithStore(<HowItWorksScreen slug="onde-onde" onBack={noop} onSeeDishes={noop} />);
    await screen.findByText('3. Send it on WhatsApp');
    expect(screen.getByText(/You pay them directly\./)).toBeVisible();
    await act(() => i18n.changeLanguage('id'));
    expect(await screen.findByText('3. Kirim lewat WhatsApp')).toBeVisible();
  });
});
