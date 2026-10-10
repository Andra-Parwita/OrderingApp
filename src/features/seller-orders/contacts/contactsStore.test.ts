import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONTACTS_KEY,
  contactKey,
  exportContacts,
  getContact,
  getContactDigits,
  importContacts,
  saveContact,
} from './contactsStore';

const SLUG = 'onde-onde';

describe('contacts store (device only, D-059)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('keys a contact by kitchen slug and order code, however the code is typed', () => {
    expect(contactKey(SLUG, 'k7m-2qx')).toBe('onde-onde:K7M2QX');
    expect(contactKey(SLUG, 'K7M2QX')).toBe('onde-onde:K7M2QX');
  });

  it('round trips a phone number and an address', () => {
    expect(getContact(SLUG, 'K7M2QX')).toBeNull();
    expect(saveContact(SLUG, 'K7M2QX', { phone: '0412 345 678', address: ' 5 Hay St ' })).toBe(
      'saved',
    );
    expect(getContact(SLUG, 'K7M2QX')).toEqual({ phone: '61412345678', address: '5 Hay St' });
    expect(getContactDigits(SLUG, 'k7m-2qx')).toBe('61412345678');
    // Another kitchen's order with the same code is a different contact.
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
  });

  it('exports to text and imports it on another phone', () => {
    saveContact(SLUG, 'K7M2QX', { phone: '0412345678', address: 'Home' });
    saveContact(SLUG, 'C6P2ZU', { phone: '', address: 'Shop' });
    const file = exportContacts();
    localStorage.clear();
    expect(getContact(SLUG, 'K7M2QX')).toBeNull();
    expect(importContacts(file)).toBe(2);
    expect(getContact(SLUG, 'K7M2QX')).toEqual({ phone: '61412345678', address: 'Home' });
    expect(getContact(SLUG, 'C6P2ZU')).toEqual({ phone: '', address: 'Shop' });
  });

  it('rejects a file that is not an export, and skips bad entries', () => {
    expect(importContacts('not json')).toBeNull();
    expect(importContacts('{"v":1}')).toBeNull();
    const mixed = JSON.stringify({
      contacts: {
        'onde-onde:AAAAAA': { phone: '0412345678', address: '', at: '2026-10-01T00:00:00Z' },
        'onde-onde:BBBBBB': { phone: 5 },
      },
    });
    expect(importContacts(mixed)).toBe(1);
    expect(getContact(SLUG, 'BBBBBB')).toBeNull();
  });

  it('drops entries older than 60 days when something is saved', () => {
    const old = new Date('2026-06-01T00:00:00Z');
    saveContact(SLUG, 'AAAAAA', { phone: '0412345678', address: '' }, old);
    expect(getContact(SLUG, 'AAAAAA')).not.toBeNull();
    saveContact(SLUG, 'BBBBBB', { phone: '0412345678', address: '' }, new Date('2026-10-10'));
    expect(getContact(SLUG, 'AAAAAA')).toBeNull();
    expect(getContact(SLUG, 'BBBBBB')).not.toBeNull();
  });

  it('keeps working in memory when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(saveContact(SLUG, 'K7M2QX', { phone: '0412345678', address: '' })).toBe('not_persisted');
    expect(getContactDigits(SLUG, 'K7M2QX')).toBe('61412345678');
  });

  it('never makes a network call (the number stays on the phone)', () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    saveContact(SLUG, 'K7M2QX', { phone: '0412345678', address: 'Home' });
    getContact(SLUG, 'K7M2QX');
    importContacts(exportContacts());
    expect(spy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    expect(localStorage.getItem(CONTACTS_KEY)).toContain('61412345678');
  });
});
