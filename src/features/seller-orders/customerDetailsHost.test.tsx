import { act, fireEvent, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  backupStatus,
  listCustomers,
  loadBook,
  markBackedUp,
  useBookBackend,
} from './contacts/addressBook';
import { memoryBackend } from './contacts/bookBackend';
import { CustomerDetailsHost } from './contacts/CustomerDetailsHost';
import { ContactsBackup, getContactDigits, saveContact } from './contacts';
import { DeliveryAddressBlock } from './DeliveryAddressBlock';
import { linkPromptShown } from './sellerOrdersSlice';
import {
  createTestStore,
  makeMenuView,
  makeOrder,
  renderWithStore,
  seed,
  seedMenu,
  setupI18n,
} from './testSupport';

// Plan 071 stage 4: "Link to a saved customer?" at confirm, the backup reminder, Customer details.

beforeAll(setupI18n);
const SLUG = 'onde-onde';
const CODE = 'a1b2c3d4e5f6a1b2c3d4e5f6';
const store = () => createTestStore({ saga: false });

beforeEach(() => {
  localStorage.clear();
  useBookBackend(() => memoryBackend());
});

describe('Link to a saved customer?', () => {
  it('asks once, links, and later orders from that code show the saved phone', async () => {
    saveContact(SLUG, 'AAA222', { phone: '0412 345 678', address: '', firstName: 'Rina' });
    await loadBook(SLUG);
    const s = store();
    const order = makeOrder({ code: 'BBB333', firstName: 'Rina', customerCode: CODE });
    seed(s, [order]);
    renderWithStore(<CustomerDetailsHost />, s);
    expect(screen.queryByRole('dialog')).toBeNull();
    s.dispatch(linkPromptShown({ code: 'BBB333' }));
    expect(await screen.findByText('Link to a saved customer?')).toBeInTheDocument();
    expect(screen.getByText(/\+61 412 345 678/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    expect(screen.queryByText('Link to a saved customer?')).toBeNull();
    // the next order with that code shows Call / WhatsApp by itself
    expect(getContactDigits(SLUG, 'CCC444', CODE)).toBe('61412345678');
  });

  it('New customer saves the name and code; Skip changes nothing', async () => {
    await loadBook(SLUG);
    const s = store();
    seed(s, [makeOrder({ code: 'BBB333', firstName: 'Dewi', customerCode: CODE })]);
    renderWithStore(<CustomerDetailsHost />, s);
    s.dispatch(linkPromptShown({ code: 'BBB333' }));
    expect(await screen.findByText('No saved customer with a similar name.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(listCustomers(SLUG)).toHaveLength(0);
    s.dispatch(linkPromptShown({ code: 'BBB333' }));
    fireEvent.click(await screen.findByRole('button', { name: 'New customer' }));
    expect(listCustomers(SLUG)[0]).toMatchObject({ firstName: 'Dewi', customerCodes: [CODE] });
  });

  it('the Call and WhatsApp buttons appear for a linked code', () => {
    saveContact(SLUG, 'AAA222', {
      phone: '0412 345 678',
      address: '',
      firstName: 'Rina',
      customerCode: CODE,
    });
    renderWithStore(
      <DeliveryAddressBlock
        showEmpty
        order={makeOrder({ code: 'ZZZ999', fulfilment: 'delivery', customerCode: CODE })}
      />,
      store(),
    );
    expect(screen.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+61412345678');
  });
});

describe('Back up your customer details?', () => {
  const finished = () => {
    const s = store();
    seedMenu(s, makeMenuView('finished'));
    return s;
  };

  it('shows only when the menu is finished and there is new data; Later hides it for this visit', async () => {
    const s = finished();
    renderWithStore(<CustomerDetailsHost />, s);
    await loadBook(SLUG);
    expect(screen.queryByText('Back up your customer details?')).toBeNull();
    saveContact(SLUG, 'AAA222', { phone: '0412345678', address: '', firstName: 'Rina' });
    expect(await screen.findByText('Back up your customer details?')).toBeInTheDocument();
    expect(screen.getByText(/1 new customer since your last backup/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByText('Back up your customer details?')).toBeNull();
  });

  it('does not show while the menu is live', async () => {
    const s = store();
    seedMenu(s, makeMenuView('live'));
    saveContact(SLUG, 'AAA222', { phone: '0412345678', address: '' });
    renderWithStore(<CustomerDetailsHost />, s);
    await loadBook(SLUG);
    expect(screen.queryByText('Back up your customer details?')).toBeNull();
  });

  it('downloads the CSV and then stays quiet', async () => {
    const click = vi.fn();
    const made: Array<HTMLAnchorElement> = [];
    const create = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = create(tag);
      if (tag === 'a') {
        made.push(el as HTMLAnchorElement);
        el.click = click;
      }
      return el;
    });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    saveContact(SLUG, 'AAA222', { phone: '0412345678', address: '' });
    renderWithStore(<CustomerDetailsHost />, finished());
    fireEvent.click(await screen.findByRole('button', { name: 'Download backup' }));
    expect(click).toHaveBeenCalled();
    expect(made[0]?.download).toMatch(/^customers-onde-onde-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(backupStatus(SLUG)).toMatchObject({ added: 0, changed: 0 });
    expect(screen.queryByText('Back up your customer details?')).toBeNull();
    vi.restoreAllMocks();
  });
});

describe('Settings, Customer details', () => {
  it('says Up to date after a backup, and shows what changed after that', () => {
    saveContact(SLUG, 'AAA222', { phone: '0412345678', address: '' }, new Date('2026-10-01'));
    markBackedUp(SLUG, new Date('2026-10-05T00:00:00Z'));
    renderWithStore(<ContactsBackup />, store());
    expect(screen.getByText(/Up to date · last backup/)).toBeInTheDocument();
    act(() => {
      saveContact(SLUG, 'BBB333', { phone: '0411222333', address: '' });
    });
    expect(screen.getByText(/1 new customer since your last backup/)).toBeInTheDocument();
    expect(screen.getByLabelText('Upload CSV')).toBeInTheDocument();
    expect(screen.getByText(/Keep this file private/)).toBeInTheDocument();
  });
});
