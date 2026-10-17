import { configureStore } from '@reduxjs/toolkit';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sellerOrdersReducer, openOrderLink } from '../features/seller-orders';
import {
  PrivateDetailScreen,
  PrivateEditorScreen,
  PrivateListScreen,
  loaded,
  privateReducer,
} from '../features/seller-private';
import { dish, privateOrder, readyState, TODAY } from '../features/seller-private/testSupport';
import { AppThemeProvider } from '../theme/AppThemeProvider';
import { PhoneBar } from './PhoneBar';
import { PRIVATE_MENU_SLOTS } from './privateMenuSlots';
import { menuDataOf, mountPrivate, setupPrivateTests } from './privateTestSupport';

vi.mock('../api/useSellerLanguages', () => ({ useSellerLanguages: () => 'both' }));
vi.mock('../api/device/sellerContext', () => ({ currentSellerSlug: () => 'home' }));

setupPrivateTests();
beforeEach(() => localStorage.clear());
afterEach(cleanup);

const rina = privateOrder();
const pak = privateOrder({
  id: 'o2',
  code: 'PAK00001',
  firstName: 'Pak Hendra',
  fulfilment: 'pickup',
  address: undefined,
  private: { eventDate: TODAY, eventTime: '16:30' },
  paid: true,
});
const dewi = privateOrder({
  id: 'o3',
  code: 'DEW00001',
  firstName: 'Dewi',
  private: { eventDate: '2026-10-18', eventTime: '10:00' },
});
const komang = privateOrder({
  id: 'o4',
  code: 'KOM00001',
  firstName: 'Komang',
  fulfilment: 'pickup',
  address: undefined,
  private: { eventDate: '2026-10-24', eventTime: '13:00' },
});

