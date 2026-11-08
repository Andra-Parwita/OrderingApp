import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { DetailsStep } from './DetailsStep';
import { registerSellerMenuI18n } from './i18n/register';
import { menuReducer, opRequested, type MenuData } from './menuSlice';

// Plan 126: the Delivery days strip, the default-day sheet and "Keep the menu open 1 more day".

vi.mock('../../api/device/sellerContext', () => ({ currentSellerSlug: () => 'home' }));

function dataWith(
  delivery: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): MenuData {
  return {
    view: {
      menu: {
        id: 'm1',
        state: 'live',
        cookingDate: '2026-11-15',
        cutoffAt: '2026-11-13T20:00:00+10:30',
        delivery: { available: true, note: { en: '', id: '' }, ...delivery },
        placeUses: [],
        wizardStep: 2,
        ...extra,
      },
      dishes: [],
      pickupPoints: [],
    },
    dishes: [],
    sets: [],
    places: [],
    chefs: [],
    prefs: {},
    past: [],
  } as unknown as MenuData;
}

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerSellerMenuI18n();
  await i18n.changeLanguage('en');
});
beforeEach(() => localStorage.clear());
afterEach(cleanup);

function mount(data: MenuData) {
  const ops: Array<unknown> = [];
  const spy: Middleware = () => (next) => (action) => {
    if (opRequested.match(action)) ops.push(action.payload);
    return next(action);
  };
  const store = configureStore({
    reducer: { sellerMenu: menuReducer },
    middleware: (getDefault) => getDefault().concat(spy),
    preloadedState: {
      sellerMenu: { load: 'ready' as const, data, busy: false, result: null, seq: 0 },
    },
  });
  render(
    <Provider store={store}>
      <AppThemeProvider>
        <DetailsStep data={data} lang="en" />
      </AppThemeProvider>
    </Provider>,
  );
  return ops;
}
const chip = (name: RegExp) => screen.getByRole('button', { name });

describe('delivery days strip (plan 126)', () => {
  it('shows 2 before, the event day (default, locked) and 1 after; the event day is the default', () => {
    mount(dataWith({}));
    expect(chip(/Fri 13/)).toHaveAttribute('aria-pressed', 'false');
    expect(chip(/Sat 14/)).toHaveAttribute('aria-pressed', 'false');
    expect(chip(/Sun 15/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/Sun 15/).textContent).toMatch(/🔒.*event day.*default/);
    expect(chip(/Mon 16/)).toHaveAttribute('aria-pressed', 'false');
    // The soft warning shows for a day 2 before, once it is ticked.
    expect(screen.queryByText(/days before cooking/)).not.toBeInTheDocument();
  });

  it('ticking a day sends the days; a day 2 before gets the soft warning on a ticked menu', () => {
    const ops = mount(dataWith({ days: ['2026-11-13', '2026-11-15'] }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Fri 13 Nov is 2 days before cooking. That’s fine if you plan for it.'.replace('’', "'"),
    );
    fireEvent.click(chip(/Mon 16/));
    expect(ops.at(-1)).toMatchObject({
      kind: 'updateMenu',
      request: { delivery: { days: ['2026-11-13', '2026-11-15', '2026-11-16'] } },
    });
  });

  it('the locked default cannot be unticked: tapping it opens the sheet', () => {
    const ops = mount(dataWith({ days: ['2026-11-14', '2026-11-15'] }));
    fireEvent.click(chip(/Sun 15/));
    const dialog = screen.getByRole('dialog', { name: 'Default delivery day' });
    expect(dialog).toBeInTheDocument();
    expect(ops).toHaveLength(0);
  });

  it('the sheet lists the ticked days; picking one sets the default; then the event day can be unticked', () => {
    let ops = mount(dataWith({ days: ['2026-11-14', '2026-11-15'] }));
    fireEvent.click(chip(/Sun 15/));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByRole('radio')).toHaveLength(2);
    fireEvent.click(within(dialog).getByLabelText('Sat 14 Nov'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Set default' }));
    expect(ops.at(-1)).toMatchObject({
      request: { delivery: { days: ['2026-11-14', '2026-11-15'], defaultDay: '2026-11-14' } },
    });
    cleanup();
    ops = mount(dataWith({ days: ['2026-11-14', '2026-11-15'], defaultDay: '2026-11-14' }));
    expect(chip(/Sat 14/).textContent).toContain('🔒');
    fireEvent.click(chip(/Sun 15/)); // no longer the default: it unticks
    expect(ops.at(-1)).toMatchObject({
      request: { delivery: { days: ['2026-11-14'], defaultDay: '2026-11-14' } },
    });
  });

  it('with the event day unticked it shows dotted/off and is still labelled the event day', () => {
    mount(dataWith({ days: ['2026-11-14'], defaultDay: '2026-11-14' }));
    expect(chip(/Sun 15/)).toHaveAttribute('aria-pressed', 'false');
    expect(chip(/Sun 15/).textContent).toContain('event day');
  });

  it('is in Indonesian', async () => {
    await i18n.changeLanguage('id');
    mount(dataWith({}));
    expect(screen.getByText('Hari antar')).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });
});

describe('Keep the menu open 1 more day (plan 126)', () => {
  it('shows the normal finish, and the later one with the switch on', () => {
    mount(dataWith({}));
    expect(screen.getByText(/Finishes automatically at midnight after Sun 15 Nov/)).toBeVisible();
    cleanup();
    mount(dataWith({ days: ['2026-11-15', '2026-11-16'] }, { finishExtraDay: true }));
    expect(screen.getByText(/midnight after Tue 17 Nov/)).toBeVisible();
  });

  it('is off by default and the switch sends finishExtraDay', () => {
    const ops = mount(dataWith({}));
    const toggle = screen.getByRole('switch', { name: 'Keep the menu open 1 more day' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);
    expect(ops.at(-1)).toMatchObject({ kind: 'updateMenu', request: { finishExtraDay: true } });
  });

  it('is there for a menu without delivery too', () => {
    mount(dataWith({ available: false }));
    expect(screen.getByRole('switch', { name: 'Keep the menu open 1 more day' })).toBeVisible();
  });
});
