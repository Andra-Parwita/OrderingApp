import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from 'i18next';
import type { AuditDiff, AuditEntry } from '../../../shared/domain';
import { mockStore } from '../../../mocks/handlers';
import { server } from '../../../mocks/server';
import { NewOrderScreen } from './NewOrderScreen';
import { OrderDetailScreen } from './OrderDetailScreen';
import { OrdersScreen } from './OrdersScreen';
import type { StatusFilter } from './orderStatus';
import { createTestStore, makeOrder, renderWithStore, seed, setupI18n } from './testSupport';

const noop = () => undefined;

function List() {
  const [filter, setFilter] = useState<StatusFilter>('all');
  return (
    <OrdersScreen
      filter={filter}
      query=""
      onFilterChange={setFilter}
      onQueryChange={noop}
      onOpenOrder={noop}
      onNewOrder={noop}
    />
  );
}

const diff: AuditDiff = {
  items: [{ itemId: 'lemper', name: { en: 'Chicken lemper', id: 'Lemper ayam' }, delta: 1 }],
  note: true,
};
const editEntry: AuditEntry = {
  by: { role: 'customer', name: 'Rina' },
  what: 'edited',
  diff,
  at: '2026-10-08T10:05:00Z',
};

describe('seller batch 2: list', () => {
  beforeAll(setupI18n);

  function renderList() {
    const store = createTestStore({ saga: false });
    seed(store, [
      makeOrder({ id: '1', code: 'K7F2QX', firstName: 'Newbie', status: 'ordered' }),
      makeOrder({
        id: '2',
        code: 'M3H9TD',
        firstName: 'Regular',
        status: 'ordered',
        returning: true,
      }),
      makeOrder({
        id: '3',
        code: 'R8P4WB',
        firstName: 'Heard',
        status: 'ordered',
        waReceived: true,
      }),
      makeOrder({
        id: '4',
        code: 'T5N6YC',
        firstName: 'Editor',
        changed: true,
        locked: true,
        audit: [editEntry],
      }),
      makeOrder({
        id: '5',
        code: 'V2J3ZD',
        firstName: 'Walkin',
        status: 'ordered',
        enteredBy: { role: 'seller', name: 'Bu Ani' },
      }),
    ]);
    renderWithStore(<List />, store);
  }
  const row = (name: RegExp) => screen.getByRole('button', { name });

  it('shows a text marker per state, never colour only', () => {
    renderList();
    expect(within(row(/Newbie/)).getByText('★ New customer')).toBeInTheDocument();
    expect(within(row(/Regular/)).getByText('↩ Returning')).toBeInTheDocument();
    expect(within(row(/Heard/)).getByText('✓ WhatsApp received')).toBeInTheDocument();
    expect(within(row(/Editor/)).getByText('↻ Changed')).toBeInTheDocument();
    expect(within(row(/Editor/)).getByText('🔒 Locked')).toBeInTheDocument();
    const walkin = row(/Walkin/);
    expect(within(walkin).getByText('entered by Bu Ani')).toBeInTheDocument();
    expect(within(walkin).queryByText('★ New customer')).not.toBeInTheDocument();
    // Customer markers only while the order is still waiting for confirmation.
    expect(within(row(/Editor/)).queryByText('★ New customer')).not.toBeInTheDocument();
  });

  it('filters to the edited-by-customer chip with a matching count', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Edited by customer 1' }));
    expect(screen.getByRole('button', { name: /Editor/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Newbie/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^[A-Z0-9]{3}-/ })).toHaveLength(1);
  });

  it('shows the New order button when it is wired', () => {
    renderList();
    expect(screen.getByRole('button', { name: '+ New order' })).toBeInTheDocument();
  });
});

