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

describe('Order confirmed: link window (plan 106, option A)', () => {
  const open = async (name: string, code = 'BBB333') => {
    await loadBook(SLUG);
    const s = store();
    seed(s, [makeOrder({ code, firstName: name, customerCode: CODE })]);
    renderWithStore(<CustomerDetailsHost />, s);
    expect(screen.queryByRole('dialog')).toBeNull();
    s.dispatch(linkPromptShown({ code }));
    return s;
  };

  it('Link: asks once, links, and later orders from that code show the saved phone', async () => {
    saveContact(SLUG, 'AAA222', { phone: '0412 345 678', address: '', firstName: 'Rina' });
    await open('Rina');
    expect(
      await screen.findByText(/Order BBB-333 is confirmed|Order BBB333 is confirmed/),
    ).toBeInTheDocument();
    expect(screen.getByText('We found 1 customer called Rina:')).toBeInTheDocument();
    expect(screen.getByText(/^Rina · …678/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'This is them' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(getContactDigits(SLUG, 'CCC444', CODE)).toBe('61412345678');
  });

  it('Someone new saves the name, the code and the typed number', async () => {
    await open('Dewi');
    expect(await screen.findByText("Dewi isn't in your list yet.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('WhatsApp number (optional)'), {
      target: { value: '0412 345 678' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to my list' }));
    expect(listCustomers(SLUG)[0]).toMatchObject({
      firstName: 'Dewi',
      phone: '61412345678',
      customerCodes: [CODE],
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Someone new with no number saves the name and code; a bad number saves nothing', async () => {
    await open('Dewi');
    fireEvent.change(await screen.findByLabelText('WhatsApp number (optional)'), {
      target: { value: '123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to my list' }));
    expect(screen.getByText('Not a valid mobile number.')).toBeInTheDocument();
    expect(listCustomers(SLUG)).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('WhatsApp number (optional)'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add to my list' }));
    expect(listCustomers(SLUG)[0]).toMatchObject({ firstName: 'Dewi', customerCodes: [CODE] });
    expect(listCustomers(SLUG)[0]?.phone).toBeUndefined();
  });

  it('two saved customers with the same name show the count and the last digits', async () => {
    saveContact(SLUG, 'AAA222', { phone: '0412 345 678', address: '', firstName: 'Anin' });
    saveContact(SLUG, 'AAA333', { phone: '0498 765 123', address: '', firstName: 'Anin' });
    await open('Anin');
    expect(await screen.findByText('We found 2 customers called Anin:')).toBeInTheDocument();
    expect(screen.getByText(/^Anin · …678/)).toBeInTheDocument();
    expect(screen.getByText(/^Anin · …123/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'This is them' })).toHaveLength(2);
  });

  it("Ask me next time changes nothing; Don't ask for this order is remembered", async () => {
    const s = await open('Dewi');
    fireEvent.click(await screen.findByRole('button', { name: 'Ask me next time' }));
    expect(listCustomers(SLUG)).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => {
      s.dispatch(linkPromptShown({ code: 'BBB333' }));
    });
    fireEvent.click(await screen.findByRole('button', { name: "Don't ask for this order" }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(listCustomers(SLUG)).toHaveLength(0);
    act(() => {
      s.dispatch(linkPromptShown({ code: 'BBB333' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    // another order still asks
    seed(s, [makeOrder({ code: 'CCC444', firstName: 'Dewi', customerCode: CODE })]);
    act(() => {
      s.dispatch(linkPromptShown({ code: 'CCC444' }));
    });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
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
    expect(
      screen.getByText('Later asks again the next time you open the app.'),
    ).toBeInTheDocument();
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
    expect(screen.getByLabelText('Upload')).toBeInTheDocument();
    expect(screen.getByText(/Keep this file private/)).toBeInTheDocument();
  });
});
