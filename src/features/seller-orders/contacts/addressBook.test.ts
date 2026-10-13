import { beforeEach, describe, expect, it } from 'vitest';
import {
  backupStatus,
  createForCode,
  findCustomer,
  isLinked,
  linkCode,
  listCustomers,
  markBackedUp,
  putCustomer,
  similarCustomers,
  useBookBackend,
} from './addressBook';
import { memoryBackend } from './bookBackend';
import { getContactDigits, saveContact } from './contactsStore';

const SLUG = 'onde-onde';
const CODE = 'a1b2c3d4e5f6a1b2c3d4e5f6';
const T1 = new Date('2026-10-10T10:00:00Z');
const T2 = new Date('2026-10-12T10:00:00Z');
const T3 = new Date('2026-10-13T10:00:00Z');

describe('the device address book (plan 071)', () => {
  beforeEach(() => {
    localStorage.clear();
    useBookBackend(() => memoryBackend());
  });

  it('finds similar first names, nearest first, and nothing for a stranger', () => {
    createForCode(SLUG, 'Rina', 'a'.repeat(24), '2026-10-03', T1);
    createForCode(SLUG, 'Rinaa', 'b'.repeat(24), '2026-10-03', T1);
    createForCode(SLUG, 'Dewi', 'c'.repeat(24), '2026-10-03', T1);
    expect(similarCustomers(SLUG, 'rina').map((c) => c.firstName)).toEqual(['Rina', 'Rinaa']);
    expect(similarCustomers(SLUG, 'Budi')).toEqual([]);
  });

  it('links a code once; later orders with it show the saved phone', () => {
    saveContact(SLUG, 'AAA222', { phone: '0412 345 678', address: '', firstName: 'Rina' }, T1);
    const saved = listCustomers(SLUG)[0];
    expect(saved).toBeDefined();
    expect(isLinked(SLUG, CODE)).toBe(false);
    expect(getContactDigits(SLUG, 'BBB333', CODE)).toBeNull();
    linkCode(SLUG, saved?.id ?? '', CODE, '2026-10-12', T2);
    expect(isLinked(SLUG, CODE)).toBe(true);
    // a different order number, same customer code
    expect(getContactDigits(SLUG, 'BBB333', CODE)).toBe('61412345678');
    expect(findCustomer(SLUG, 'CCC444', CODE)?.lastOrderDate).toBe('2026-10-12');
  });

  it('counts new and changed customers since the last backup only', () => {
    expect(backupStatus(SLUG)).toEqual({ added: 0, changed: 0, lastBackupAt: null });
    saveContact(SLUG, 'AAA222', { phone: '0412345678', address: '' }, T1);
    expect(backupStatus(SLUG)).toMatchObject({ added: 1, changed: 0 });
    markBackedUp(SLUG, T2);
    expect(backupStatus(SLUG)).toMatchObject({ added: 0, changed: 0 });
    saveContact(SLUG, 'AAA222', { phone: '0412345678', address: '1 New St' }, T3);
    saveContact(SLUG, 'ZZZ999', { phone: '0411222333', address: '' }, T3);
    expect(backupStatus(SLUG)).toMatchObject({ added: 1, changed: 1 });
  });

  it('keeps a customer that only has a code', () => {
    const made = createForCode(SLUG, 'Rina', CODE, '2026-10-12', T1);
    putCustomer(SLUG, { ...made, firstName: 'Rina S' });
    expect(listCustomers(SLUG)).toHaveLength(1);
    expect(isLinked(SLUG, CODE)).toBe(true);
  });
});
