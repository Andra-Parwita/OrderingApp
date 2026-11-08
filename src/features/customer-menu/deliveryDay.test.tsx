import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MenuResponse } from '../../../shared/menuContract';
import { menuLoaded, quantitySet } from './customerSlice';
import { CheckoutFlow, createTestStore, renderWithStore, setupI18n } from './testSupport';

// Plan 126: the "Delivery day" chips at checkout.

beforeAll(() => setupI18n('en'));
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('en');
});

async function checkout(delivery: { days?: Array<string>; defaultDay?: string }) {
  const store = createTestStore();
  renderWithStore(<CheckoutFlow slug="onde-onde" onPlaced={vi.fn()} />, store);
  await waitFor(() => expect(store.getState().customer.menu.status).toBe('ready'));
  const menu = store.getState().customer.menu;
  if (menu.status !== 'ready') throw new Error('menu');
  const cooking = menu.data.week.cookingDate;
  const data: MenuResponse = {
    ...menu.data,
    week: {
      ...menu.data.week,
      delivery: { ...menu.data.week.delivery, available: true, ...delivery },
    },
  };
  store.dispatch(menuLoaded(data));
  store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 1 }));
  await screen.findByRole('radiogroup');
  return { store, cooking };
}
const dayOf = (cooking: string, offset: number) =>
  new Date(Date.parse(`${cooking}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);

describe('delivery day at checkout (plan 126)', () => {
  it('no delivery days set: no Delivery day row', async () => {
    await checkout({});
    fireEvent.click(screen.getByRole('radio', { name: 'Delivery' }));
    expect(screen.queryByText('Delivery day')).not.toBeInTheDocument();
  });

  it('shows the days for Delivery only, with the cooking day pre-selected', async () => {
    const first = await checkout({ days: ['2026-01-01'] });
    cleanup();
    const cooking = first.cooking;
    await checkout({ days: [dayOf(cooking, -1), cooking, dayOf(cooking, 1)] });
    expect(screen.queryByText('Delivery day')).not.toBeInTheDocument(); // pickup first
    fireEvent.click(screen.getByRole('radio', { name: 'Delivery' }));
    expect(screen.getByText('Delivery day')).toBeInTheDocument();
    const chips = screen.getAllByRole('radio').filter((el) => /\d/.test(el.textContent ?? ''));
    expect(chips).toHaveLength(3);
    expect(chips[1]).toHaveAttribute('aria-checked', 'true');
  });

  it('pre-selects the seller default and records only another choice', async () => {
    const first = await checkout({});
    cleanup();
    const cooking = first.cooking;
    const before = dayOf(cooking, -1);
    const after = dayOf(cooking, 1);
    const { store } = await checkout({ days: [before, cooking, after], defaultDay: before });
    fireEvent.click(screen.getByRole('radio', { name: 'Delivery' }));
    const chips = screen.getAllByRole('radio').filter((el) => /\d/.test(el.textContent ?? ''));
    expect(chips[0]).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(chips[2] as HTMLElement);
    expect(store.getState().customer.checkout.handoverDate).toBe(after);
    expect(chips[2]).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(chips[0] as HTMLElement);
    expect(store.getState().customer.checkout.handoverDate).toBeNull();
  });

  it('is in Indonesian too', async () => {
    await i18n.changeLanguage('id');
    const first = await checkout({});
    cleanup();
    await checkout({ days: [dayOf(first.cooking, 0), dayOf(first.cooking, 1)] });
    fireEvent.click(screen.getByRole('radio', { name: 'Diantar' }));
    expect(screen.getByText('Hari antar')).toBeInTheDocument();
  });
});
