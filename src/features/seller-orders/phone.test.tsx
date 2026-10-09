import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrderRequested, menuLoaded } from './sellerOrdersSlice';
import { getContact, saveContact } from './contacts';
import { homeKindOf } from './homeState';
import { NewOrderScreen } from './NewOrderScreen';
import { OrderDetailScreen } from './OrderDetailScreen';
import { PhoneOrdersScreen } from './PhoneOrdersScreen';
import {
  createTestStore,
  makeMenuView,
  makeOrder,
  renderWithStore,
  seed,
  seedMenu,
  setupI18n,
} from './testSupport';

beforeAll(setupI18n);

// A phone has no seller session in a test, so the contacts use the default kitchen slug.
const SLUG = 'onde-onde';
const noop = () => undefined;

function renderList(toggle = noop) {
  const store = createTestStore({ saga: false });
  seed(store, [
    makeOrder({ id: '1', code: 'AAA222', firstName: 'Rina', status: 'ordered', changed: true }),
    makeOrder({ id: '2', code: 'BBB333', firstName: 'Budi', status: 'confirmed', paid: true }),
  ]);
  seedMenu(store, makeMenuView('live'));
  renderWithStore(
    <PhoneOrdersScreen
      filter="all"
      query=""
      onFilterChange={noop}
      onQueryChange={noop}
      onOpenOrder={noop}
      onNewOrder={noop}
      toggles={{ changed: false, unpaid: false }}
      onToggle={toggle}
    />,
    store,
  );
  return store;
}

describe('Phone orders', () => {
  let open: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    localStorage.clear();
    open = vi.fn();
    vi.stubGlobal('open', open);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows the header, one filter dropdown, N changed and a round WhatsApp button per row', () => {
    renderList();
    expect(screen.getByRole('heading', { name: 'Orders' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New order/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All orders/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1 changed/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search orders' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /order link on WhatsApp/ })).toHaveLength(2);
  });

  it('opens a bottom sheet with the statuses plus Changed and Not paid', () => {
    const toggle = vi.fn();
    renderList(toggle);
    fireEvent.click(screen.getByRole('button', { name: /All orders/ }));
    const sheet = screen.getByRole('dialog');
    for (const name of [
      'Ordered',
      'Confirmed',
      'Ready',
      'Done',
      'Cancelled',
      'Changed',
      'Not paid',
    ]) {
      expect(within(sheet).getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    }
    fireEvent.click(within(sheet).getByRole('button', { name: /Not paid/ }));
    expect(toggle).toHaveBeenCalledWith('unpaid');
  });

  it("opens the chat picker when no number is saved, and the customer's chat when one is", () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: "Send Rina's order link on WhatsApp" }));
    expect(String(open.mock.calls[0]?.[0])).toMatch(/^https:\/\/wa\.me\/\?text=/);

    saveContact(SLUG, 'AAA222', { phone: '0412 345 678', address: '' });
    fireEvent.click(screen.getByRole('button', { name: "Send Rina's order link on WhatsApp" }));
    expect(String(open.mock.calls[1]?.[0])).toMatch(/^https:\/\/wa\.me\/61412345678\?text=/);
    // The other customer has no number: still the picker.
    fireEvent.click(screen.getByRole('button', { name: "Send Budi's order link on WhatsApp" }));
    expect(String(open.mock.calls[2]?.[0])).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });
});

describe('Phone order detail', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('open', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('makes "Confirm & send on WhatsApp" the main button, with Mark paid, Lock, Nudge and Cancel', () => {
    const store = createTestStore({ saga: false });
    seed(store, [makeOrder({ code: 'AAA222', status: 'ordered' })]);
    renderWithStore(<OrderDetailScreen code="AAA222" onBack={noop} />, store);
    expect(screen.getByRole('button', { name: /Confirm & send on WhatsApp/ })).toBeInTheDocument();
    for (const name of ['Confirm only', 'Mark paid', 'Lock', 'Nudge', 'Cancel order']) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Mark collected' })).toBeInTheDocument();
  });

  it('saves the number and address on this phone only', () => {
    const store = createTestStore({ saga: false });
    seed(store, [makeOrder({ code: 'AAA222', fulfilment: 'delivery' })]);
    renderWithStore(<OrderDetailScreen code="AAA222" onBack={noop} />, store);
    fireEvent.change(screen.getByLabelText("Customer's WhatsApp number"), {
      target: { value: '0412 345 678' },
    });
    fireEvent.change(screen.getByLabelText('Delivery address'), { target: { value: '5 Hay St' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save on this phone' }));
    expect(getContact(SLUG, 'AAA222')).toEqual({ phone: '61412345678', address: '5 Hay St' });
  });
});

describe('Phone New order', () => {
  it('keeps the phone number and address out of the create request (D-059)', () => {
    localStorage.clear();
    const store = createTestStore({ saga: false });
    seedMenu(store, makeMenuView('live'));
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const dispatch = vi.spyOn(store, 'dispatch');
    renderWithStore(<NewOrderScreen onBack={noop} onDone={noop} />, store);
    store.dispatch(
      menuLoaded({
        items: [
          {
            id: 'lemper',
            name: { en: 'Chicken lemper', id: 'Lemper ayam' },
            description: { en: '', id: '' },
            size: { en: '4 pieces', id: '4 biji' },
            priceCents: 1000,
            limit: undefined,
            remaining: null,
            soldOut: false,
          },
        ],
      }),
    );
    fireEvent.change(screen.getByLabelText('Customer first name'), { target: { value: 'Maya' } });
    fireEvent.change(screen.getByLabelText("Customer's WhatsApp number"), {
      target: { value: '0412 345 678' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'One more Chicken lemper' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create only' }));
    const created = dispatch.mock.calls
      .map(([action]) => action)
      .find((action) => action.type === createOrderRequested.type);
    expect(created).toBeDefined();
    expect(JSON.stringify(created)).not.toContain('412');
    expect(JSON.stringify(created)).not.toContain('61412345678');
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('Home for a deleted menu', () => {
  it('shows first run or not published, never "Just finished"', () => {
    const deleted = { ...makeMenuView('finished'), dishes: [] };
    expect(homeKindOf(deleted, null, [])).toBe('checking');
    expect(homeKindOf(deleted, [], [])).toBe('first_run');
    expect(homeKindOf(makeMenuView('finished'), [], [])).toBe('finished');
  });
});
