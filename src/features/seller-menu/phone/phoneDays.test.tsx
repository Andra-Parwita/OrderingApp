import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MenuView } from '../../../../shared/menusContract';
import { initI18n } from '../../../i18n/init';
import { AppThemeProvider } from '../../../theme/AppThemeProvider';
import { registerSellerMenuI18n } from '../i18n/register';
import { PhoneMenuCard, PhoneMenuProvider } from './PhoneMenuCard';

// Plan 127: the owner changes the delivery days, the default and "Keep the menu open" on the phone.

const api = vi.hoisted(() => ({ update: vi.fn(), publish: vi.fn(), status: vi.fn() }));
vi.mock('../../../api/menus', () => ({ publishMenu: api.publish, updateCurrentMenu: api.update }));
vi.mock('../../../api/menuNotices', () => ({
  fetchMenuNoticeStatus: api.status,
  sendMenuNotice: vi.fn(),
}));
vi.mock('../../../api/device/sellerContext', () => ({ currentSellerSlug: () => 'home' }));

const NOW = new Date('2026-11-10T00:00:00Z');
const NOTE = { en: 'Within 5 km', id: 'Dalam 5 km' };

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  await initI18n();
  registerSellerMenuI18n();
  await i18n.changeLanguage('en');
});
beforeEach(() => {
  localStorage.clear();
  api.status.mockResolvedValue({ ok: false, error: 'x', status: 500, message: '' });
  api.update.mockResolvedValue({ ok: true, data: {} });
});
afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 30));
  api.update.mockReset();
  api.status.mockReset();
});

function view(
  delivery: Record<string, unknown> = {},
  over: Partial<MenuView['menu']> = {},
): MenuView {
  return {
    menu: {
      id: 'm1',
      state: 'live',
      cookingDate: '2026-11-15',
      cutoffAt: '2026-11-14T21:00:00+10:30',
      delivery: { available: true, note: NOTE, ...delivery },
      wizardStep: 3,
      takingOrders: true,
      placeUses: [{ placeId: 'p1' }],
      publishedAt: '2026-11-09T00:00:00Z',
      ...over,
    },
    dishes: [
      {
        id: 'd1',
        name: { en: 'Rendang', id: 'Rendang' },
        description: { en: '', id: '' },
        size: { en: '1 box', id: '1 box' },
        priceCents: 1800,
        chefId: 'c1',
        remaining: null,
        soldOut: false,
      },
    ],
    pickupPoints: [
      {
        id: 'p1',
        place: 'Glenelg',
        directions: { en: '', id: '' },
        window: { start: '10:00', end: '12:00' },
      },
    ],
  } as unknown as MenuView;
}

