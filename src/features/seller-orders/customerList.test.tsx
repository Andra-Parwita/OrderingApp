import { fireEvent, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { listCustomers, loadBook, putCustomer, useBookBackend } from './contacts/addressBook';
import type { Customer } from './contacts/bookTypes';
import { memoryBackend } from './contacts/bookBackend';
import { ContactsBackup } from './contacts';
import { createTestStore, renderWithStore, setupI18n } from './testSupport';

// Plan 106: the customer list in Settings > Customer details (sort, search, add, edit, delete).

beforeAll(setupI18n);
const SLUG = 'onde-onde';

const make = (id: string, firstName: string, extra: Partial<Customer> = {}): Customer => ({
  id,
  firstName,
  customerCodes: [],
  orderCodes: [],
  lastOrderDate: '',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  ...extra,
});

const media = (matches: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
};

beforeEach(async () => {
  media(true);
  localStorage.clear();
  useBookBackend(() => memoryBackend());
  await loadBook(SLUG);
});

const render = () => renderWithStore(<ContactsBackup />, createTestStore({ saga: false }));
const names = () => screen.getAllByRole('listitem').map((li) => li.querySelector('b')?.textContent);

describe('Customer list', () => {
  it('on a phone the toolbar uses short labels and the note says phone', () => {
    media(false);
    render();
    expect(screen.getByRole('button', { name: 'Backup' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add/ })).toBeInTheDocument();
    expect(screen.getByText('Saved on this phone only.')).toBeInTheDocument();
  });

  it('lists customers A to Z with digits, short address and last order date; flags duplicates', () => {
    putCustomer(SLUG, make('1', 'Zed'));
    putCustomer(SLUG, make('2', 'Anin', { phone: '61412345678', lastOrderDate: '2026-10-04' }));
    putCustomer(
      SLUG,
      make('3', 'Anin', {
        phone: '61498765123',
        address: { street: '12 Wattle St', suburb: 'Fullarton', postcode: '5063', notes: '' },
      }),
    );
    putCustomer(SLUG, make('4', 'Budi'));
    render();
    expect(names()).toEqual(['2 × Anin', '2 × Anin', 'Budi', 'Zed']);
    expect(screen.getByText('…678 · last order 4 Oct')).toBeInTheDocument();
    expect(screen.getByText('…123 · 12 Wattle St, Fullarton')).toBeInTheDocument();
    expect(screen.getByText('Saved on this tablet only.')).toBeInTheDocument();
  });

  it('Search filters by name, number or address', () => {
    putCustomer(SLUG, make('1', 'Rina', { phone: '61412345678' }));
    putCustomer(SLUG, make('2', 'Budi'));
    render();
    fireEvent.change(screen.getByLabelText('Search customers'), { target: { value: 'bud' } });
    expect(names()).toEqual(['Budi']);
    fireEvent.change(screen.getByLabelText('Search customers'), { target: { value: '678' } });
    expect(names()).toEqual(['Rina']);
    fireEvent.change(screen.getByLabelText('Search customers'), { target: { value: 'zzz' } });
    expect(screen.getByText('No customer matches your search.')).toBeInTheDocument();
  });

  it('Add customer saves a first name, number and address; a name is required', () => {
    render();
    fireEvent.click(screen.getByRole('button', { name: /Add customer/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter a first name.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Dewi' } });
    fireEvent.change(screen.getByLabelText('WhatsApp number (optional)'), {
      target: { value: '123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Not a valid mobile number.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('WhatsApp number (optional)'), {
      target: { value: '0412 345 678' },
    });
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: '5 Gum Rd' } });
    fireEvent.change(screen.getByLabelText('Suburb'), { target: { value: 'Unley' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(listCustomers(SLUG)).toHaveLength(1);
    expect(listCustomers(SLUG)[0]).toMatchObject({
      firstName: 'Dewi',
      phone: '61412345678',
      customerCodes: [],
      address: { street: '5 Gum Rd', suburb: 'Unley', postcode: '', notes: '' },
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('…678 · 5 Gum Rd, Unley')).toBeInTheDocument();
  });

  it('tapping a row opens Edit, Save keeps the codes and updates the fields', () => {
    putCustomer(SLUG, make('1', 'Rina', { phone: '61412345678', customerCodes: ['abc'] }));
    render();
    fireEvent.click(screen.getByRole('button', { name: /Rina/ }));
    expect(screen.getByLabelText('WhatsApp number (optional)')).toHaveValue('0412 345 678');
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Rinna' } });
    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: '5063' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(listCustomers(SLUG)).toHaveLength(1);
    expect(listCustomers(SLUG)[0]).toMatchObject({
      id: '1',
      firstName: 'Rinna',
      customerCodes: ['abc'],
      address: { postcode: '5063' },
    });
  });

  it('Delete asks first, says past orders stay, and removes only on Yes', () => {
    putCustomer(SLUG, make('1', 'Anin', { phone: '61412345678' }));
    render();
    fireEvent.click(screen.getByRole('button', { name: /Anin/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete customer' }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(
        'Remove Anin from this tablet? Their name, number and address are deleted from this tablet only. Their past orders stay as they are. If you have a backup file, they come back when you upload it.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(listCustomers(SLUG)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Delete customer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));
    expect(listCustomers(SLUG)).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