describe('the Private list', () => {
  const listState = readyState({ orders: [rina, pak, dewi, komang], view: 'upcoming' });

  it('groups by date (Today, Tomorrow, later) and has no Private tag on its rows', () => {
    mountPrivate(<PrivateListScreen canEdit />, listState);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings[0]).toContain('Today');
    expect(headings[1]).toContain('Tomorrow');
    expect(headings[2]).toBe('Sat 24 Oct');
    expect(screen.queryByText(/^Private$/)).toBeNull();
    expect(screen.getByText('Rina')).toBeTruthy();
    expect(screen.getByText('$40.00 due')).toBeTruthy();
    expect(screen.getByText('Paid')).toBeTruthy();
  });

  it('shows the pickup place name on a pickup row', () => {
    mountPrivate(
      <PrivateListScreen canEdit places={{ home: 'Home kitchen' }} />,
      readyState({ orders: [{ ...komang, pickupPlaceId: 'home' }], view: 'upcoming' }),
    );
    expect(screen.getByRole('button', { name: /Pickup · Home kitchen/ })).toBeTruthy();
  });

  it('shows the quiet Directions link only on a delivery row on its event day', () => {
    mountPrivate(<PrivateListScreen canEdit />, listState);
    const directions = screen.getAllByRole('link', { name: /^Directions to / });
    expect(directions).toHaveLength(1);
    expect(directions[0]?.getAttribute('aria-label')).toBe('Directions to Rina');
    expect(directions[0]?.getAttribute('href')).toContain('google.com/maps/dir');
    expect(directions[0]?.getAttribute('target')).toBe('_blank');
    // Every delivery with an address has the Map link (the day-of one too); a pickup row has neither.
    expect(screen.getAllByRole('link', { name: /^View on map: / })).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'View on map: Rina' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View on map: Dewi' })).toBeTruthy();
  });

  it('lets an owner start a new order and hides that from a chef or helper', () => {
    const owner = mountPrivate(<PrivateListScreen canEdit />, listState);
    fireEvent.click(screen.getByRole('button', { name: 'New private order' }));
    expect(screen.getByTestId('where').textContent).toBe('/seller/private/new');
    owner.unmount();
    mountPrivate(<PrivateListScreen canEdit={false} />, listState);
    expect(screen.queryByRole('button', { name: 'New private order' })).toBeNull();
    expect(screen.getByText(/you can update the status/)).toBeTruthy();
  });

  it('opens an order on a tap', () => {
    mountPrivate(<PrivateListScreen canEdit />, listState);
    fireEvent.click(screen.getByRole('button', { name: /Dewi/ }));
    expect(screen.getByTestId('where').textContent).toBe('/seller/private/DEW00001');
  });

  it('shows a cancelled order in Past with a Cancelled label', () => {
    const cancelled = privateOrder({
      code: 'CAN00001',
      firstName: 'Made',
      status: 'cancelled',
      private: { eventDate: '2026-10-20', eventTime: '09:00' },
    });
    mountPrivate(<PrivateListScreen canEdit />, readyState({ orders: [cancelled], view: 'past' }));
    const row = screen.getByRole('button', { name: /Made/ });
    expect(within(row).getByText('Cancelled')).toBeTruthy();
    expect(within(row).queryByText(/due/)).toBeNull();
  });

  it('always shows the list, even with one order, and asks for the other view on Past', () => {
    const { actions } = mountPrivate(<PrivateListScreen canEdit />, readyState({ orders: [rina] }));
    expect(screen.getByRole('button', { name: /Rina/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Past' }));
    expect(
      actions.some((a) => a.type === 'sellerPrivate/viewChanged' && a.payload === 'past'),
    ).toBe(true);
  });

  it('says so when nothing is coming up', () => {
    const { store } = mountPrivate(<PrivateListScreen canEdit />, readyState());
    // The list asks for its orders when it opens (the saga answers); an empty answer is "nothing".
    expect(screen.getByText('Loading…')).toBeTruthy();
    act(() => {
      store.dispatch(
        loaded({
          due: { today: 0, tomorrow: 0 },
          today: TODAY,
          orders: { view: 'upcoming', list: [] },
        }),
      );
    });
    expect(screen.getByText('No private orders coming up.')).toBeTruthy();
  });
});

describe('a private order', () => {
  const detailState = (order = rina) => readyState({ detail: order, detailCode: order.code });

  it('shows the money: total, deposit and what is still to pay', () => {
    mountPrivate(
      <PrivateDetailScreen code={rina.code} canEdit openOrderLink={openOrderLink} />,
      detailState(),
    );
    expect(screen.getByText('$104.00')).toBeTruthy();
    expect(screen.getByText('Deposit paid').nextSibling?.textContent).toBe('$64.00');
    expect(screen.getByText('Still to pay').nextSibling?.textContent).toBe('$40.00');
    expect(screen.getByText('Jl. Mawar 12, Sanur 80228')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View on map' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Directions' })).toBeTruthy();
  });

  it('says paid in full once paid', () => {
    mountPrivate(
      <PrivateDetailScreen code={rina.code} canEdit openOrderLink={openOrderLink} />,
      detailState(privateOrder({ paid: true })),
    );
    expect(screen.getByText('Paid in full')).toBeTruthy();
    expect(screen.queryByText('Still to pay')).toBeNull();
  });

  it('says nothing is left to pay when the deposit covers the total', () => {
    mountPrivate(
      <PrivateDetailScreen code={rina.code} canEdit openOrderLink={openOrderLink} />,
      detailState(privateOrder({ private: { eventDate: '2026-10-17', depositCents: 20000 } })),
    );
    expect(screen.getByText('Nothing left to pay')).toBeTruthy();
    expect(screen.queryByText('Still to pay')).toBeNull();
  });

  it('plan 083: shows the Change link only when the person may change pickup / delivery', () => {
    const allowed = mountPrivate(
      <PrivateDetailScreen
        code={rina.code}
        canEdit={false}
        canChangeFulfilment
        openOrderLink={openOrderLink}
      />,
      detailState(),
    );
    expect(screen.getByRole('button', { name: 'Change pickup or delivery' })).toBeTruthy();
    allowed.unmount();
    mountPrivate(
      <PrivateDetailScreen code={rina.code} canEdit={false} openOrderLink={openOrderLink} />,
      detailState(),
    );
    expect(screen.queryByRole('button', { name: 'Change pickup or delivery' })).toBeNull();
  });

  it('gives an owner Edit and Cancel, and the whole team the next status and the code', () => {
    const owner = mountPrivate(
      <PrivateDetailScreen code={rina.code} canEdit openOrderLink={openOrderLink} />,
      detailState(),
    );
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send code on WhatsApp' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeTruthy();
    owner.unmount();

    const { actions } = mountPrivate(
      <PrivateDetailScreen code={rina.code} canEdit={false} openOrderLink={openOrderLink} />,
      detailState(),
    );
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Send code on WhatsApp' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as Out for delivery' }));
    const asked = actions.find((a) => a.type === 'sellerPrivate/statusRequested');
    expect(asked?.payload).toEqual({ code: rina.code, to: 'out_for_delivery' });
  });

  it('asks before it cancels', () => {
    const { actions } = mountPrivate(
      <PrivateDetailScreen code={rina.code} canEdit openOrderLink={openOrderLink} />,
      detailState(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
    expect(screen.getByText('Cancel this order for Rina?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(actions.some((a) => a.type === 'sellerPrivate/cancelRequested')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel' }));
    expect(actions.find((a) => a.type === 'sellerPrivate/cancelRequested')?.payload).toEqual({
      code: rina.code,
    });
  });

  it('shows a cancelled order as cancelled with no next step, edit or cancel', () => {
    mountPrivate(
      <PrivateDetailScreen code={rina.code} canEdit openOrderLink={openOrderLink} />,
      detailState(privateOrder({ status: 'cancelled' })),
    );
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Mark as/ })).toBeNull();
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0);
  });
});