function open(menu: MenuView, canEditDays?: boolean) {
  const reload = vi.fn();
  render(
    <AppThemeProvider>
      <PhoneMenuProvider
        view={menu}
        reload={reload}
        now={NOW}
        {...(canEditDays === undefined ? {} : { canEditDays })}
      >
        <PhoneMenuCard />
      </PhoneMenuProvider>
    </AppThemeProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open the menu' }));
  const layer = screen.getByRole('dialog', { name: 'Menu · Sun 15 Nov' });
  return { layer, reload };
}

describe('phone menu: delivery days', () => {
  it('shows the four days as a grid of buttons with the event day as the default', () => {
    const { layer } = open(view());
    const group = within(layer).getByRole('group', { name: 'Delivery days' });
    const cells = within(group).getAllByRole('button');
    expect(cells.map((cell) => cell.textContent)).toEqual([
      '＋Fri 13 Nov',
      '＋Sat 14 Nov',
      '🔒Sun 15 Novdefault',
      '＋Mon 16 Nov',
    ]);
    expect(within(layer).getByRole('switch', { name: /Keep the menu open/ })).toBeVisible();
    // No Save bar until something changes; the Share footer stays.
    expect(within(layer).queryByRole('button', { name: 'Save delivery days' })).toBeNull();
    expect(within(layer).getByRole('button', { name: /Share menu/ })).toBeVisible();
  });

  it('saves the ticked days, the warning shows for 2 days before, and the footer comes back', async () => {
    const { layer, reload } = open(view());
    fireEvent.click(within(layer).getByRole('button', { name: /Fri 13 Nov/ }));
    fireEvent.click(within(layer).getByRole('button', { name: /Mon 16 Nov/ }));
    expect(within(layer).getByText(/Fri 13 Nov is 2 days before cooking/)).toBeVisible();
    expect(within(layer).getByText('Orders already placed keep their day.')).toBeVisible();
    expect(within(layer).queryByRole('button', { name: /Share menu/ })).toBeNull();
    // Nothing was sent by the taps.
    expect(api.update).not.toHaveBeenCalled();
    fireEvent.click(within(layer).getByRole('button', { name: 'Save delivery days' }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(api.update).toHaveBeenCalledWith(
      {
        delivery: {
          available: true,
          note: NOTE,
          days: ['2026-11-13', '2026-11-15', '2026-11-16'],
        },
      },
      undefined,
      'home',
    );
    expect(await within(layer).findByText('Saved')).toBeVisible();
    expect(within(layer).getByRole('button', { name: /Share menu/ })).toBeVisible();
    expect(within(layer).queryByRole('button', { name: 'Save delivery days' })).toBeNull();
  });

  it('a new default is sent with the days; ticking and unticking back is not a change', async () => {
    const { layer } = open(view({ days: ['2026-11-14', '2026-11-15'] }));
    fireEvent.click(within(layer).getByRole('button', { name: /Mon 16 Nov/ }));
    fireEvent.click(within(layer).getByRole('button', { name: /Mon 16 Nov/ }));
    expect(within(layer).queryByRole('button', { name: 'Save delivery days' })).toBeNull();
    fireEvent.click(within(layer).getByRole('button', { name: /default/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Default delivery day' });
    fireEvent.click(within(sheet).getByRole('radio', { name: /Sat 14 Nov/ }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Set default' }));
    fireEvent.click(await within(layer).findByRole('button', { name: 'Save delivery days' }));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0]?.[0]).toEqual({
      delivery: {
        available: true,
        note: NOTE,
        days: ['2026-11-14', '2026-11-15'],
        defaultDay: '2026-11-14',
      },
    });
  });

  it('keep the menu open is held until Save, then sent as finishExtraDay', async () => {
    const { layer } = open(view());
    fireEvent.click(within(layer).getByRole('switch', { name: /Keep the menu open/ }));
    expect(
      within(layer).getByText(/Finishes automatically at midnight after Mon 16 Nov/),
    ).toBeVisible();
    expect(api.update).not.toHaveBeenCalled();
    fireEvent.click(within(layer).getByRole('button', { name: 'Save delivery days' }));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0]?.[0]).toEqual({ finishExtraDay: true });
  });

  it('Discard puts everything back and brings the footer back', () => {
    const { layer } = open(view());
    fireEvent.click(within(layer).getByRole('button', { name: /Sat 14 Nov/ }));
    fireEvent.click(within(layer).getByRole('button', { name: 'Discard' }));
    expect(within(layer).getByRole('button', { name: /Sat 14 Nov/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(within(layer).getByRole('button', { name: /Share menu/ })).toBeVisible();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('says in plain words when saving fails, and keeps the change', async () => {
    api.update.mockResolvedValue({ ok: false, error: 'x', status: 500, message: '' });
    const { layer, reload } = open(view());
    fireEvent.click(within(layer).getByRole('button', { name: /Sat 14 Nov/ }));
    fireEvent.click(within(layer).getByRole('button', { name: 'Save delivery days' }));
    expect(await within(layer).findByRole('alert')).toHaveTextContent(
      'The delivery days could not be saved. Check the connection and try again.',
    );
    expect(reload).not.toHaveBeenCalled();
    expect(within(layer).getByRole('button', { name: 'Save delivery days' })).toBeEnabled();
  });

  it('delivery off: says so and shows no days', () => {
    const { layer } = open(view({ available: false }));
    expect(
      within(layer).getByText('Delivery is off for this menu. Turn it on on the tablet.'),
    ).toBeVisible();
    expect(within(layer).queryByRole('group', { name: 'Delivery days' })).toBeNull();
    expect(within(layer).queryByRole('switch')).toBeNull();
  });

  it('not the owner: the read-only line, no grid and no switch', () => {
    const { layer } = open(view({ days: ['2026-11-14', '2026-11-15'] }), false);
    expect(within(layer).getByText(/Delivery days: Sat 14, Sun 15 Nov/)).toBeVisible();
    expect(within(layer).queryByRole('group', { name: 'Delivery days' })).toBeNull();
    expect(within(layer).queryByRole('switch')).toBeNull();
  });

  it('a finished menu: the read-only line', () => {
    const finished = view({ days: ['2026-11-14', '2026-11-15'] }, { state: 'finished' });
    const { layer } = open(finished);
    expect(within(layer).getByText(/Delivery days: Sat 14, Sun 15 Nov/)).toBeVisible();
    expect(within(layer).queryByRole('group', { name: 'Delivery days' })).toBeNull();
  });
});