describe('seller batch 2: detail banners', () => {
  beforeAll(setupI18n);
  afterEach(() => i18n.changeLanguage('en'));

  function renderDetail(overrides = {}) {
    const store = createTestStore({ saga: false });
    seed(store, [makeOrder(overrides)]);
    renderWithStore(<OrderDetailScreen code="K7F2QX" onBack={noop} />, store);
  }

  it('new customer: wait for WhatsApp, with both actions', () => {
    renderDetail({ status: 'ordered' });
    expect(screen.getByText(/Wait for their WhatsApp message/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark WhatsApp received' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^Nudge/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Confirm & send on WhatsApp/ })).toBeInTheDocument();
  });

  it('returning customer: can confirm, no WhatsApp banner or button', () => {
    renderDetail({ status: 'ordered', returning: true });
    expect(screen.queryByText(/Wait for their WhatsApp message/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark WhatsApp received' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Nudge/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm only' })).toBeInTheDocument();
  });

  it('has no customer banner once confirmed', () => {
    renderDetail({ status: 'confirmed' });
    expect(screen.queryByText(/Wait for their WhatsApp message/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark WhatsApp received' })).toBeNull();
  });

  it('shows the lock state in text and flips the button', () => {
    renderDetail({ locked: true });
    expect(screen.getByText('No, locked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Unlock/ })).toBeInTheDocument();
  });

  it('shows the Changed banner with the diff in English and Indonesian, and the history', async () => {
    renderDetail({ changed: true, audit: [editEntry] });
    expect(screen.getAllByText(/\+1 Chicken lemper · note changed/).length).toBeGreaterThan(1);
    expect(screen.getByRole('button', { name: 'Seen' })).toBeInTheDocument();
    const history = within(screen.getByRole('list'));
    expect(history.getByText(/Edited: \+1 Chicken lemper · note changed/)).toBeInTheDocument();

    await i18n.changeLanguage('id');
    expect((await screen.findAllByText(/\+1 Lemper ayam · catatan diubah/)).length).toBeGreaterThan(
      1,
    );
    expect(screen.getByRole('button', { name: 'Sudah dilihat' })).toBeInTheDocument();
  });

  it('keeps the customer-visible note', () => {
    renderDetail({ note: 'No chilli' });
    expect(screen.getByText('Note from Rina')).toBeInTheDocument();
    expect(screen.getByText('No chilli')).toBeInTheDocument();
  });
});

describe('seller batch 2: detail actions (MSW)', () => {
  beforeAll(setupI18n);
  beforeEach(() => mockStore.reset());

  async function customerOrder() {
    const result = await mockStore.createOrder({
      firstName: 'Lisa',
      language: 'en',
      lines: [{ itemId: 'nasi-campur', qty: 1 }],
      fulfilment: 'pickup',
    });
    if (!result.ok) throw new Error(result.message);
    return result.value;
  }

  it('marks WhatsApp received, nudges with a toast, locks and unlocks', async () => {
    const order = await customerOrder();
    const store = createTestStore({ saga: true });
    renderWithStore(<OrderDetailScreen code={order.code} onBack={noop} />, store);

    fireEvent.click(await screen.findByRole('button', { name: 'Mark WhatsApp received' }));
    await waitFor(async () =>
      expect((await mockStore.getByCode(order.code))?.waReceived).toBe(true),
    );
    // Once the number is in, the wait-for-WhatsApp banner goes away.
    await waitFor(() => expect(screen.queryByText(/Wait for their WhatsApp message/)).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /^Nudge/ }));
    expect(await screen.findByText('Reminder sent to the customer')).toBeInTheDocument();
    expect((await mockStore.getByCode(order.code))?.inbox[0]?.kind).toBe('nudge');

    fireEvent.click(screen.getByRole('button', { name: /^Lock/ }));
    expect(await screen.findByRole('button', { name: /^Unlock/ })).toBeInTheDocument();
    expect((await mockStore.getByCode(order.code))?.locked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /^Unlock/ }));
    expect(await screen.findByRole('button', { name: /^Lock/ })).toBeInTheDocument();
  });

  it('marks a changed order as seen', async () => {
    const order = await customerOrder();
    const edited = await mockStore.updateOrder(order.token, { note: 'Less spicy' });
    if (!edited.ok) throw new Error(edited.message);
    expect((await mockStore.getByCode(order.code))?.changed).toBe(true);
    const store = createTestStore({ saga: true });
    renderWithStore(<OrderDetailScreen code={order.code} onBack={noop} />, store);
    fireEvent.click(await screen.findByRole('button', { name: 'Seen' }));
    await waitFor(async () => expect((await mockStore.getByCode(order.code))?.changed).toBe(false));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Seen' })).toBeNull());
  });

  it('disables lock and nudge on a cancelled order', async () => {
    const order = await customerOrder();
    await mockStore.setStatus(order.code, 'cancelled', { role: 'seller', name: 'Bu Ani' });
    const store = createTestStore({ saga: true });
    renderWithStore(<OrderDetailScreen code={order.code} onBack={noop} />, store);
    expect(await screen.findByRole('button', { name: /^Lock/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Nudge/ })).toBeDisabled();
  });
});

describe('seller batch 2: new order', () => {
  beforeAll(setupI18n);
  beforeEach(async () => {
    await mockStore.reset();
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    server.events.removeAllListeners();
  });

  async function renderNew(onDone: () => void = noop) {
    const store = createTestStore({ saga: true });
    renderWithStore(<NewOrderScreen onBack={noop} onDone={onDone} />, store);
    await screen.findByRole('group', { name: 'Lime-leaf mixed rice' });
    return store;
  }
  const more = (name: string, times = 1) => {
    for (let i = 0; i < times; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: `One more ${name}` }));
    }
  };
  const pickEnglish = () =>
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Customer language' })).getByRole('radio', {
        name: 'English',
      }),
    );
  const nameField = () => screen.getByLabelText('Customer first name');
  const createOnly = () => fireEvent.click(screen.getByRole('button', { name: 'Create only' }));

  it('requires a first name and at least one item, and sends nothing', async () => {
    const posts: Array<string> = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST') posts.push(request.url);
    });
    await renderNew();
    createOnly();
    expect(screen.getByText('Enter the first name.')).toBeInTheDocument();
    expect(screen.getByText('Add at least one item.')).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  it('shows the running total and "N left" only at 5 or fewer', async () => {
    await mockStore.patchItem('pesmol', { limit: 4 });
    await renderNew();
    more('Lime-leaf mixed rice', 2);
    expect(screen.getByText('Total $30.00')).toBeInTheDocument();
    expect(screen.getByText(/4 left/)).toBeInTheDocument();
    expect(screen.getAllByText(/ left/)).toHaveLength(1);
  });

  it('sends confirmNow, paid, language and items, then leaves the screen', async () => {
    let sent: Record<string, unknown> | undefined;
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'POST' && new URL(request.url).pathname === '/api/seller/orders') {
        sent = (await request.clone().json()) as Record<string, unknown>;
      }
    });
    const done = vi.fn();
    await renderNew(done);
    fireEvent.change(nameField(), { target: { value: 'Lisa' } });
    pickEnglish();
    more('Lime-leaf mixed rice', 2);
    more('Tilapia pesmol');
    expect(screen.getByText('Total $45.00')).toBeInTheDocument();
    // The Delivery option arrives with the current menu.
    await screen.findByRole('option', { name: 'Delivery' });
    fireEvent.change(screen.getByLabelText('Pickup or delivery'), {
      target: { value: 'delivery' },
    });
    fireEvent.change(screen.getByLabelText(/Note \(optional\)/), { target: { value: 'No nuts' } });
    const confirm = within(screen.getByRole('radiogroup', { name: 'Confirm it now' }));
    fireEvent.click(confirm.getByRole('radio', { name: 'No' }));
    const paid = within(screen.getByRole('radiogroup', { name: 'Already paid' }));
    fireEvent.click(paid.getByRole('radio', { name: 'Yes' }));
    createOnly();

    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(sent).toMatchObject({
      firstName: 'Lisa',
      language: 'en',
      fulfilment: 'delivery',
      note: 'No nuts',
      confirmNow: false,
      paid: true,
      lines: [
        { itemId: 'nasi-campur', qty: 2 },
        { itemId: 'pesmol', qty: 1 },
      ],
    });
  });

  it('defaults to confirm now and not paid', async () => {
    const done = vi.fn();
    const store = await renderNew(done);
    fireEvent.change(nameField(), { target: { value: 'Lisa' } });
    more('Chicken lemper');
    createOnly();
    await waitFor(() => expect(done).toHaveBeenCalled());
    const [order] = store.getState().sellerOrders.orders;
    expect(order).toMatchObject({ status: 'confirmed', paid: false });
  });

  it('opens the number’s WhatsApp chat, and the number never reaches a request', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const requests: Array<{ url: string; body: string }> = [];
    server.events.on('request:start', async ({ request }) => {
      requests.push({ url: request.url, body: await request.clone().text() });
    });
    const done = vi.fn();
    await renderNew(done);
    fireEvent.change(nameField(), { target: { value: 'Lisa' } });
    pickEnglish();
    more('Chicken lemper', 2);
    fireEvent.change(screen.getByLabelText("Customer's WhatsApp number"), {
      target: { value: '0412 345 678' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create & send link on WhatsApp' }));
    await waitFor(() => expect(done).toHaveBeenCalled());

    const url = String(open.mock.calls[0]?.[0]);
    expect(url.startsWith('https://wa.me/61412345678?text=')).toBe(true);
    const text = decodeURIComponent(url.split('?text=')[1] ?? '');
    expect(text).toContain('Hi Lisa');
    expect(text).toContain('2× Chicken lemper');
    expect(text).toContain('Total $20.00');
    expect(text).toContain(`${window.location.origin}/o/`);

    expect(requests.some((request) => request.url.includes('/api/seller/orders'))).toBe(true);
    for (const request of requests) {
      expect(request.url).not.toContain('412345678');
      expect(request.body).not.toContain('412345678');
      expect(request.body).not.toContain('0412');
    }
  });

  it('opens the WhatsApp chat picker when no number is given, and refuses a bad number', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const done = vi.fn();
    await renderNew(done);
    fireEvent.change(nameField(), { target: { value: 'Lisa' } });
    more('Chicken lemper');
    const phone = screen.getByLabelText("Customer's WhatsApp number");
    fireEvent.change(phone, { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create & send link on WhatsApp' }));
    expect(open).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();

    fireEvent.change(phone, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create & send link on WhatsApp' }));
    await waitFor(() => expect(done).toHaveBeenCalled());
    expect(String(open.mock.calls[0]?.[0]).startsWith('https://wa.me/?text=')).toBe(true);
  });

  it('shows a clear message when an item sold out meanwhile', async () => {
    await renderNew();
    fireEvent.change(nameField(), { target: { value: 'Lisa' } });
    more('Chicken lemper');
    server.use(
      http.post('*/api/seller/orders', () =>
        HttpResponse.json({ error: 'sold_out', message: 'Sold out' }, { status: 409 }),
      ),
    );
    createOnly();
    expect(await screen.findByText(/just sold out/)).toBeInTheDocument();
  });
});

describe('seller polish: action labels, banners, filter chips', () => {
  beforeAll(setupI18n);
  afterEach(() => i18n.changeLanguage('en'));

  function renderDetail(overrides = {}) {
    const store = createTestStore({ saga: false });
    seed(store, [makeOrder(overrides)]);
    renderWithStore(<OrderDetailScreen code="K7F2QX" onBack={noop} />, store);
  }

  const CASES = [
    [{ status: 'ordered' }, 'Confirm & send on WhatsApp', 'Konfirmasi & kirim lewat WhatsApp'],
    [{ status: 'confirmed', fulfilment: 'pickup' }, 'Mark ready for pickup', 'Tandai siap diambil'],
    [
      { status: 'confirmed', fulfilment: 'delivery' },
      'Mark out for delivery',
      'Tandai sedang diantar',
    ],
    [{ status: 'ready_for_pickup' }, 'Mark collected', 'Tandai sudah diambil'],
    [
      { status: 'out_for_delivery', fulfilment: 'delivery' },
      'Mark delivered',
      'Tandai sudah diantar',
    ],
  ] as const;

  it.each(CASES)('labels the next step as an action: %j', async (overrides, en, id) => {
    renderDetail(overrides);
    expect(screen.getByRole('button', { name: en })).toBeInTheDocument();
    await i18n.changeLanguage('id');
    expect(await screen.findByRole('button', { name: id })).toBeInTheDocument();
  });

  it('says "New customer" once, in the banner, for a customer still to be heard from', () => {
    renderDetail({ status: 'ordered' });
    expect(screen.getAllByText('★ New customer')).toHaveLength(1);
  });

  it.each([[{ status: 'ordered', returning: true }], [{ status: 'ordered', waReceived: true }]])(
    'has no new-customer banner when the customer is known: %j',
    (overrides) => {
      renderDetail(overrides);
      expect(screen.queryByText('★ New customer')).toBeNull();
    },
  );

  function renderList(filter: StatusFilter = 'all') {
    const store = createTestStore({ saga: false });
    seed(store, [
      makeOrder({ id: '1', code: 'K7F2QX', firstName: 'A', status: 'ordered' }),
      makeOrder({ id: '2', code: 'M3H9TD', firstName: 'B', status: 'confirmed' }),
    ]);
    const onFilterChange = vi.fn();
    renderWithStore(
      <OrdersScreen
        filter={filter}
        query=""
        onFilterChange={onFilterChange}
        onQueryChange={noop}
        onOpenOrder={noop}
      />,
      store,
    );
    return onFilterChange;
  }

  it('shows every filter as a chip with its count, and marks the current one pressed', () => {
    renderList('confirmed');
    const group = within(screen.getByRole('group', { name: 'Filter by status' }));
    const names = group.getAllByRole('button').map((chip) => chip.textContent);
    expect(names).toEqual([
      'All 2',
      'Ordered 1',
      'Edited by customer 0',
      'Confirmed 1',
      'Ready 0',
      'Done 0',
      'Cancelled 0',
    ]);
    expect(group.getByRole('button', { name: 'Confirmed 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(group.getByRole('button', { name: 'All 2' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('makes every chip a native button: in the tab order, so Enter and Space work', () => {
    const onFilterChange = renderList();
    const chips = within(screen.getByRole('group', { name: 'Filter by status' })).getAllByRole(
      'button',
    );
    expect(chips).toHaveLength(7);
    for (const chip of chips) {
      expect(chip.tagName).toBe('BUTTON');
      expect(chip).toHaveAttribute('type', 'button');
      expect(chip).not.toHaveAttribute('tabindex', '-1');
    }
    chips[1]?.focus();
    expect(chips[1]).toHaveFocus();
    fireEvent.click(chips[1] as HTMLElement);
    expect(onFilterChange).toHaveBeenCalledWith('ordered');
  });
});
