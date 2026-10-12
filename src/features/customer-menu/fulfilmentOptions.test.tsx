import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { MenuResponse } from '../../../shared/menuContract';
import { menuLoaded, quantitySet } from './customerSlice';
import { CheckoutFlow, createTestStore, renderWithStore, setupI18n } from './testSupport';

// Plan 063 stage 2: the checkout offers only the ways the menu really has.

beforeAll(() => setupI18n('en'));

async function checkout(change: (data: MenuResponse) => MenuResponse) {
  const store = createTestStore();
  const onPlaced = vi.fn();
  renderWithStore(<CheckoutFlow slug="onde-onde" onPlaced={onPlaced} />, store);
  await waitFor(() => expect(store.getState().customer.menu.status).toBe('ready'));
  const menu = store.getState().customer.menu;
  if (menu.status !== 'ready') throw new Error('menu');
  store.dispatch(menuLoaded(change(menu.data)));
  store.dispatch(quantitySet({ itemId: 'tempe-mendoan', qty: 2 }));
  await screen.findByText('Thin battered tempeh');
  return store;
}
const withWeek = (data: MenuResponse, places: boolean, delivery: boolean): MenuResponse => ({
  ...data,
  week: {
    ...data.week,
    pickupPoints: places ? data.week.pickupPoints : [],
    delivery: { ...data.week.delivery, available: delivery },
  },
});

describe('fulfilment options', () => {
  it('delivery only: no pickup control, Delivery is chosen, the order is a delivery', async () => {
    const store = await checkout((d) => withWeek(d, false, true));
    expect(screen.queryByRole('radio', { name: 'Pickup' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Delivery' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('button', { name: /^Next: your name/ }));
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Rina' } });
    fireEvent.click(screen.getByRole('button', { name: /^Place order/ }));
    await waitFor(() => expect(store.getState().customer.place.status).toBe('placed'));
    const order = store.getState().customer.order;
    expect(order.status === 'ready' && order.order.fulfilment).toBe('delivery');
  });

  it('pickup only: no delivery control', async () => {
    await checkout((d) => withWeek(d, true, false));
    expect(screen.queryByRole('radio', { name: 'Delivery' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Pickup' })).toHaveAttribute('aria-checked', 'true');
  });

  it('both: the choice, pickup first', async () => {
    await checkout((d) => withWeek(d, true, true));
    expect(screen.getByRole('radio', { name: 'Pickup' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Delivery' })).toBeInTheDocument();
  });

  it('says which way the server refused, instead of a generic error', async () => {
    server.use(
      http.post('*/api/s/onde-onde/orders', () =>
        HttpResponse.json(
          { error: 'fulfilment_unavailable', message: "This menu doesn't offer pickup" },
          { status: 400 },
        ),
      ),
    );
    await checkout((d) => withWeek(d, true, true));
    fireEvent.click(screen.getByRole('button', { name: /^Next: your name/ }));
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Rina' } });
    fireEvent.click(screen.getByRole('button', { name: /^Place order/ }));
    // The menu offers pickup here, so the generic sentence is used.
    expect(await screen.findByText(/doesn't offer that way to receive/)).toBeInTheDocument();
  });
});