describe('the editor', () => {
  const library = menuDataOf([dish('rice', 'Nasi kuning', 1400), dish('lemper', 'Lemper', 1000)]);
  const mountNew = () =>
    mountPrivate(
      <PrivateEditorScreen code={null} menu={PRIVATE_MENU_SLOTS} />,
      readyState(),
      library,
      '/seller/private/new',
    );

  it('starts on Delivery and asks for what is missing before it saves', () => {
    const { actions } = mountNew();
    expect(screen.getByRole('radio', { name: 'Delivery' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save order' }));
    expect(screen.getByText('Add the customer’s name.')).toBeTruthy();
    expect(screen.getByText('Pick at least one dish.')).toBeTruthy();
    expect(screen.getByText('Add the street address.')).toBeTruthy();
    expect(actions.some((a) => a.type === 'sellerPrivate/saveRequested')).toBe(false);
  });

  it('saves the picked dishes with their quantity and price, the address and a deposit', () => {
    const { actions } = mountNew();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rina' } });
    fireEvent.change(screen.getByLabelText('Street address'), {
      target: { value: 'Jl. Mawar 12' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Add Nasi kuning to this order' }));
    fireEvent.click(screen.getByRole('button', { name: 'One more Nasi kuning' }));
    fireEvent.click(screen.getByRole('button', { name: 'One more Nasi kuning' }));
    fireEvent.change(screen.getByLabelText('Price each, Nasi kuning'), {
      target: { value: '13.50' },
    });
    fireEvent.change(screen.getByLabelText(/^Deposit paid/), { target: { value: '20' } });
    // 3 x 13.50 = 40.50, less the 20.00 deposit.
    expect(screen.getByText('Still to pay').nextSibling?.textContent).toBe('$20.50');
    fireEvent.click(screen.getByRole('button', { name: 'Save order' }));
    const saved = actions.find((a) => a.type === 'sellerPrivate/saveRequested');
    expect(saved?.payload).toMatchObject({
      code: null,
      request: {
        firstName: 'Rina',
        fulfilment: 'delivery',
        address: { street: 'Jl. Mawar 12' },
        paid: false,
        depositCents: 2000,
        lines: [{ dishId: 'rice', qty: 3, priceCents: 1350 }],
      },
    });
  });

  it('refuses a deposit above the total with a message', () => {
    const { actions } = mountNew();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rina' } });
    fireEvent.change(screen.getByLabelText('Street address'), {
      target: { value: 'Jl. Mawar 12' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Add Nasi kuning to this order' }));
    fireEvent.change(screen.getByLabelText(/^Deposit paid/), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save order' }));
    expect(screen.getByText('The deposit is more than the total.')).toBeTruthy();
    expect(screen.queryByText(/Nothing left to pay/)).toBeNull();
    expect(actions.find((a) => a.type === 'sellerPrivate/saveRequested')).toBeUndefined();
  });

  it('offers the kitchen’s pickup places on Pickup and takes the deposit away once Paid', () => {
    mountNew();
    fireEvent.click(screen.getByRole('radio', { name: 'Pickup' }));
    expect(screen.getByRole('combobox', { name: 'Pickup place' })).toBeTruthy();
    expect(screen.queryByLabelText('Street address')).toBeNull();
    expect(screen.getByLabelText(/^Deposit paid/)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Paid' }));
    expect(screen.queryByLabelText(/^Deposit paid/)).toBeNull();
    expect(screen.getByText('Nothing left to pay')).toBeTruthy();
  });

  it('edits an existing order: its values come in and every field goes back', () => {
    const { actions } = mountPrivate(
      <PrivateEditorScreen code={rina.code} menu={PRIVATE_MENU_SLOTS} />,
      readyState({ detail: rina, detailCode: rina.code }),
      library,
      `/seller/private/${rina.code}/edit`,
    );
    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Rina');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Rina W' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save order' }));
    const saved = actions.find((a) => a.type === 'sellerPrivate/saveRequested');
    expect(saved?.payload).toMatchObject({
      code: rina.code,
      request: {
        firstName: 'Rina W',
        eventDate: TODAY,
        eventTime: '12:00',
        depositCents: 6400,
        lines: [
          { dishId: 'rice', qty: 6, priceCents: 1400 },
          { dishId: 'lemper', qty: 2, priceCents: 1000 },
        ],
      },
    });
  });
});

describe('the count on More', () => {
  function bar(due: { today: number; tomorrow: number }) {
    const store = configureStore({
      reducer: { sellerOrders: sellerOrdersReducer, sellerPrivate: privateReducer },
      preloadedState: { sellerPrivate: readyState({ due }) },
    } as never);
    return render(
      <Provider store={store}>
        <AppThemeProvider>
          <MemoryRouter>
            <PhoneBar activeId="orders" />
          </MemoryRouter>
        </AppThemeProvider>
      </Provider>,
    );
  }

  it('shows the orders due today and tomorrow as a small number on More', () => {
    bar({ today: 2, tomorrow: 1 });
    const more = screen.getByRole('link', { name: /More/ });
    expect(within(more).getByText('3')).toBeTruthy();
  });

  it('shows nothing when none is due', () => {
    bar({ today: 0, tomorrow: 0 });
    const more = screen.getByRole('link', { name: /More/ });
    expect(within(more).queryByText('0')).toBeNull();
  });
});
