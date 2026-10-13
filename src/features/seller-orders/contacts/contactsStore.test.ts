import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_KEY, listCustomers, loadBook, useBookBackend } from './addressBook';
import { memoryBackend } from './bookBackend';
import { getContact, getContactDigits, saveContact } from './contactsStore';

const SLUG = 'onde-onde';

describe('contacts as the order screens use them (device only, D-059; address book, plan 071)', () => {
  beforeEach(() => {
    localStorage.clear();
    useBookBackend(null);
  });

  it('round trips a phone number and an address, however the order number is typed', () => {
    expect(getContact(SLUG, 'K7M2QX')).toBeNull();
    expect(saveContact(SLUG, 'K7M2QX', { phone: '0412 345 678', address: ' 5 Hay St ' })).toBe(
      'not_persisted', // no IndexedDB in the test: kept for this visit only
    );
    expect(getContact(SLUG, 'K7M2QX')).toEqual({ phone: '61412345678', address: '5 Hay St' });
    expect(getContactDigits(SLUG, 'k7m-2qx')).toBe('61412345678');
    // Another kitchen has its own book.
    expect(getContact('other', 'K7M2QX')).toBeNull();
  });

  it('refuses a number it cannot read and saves nothing', () => {
    expect(saveContact(SLUG, 'K7M2QX', { phone: '12345', address: '' })).toBe('invalid_phone');
    expect(getContact(SLUG, 'K7M2QX')).toBeNull();
  });

  it('forgets a contact saved with both fields empty', () => {
    saveContact(SLUG, 'K7M2QX', { phone: '0412345678', address: '' });
    saveContact(SLUG, 'K7M2QX', { phone: '', address: '' });
    expect(getContact(SLUG, 'K7M2QX')).toBeNull();
    expect(listCustomers(SLUG)).toHaveLength(0);
  });

  it('keeps a structured address while the typed text is unchanged', () => {
    saveContact(SLUG, 'K7M2QX', { phone: '', address: '5 Hay St' });
    const before = listCustomers(SLUG)[0];
    expect(before?.address?.street).toBe('5 Hay St');
    saveContact(SLUG, 'K7M2QX', { phone: '0412345678', address: '5 Hay St' });
    expect(listCustomers(SLUG)).toHaveLength(1);
    expect(listCustomers(SLUG)[0]?.address).toEqual(before?.address);
  });

  it('moves the old per-order contacts into the book without losing any', async () => {
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({
        v: 1,
        contacts: {
          'onde-onde:AAAAAA': { phone: '61412345678', address: 'Home', at: '2026-10-01T00:00:00Z' },
          'other:BBBBBB': { phone: '61411111111', address: '', at: '2026-10-01T00:00:00Z' },
        },
      }),
    );
    // Readable at once, before storage has been read.
    expect(getContact(SLUG, 'AAAAAA')).toEqual({ phone: '61412345678', address: 'Home' });
    await loadBook(SLUG);
    expect(listCustomers(SLUG)).toHaveLength(1);
    // The other kitchen's entry is left where it is.
    expect(localStorage.getItem(LEGACY_KEY)).toContain('other:BBBBBB');
  });

  it('removes the old entries once the new storage has them, and asks for no network', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    useBookBackend(() => ({ ...memoryBackend(), persistent: true }));
    localStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({
        contacts: {
          'onde-onde:AAAAAA': { phone: '61412345678', address: '', at: '2026-10-01T00:00:00Z' },
        },
      }),
    );
    await loadBook(SLUG);
    expect(localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(getContactDigits(SLUG, 'AAAAAA')).toBe('61412345678');
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
