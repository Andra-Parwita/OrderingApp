import { act, fireEvent, screen, within } from '@testing-library/react';

import i18n from 'i18next';
import { useLocation } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockStore } from '../../../mocks/handlers';
import { playChime } from '../../components/chime';
import { devSampleOrdersRequested } from './devActions';
import { FeedbackHost } from './FeedbackHost';
import { LiveOrderRow } from './LiveOrderRow';
import { PhoneOrderRow } from './PhoneOrderRow';
import {
  freshExpired,
  newOrdersViewed,
  pollingStarted,
  pollingStopped,
  refreshRequested,
  toastShown,
} from './sellerOrdersSlice';
import { newCustomerOrders } from './sellerOrdersSelectors';
import { createTestStore, makeOrder, renderWithStore, setupI18n } from './testSupport';

vi.mock('../../components/chime', () => ({ playChime: vi.fn() }));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(check: () => boolean): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
    if (check()) return;
    await sleep(10);
  }
  throw new Error('timed out');
}

async function newOrder(firstName: string) {
  const result = await mockStore.createOrder({
    firstName,
    language: 'en',
    lines: [{ itemId: 'nasi-campur', qty: 1 }],
    fulfilment: 'pickup',
  });
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

async function loaded() {
  const store = createTestStore({ saga: true, pollMs: 100_000 });
  store.dispatch(pollingStarted());
  await waitFor(() => store.getState().sellerOrders.list.status === 'ready');
  return store;
}

describe('new order detection (plan 021 stage 1)', () => {
  beforeEach(async () => {
    await mockStore.reset();
    vi.mocked(playChime).mockClear();
  });

  it('counts nothing on the first load', async () => {
    await newOrder('Rina');
    const store = await loaded();
    const { toast, fresh, unseenNew } = store.getState().sellerOrders;
    expect(toast).toBeNull();
    expect(fresh).toEqual([]);
    expect(unseenNew).toBe(0);
    expect(playChime).not.toHaveBeenCalled();
    store.dispatch(pollingStopped());
  });

  it('finds the one order a reload adds', async () => {
    await newOrder('Rina');
    const store = await loaded();
    const tina = await newOrder('Tina');
    store.dispatch(refreshRequested());
    await waitFor(() => store.getState().sellerOrders.unseenNew === 1);
    const { toast, fresh } = store.getState().sellerOrders;
    expect(fresh).toEqual([tina.id]);
    expect(toast).toMatchObject({ kind: 'newOrder', open: { code: tina.code } });
    expect(toast?.name.startsWith('Tina · ')).toBe(true);
    expect(playChime).toHaveBeenCalledTimes(1);
    store.dispatch(pollingStopped());
  });

  it('groups several into one toast that shows the list', async () => {
    const store = await loaded();
    await newOrder('Tina');
    await newOrder('Budi');
    store.dispatch(refreshRequested());
    await waitFor(() => store.getState().sellerOrders.unseenNew === 2);
    expect(store.getState().sellerOrders.toast).toMatchObject({
      kind: 'newOrders',
      name: '2',
      open: { code: null },
    });
    store.dispatch(pollingStopped());
  });

  it('ignores the dev and demo samples', async () => {
    const store = await loaded();
    store.dispatch(devSampleOrdersRequested());
    await waitFor(() => store.getState().sellerOrders.orders.length > 0);
    await waitFor(() => !store.getState().sellerOrders.devSampling);
    expect(store.getState().sellerOrders.unseenNew).toBe(0);
    expect(store.getState().sellerOrders.fresh).toEqual([]);
    expect(playChime).not.toHaveBeenCalled();
    store.dispatch(pollingStopped());
  });

  it('ignores orders the seller entered', () => {
    const mine = makeOrder({ id: 'a', enteredBy: { role: 'seller', name: 'Ibu' } });
    const theirs = makeOrder({ id: 'b' });
    expect(newCustomerOrders([], [mine, theirs]).map((o) => o.id)).toEqual(['b']);
    expect(newCustomerOrders([theirs], [mine, theirs])).toEqual([]);
  });

  it('clears the highlight and the dot', () => {
    const store = createTestStore({ saga: false });
    store.dispatch({ type: 'sellerOrders/newOrdersArrived', payload: { orders: [] } });
    store.dispatch(freshExpired({ ids: ['x'] }));
    store.dispatch(newOrdersViewed());
    expect(store.getState().sellerOrders.unseenNew).toBe(0);
  });
});

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

describe('new order toast and highlight (plan 021 stage 2)', () => {
  beforeAll(setupI18n);

  it('says who and which order, and Open goes to it', () => {
    const store = createTestStore({ saga: false });
    renderWithStore(
      <>
        <FeedbackHost />
        <Where />
      </>,
      store,
    );
    act(() => {
      store.dispatch(
        toastShown({
          kind: 'newOrder',
          name: 'Tom · V34-P42',
          undo: null,
          open: { code: 'V34P42' },
        }),
      );
    });
    expect(screen.getByText('New order · Tom · V34-P42')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByTestId('where').textContent).toBe('/seller/orders/V34P42');
  });

  it('says how many, and Show goes to the list', () => {
    const store = createTestStore({ saga: false });
    renderWithStore(
      <>
        <FeedbackHost />
        <Where />
      </>,
      store,
    );
    act(() => {
      store.dispatch(
        toastShown({ kind: 'newOrders', name: '3', undo: null, open: { code: null } }),
      );
    });
    expect(screen.getByText('3 new orders')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByTestId('where').textContent).toBe('/seller');
  });

  it('speaks Indonesian too', async () => {
    await i18n.changeLanguage('id');
    const store = createTestStore({ saga: false });
    renderWithStore(<FeedbackHost />, store);
    act(() => {
      store.dispatch(
        toastShown({
          kind: 'newOrder',
          name: 'Tom · V34-P42',
          undo: null,
          open: { code: 'V34P42' },
        }),
      );
    });
    expect(screen.getByText('Pesanan baru · Tom · V34-P42')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Buka' })).toBeDefined();
    await i18n.changeLanguage('en');
  });

  it('labels a highlighted row "New", not by colour alone', () => {
    const store = createTestStore({ saga: false });
    const order = makeOrder();
    renderWithStore(
      <>
        <LiveOrderRow order={order} selected={false} isNew onOpen={() => undefined} />
        <PhoneOrderRow
          order={makeOrder({ id: 'o2', code: 'ABCDEF' })}
          isNew
          onOpen={() => undefined}
        />
        <LiveOrderRow
          order={makeOrder({ id: 'o3', code: 'ZZZZZZ', firstName: 'Old' })}
          selected={false}
          onOpen={() => undefined}
        />
      </>,
      store,
    );
    expect(screen.getAllByText('New')).toHaveLength(2);
    expect(
      within(screen.getByText('Old').closest('button') as HTMLElement).queryByText('New'),
    ).toBeNull();
  });
});
