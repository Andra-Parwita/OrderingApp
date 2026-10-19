import { useSyncExternalStore } from 'react';
import { normalisePhone } from '../../../../shared/phone';
import { parseOrderCode } from '../../../../shared/orderCode';
import { askPersistence, openBackend, type BookBackend } from './bookBackend';
import type { BookAddress, BookMeta, Customer } from './bookTypes';

// Plan 071 (D-099): the seller's own address book, kept on THIS device only (IndexedDB, with the
// storage asked to persist). It holds her customers' first names, phone numbers, addresses and the
// anonymous codes that link repeat orders to them. Reads are synchronous from a cache that is filled
// from storage when the app opens; writes go to the cache first and then to storage. Nothing here
// is ever sent to the server.

/** The old per-order localStorage book (D-059); its entries are moved into the address book. */
export const LEGACY_KEY = 'sellerContacts.v1';

type Slot = {
  backend: BookBackend;
  customers: Map<string, Customer>;
  meta: BookMeta;
  version: number;
  loaded: Promise<void>;
  listeners: Set<() => void>;
  legacyIds: Array<string>;
};

const slots = new Map<string, Slot>();
let backendFactory: (slug: string) => BookBackend = openBackend;

/** Tests: use another storage (and forget the open books). */
export function useBookBackend(factory: ((slug: string) => BookBackend) | null): void {
  backendFactory = factory ?? openBackend;
  slots.clear();
}

export const emptyAddress = (): BookAddress => ({
  street: '',
  suburb: '',
  postcode: '',
  notes: '',
});

/** The local calendar date as YYYY-MM-DD. */
export function localDate(now: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}

const orderKey = (code: string): string => (parseOrderCode(code) ?? code).toUpperCase();

function readLegacy(slug: string): Array<Customer> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(LEGACY_KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];
  try {
    const json = JSON.parse(raw) as { contacts?: Record<string, unknown> };
    const out: Array<Customer> = [];
    for (const [key, value] of Object.entries(json.contacts ?? {})) {
      if (!key.startsWith(`${slug}:`) || typeof value !== 'object' || value === null) continue;
      const v = value as Record<string, unknown>;
      const code = key.slice(slug.length + 1);
      const phone = typeof v['phone'] === 'string' ? (normalisePhone(v['phone']) ?? '') : '';
      const street = typeof v['address'] === 'string' ? v['address'].slice(0, 300) : '';
      const at = typeof v['at'] === 'string' ? v['at'] : new Date().toISOString();
      if (phone === '' && street === '') continue;
      out.push({
        id: `legacy-${code}`,
        firstName: '',
        ...(phone !== '' ? { phone } : {}),
        ...(street !== '' ? { address: { ...emptyAddress(), street } } : {}),
        customerCodes: [],
        orderCodes: [code],
        lastOrderDate: at.slice(0, 10),
        createdAt: at,
        updatedAt: at,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function dropLegacy(slug: string): void {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw === null) return;
    const json = JSON.parse(raw) as { contacts?: Record<string, unknown> };
    const left = Object.fromEntries(
      Object.entries(json.contacts ?? {}).filter(([key]) => !key.startsWith(`${slug}:`)),
    );
    if (Object.keys(left).length === 0) localStorage.removeItem(LEGACY_KEY);
    else localStorage.setItem(LEGACY_KEY, JSON.stringify({ ...json, contacts: left }));
  } catch {
    // leave it: the move is safe to repeat
  }
}

function bump(slot: Slot): void {
  slot.version += 1;
  for (const listener of slot.listeners) listener();
}

function slotFor(slug: string): Slot {
  const existing = slots.get(slug);
  if (existing) return existing;
  const backend = backendFactory(slug);
  const customers = new Map<string, Customer>();
  const legacy = readLegacy(slug);
  for (const customer of legacy) customers.set(customer.id, customer);
  const slot: Slot = {
    backend,
    customers,
    meta: { lastBackupAt: null },
    version: 0,
    loaded: Promise.resolve(),
    listeners: new Set(),
    legacyIds: legacy.map((customer) => customer.id),
  };
  slots.set(slug, slot);
  slot.loaded = backend
    .load()
    .then(async ({ customers: stored, meta }) => {
      for (const customer of stored) {
        if (!slot.customers.has(customer.id)) slot.customers.set(customer.id, customer);
      }
      slot.meta = meta;
      if (slot.legacyIds.length > 0 && backend.persistent) {
        const moved = slot.legacyIds
          .map((id) => slot.customers.get(id))
          .filter((c): c is Customer => c !== undefined);
        await backend.put(moved);
        dropLegacy(slug);
        slot.legacyIds = [];
      }
      bump(slot);
    })
    .catch(() => {
      // storage blocked: the book lives in memory for this visit
    });
  askPersistence();
  return slot;
}

function persist(slot: Slot, changed: ReadonlyArray<Customer>): void {
  void slot.backend.put(changed).catch(() => undefined);
  bump(slot);
}

/** Resolves when this kitchen's book has been read from storage (call once when the app opens). */
export function loadBook(slug: string): Promise<void> {
  return slotFor(slug).loaded;
}

export function listCustomers(slug: string): Array<Customer> {
  return [...slotFor(slug).customers.values()];
}

/** The customer an order belongs to: by the order's anonymous code, else by the typed order number. */
export function findCustomer(
  slug: string,
  orderCode: string,
  customerCode?: string,
): Customer | undefined {
  const key = orderKey(orderCode);
  let byOrder: Customer | undefined;
  for (const customer of slotFor(slug).customers.values()) {
    if (customerCode !== undefined && customer.customerCodes.includes(customerCode)) {
      return customer;
    }
    if (customer.orderCodes.includes(key)) byOrder = customer;
  }
  return byOrder;
}

export const isLinked = (slug: string, customerCode: string): boolean =>
  listCustomers(slug).some((customer) => customer.customerCodes.includes(customerCode));

/** The address on one line (street, suburb, postcode); notes are not part of it. */
export function addressText(address: BookAddress | undefined): string {
  if (!address) return '';
  return [address.street, address.suburb, address.postcode]
    .filter((part) => part !== '')
    .join(', ');
}

const hasAddress = (a: BookAddress | undefined): a is BookAddress =>
  a !== undefined && (a.street !== '' || a.suburb !== '' || a.postcode !== '' || a.notes !== '');

/** Adds or replaces one customer. */
export function putCustomer(slug: string, customer: Customer): void {
  const slot = slotFor(slug);
  slot.customers.set(customer.id, customer);
  persist(slot, [customer]);
}

/** Adds or replaces several customers with one write. */
export function putCustomers(slug: string, customers: ReadonlyArray<Customer>): void {
  const slot = slotFor(slug);
  for (const customer of customers) slot.customers.set(customer.id, customer);
  persist(slot, customers);
}

export function deleteCustomer(slug: string, id: string): void {
  const slot = slotFor(slug);
  slot.customers.delete(id);
  void slot.backend.remove(id).catch(() => undefined);
  bump(slot);
}

export type CustomerEdit = Readonly<{
  firstName?: string;
  /** Digits (61...), '' to clear. */
  phone?: string;
  /** Free text from the short form; the structured address is kept while it is unchanged. */
  addressText?: string;
}>;

/**
 * Saves what the seller typed for one order: finds (or makes) its customer and updates it. A
 * customer with nothing left to remember (no phone, address or code) is forgotten. Returns whether
 * the book is kept on this device (false: it lives in memory for this visit).
 */
export function saveForOrder(
  slug: string,
  orderCode: string,
  customerCode: string | undefined,
  edit: CustomerEdit,
  now: Date = new Date(),
): boolean {
  const key = orderKey(orderCode);
  const at = now.toISOString();
  const found = findCustomer(slug, orderCode, customerCode);
  const text = edit.addressText?.trim().slice(0, 300);
  const base: Customer = found ?? {
    id: newId(),
    firstName: '',
    customerCodes: [],
    orderCodes: [],
    lastOrderDate: localDate(now),
    createdAt: at,
    updatedAt: at,
  };
  let address = base.address;
  if (text !== undefined && text !== addressText(base.address)) {
    address = text === '' ? undefined : { ...emptyAddress(), street: text };
  }
  let phone = base.phone;
  if (edit.phone !== undefined) phone = edit.phone === '' ? undefined : edit.phone;
  const firstName = base.firstName === '' ? (edit.firstName?.trim() ?? '') : base.firstName;
  const unchanged =
    found !== undefined &&
    found.phone === phone &&
    JSON.stringify(found.address) === JSON.stringify(address) &&
    found.firstName === firstName;
  const next: Customer = {
    id: base.id,
    firstName,
    ...(phone !== undefined ? { phone } : {}),
    ...(hasAddress(address) ? { address } : {}),
    customerCodes:
      customerCode !== undefined && !base.customerCodes.includes(customerCode)
        ? [...base.customerCodes, customerCode]
        : base.customerCodes,
    orderCodes: base.orderCodes.includes(key) ? base.orderCodes : [...base.orderCodes, key],
    lastOrderDate: base.lastOrderDate,
    createdAt: base.createdAt,
    updatedAt: unchanged ? base.updatedAt : at,
  };
  const empty =
    next.phone === undefined && next.address === undefined && next.customerCodes.length === 0;
  if (empty) {
    if (found) deleteCustomer(slug, found.id);
    return true;
  }
  putCustomer(slug, next);
  return slotFor(slug).backend.persistent;
}

/** Links an order's code to a saved customer (and refreshes its last order date). */
export function linkCode(
  slug: string,
  id: string,
  customerCode: string,
  orderDate: string,
  now: Date = new Date(),
): void {
  const customer = slotFor(slug).customers.get(id);
  if (!customer) return;
  putCustomer(slug, {
    ...customer,
    customerCodes: customer.customerCodes.includes(customerCode)
      ? customer.customerCodes
      : [...customer.customerCodes, customerCode],
    lastOrderDate: orderDate > customer.lastOrderDate ? orderDate : customer.lastOrderDate,
    updatedAt: now.toISOString(),
  });
}

/** A new customer for an order's code, with the number when the seller typed one (digits, 61...). */
export function createForCode(
  slug: string,
  firstName: string,
  customerCode: string,
  orderDate: string,
  now: Date = new Date(),
  phone?: string,
): Customer {
  const at = now.toISOString();
  const customer: Customer = {
    id: newId(),
    firstName: firstName.trim(),
    ...(phone ? { phone } : {}),
    customerCodes: [customerCode],
    orderCodes: [],
    lastOrderDate: orderDate,
    createdAt: at,
    updatedAt: at,
  };
  putCustomer(slug, customer);
  return customer;
}

const plain = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** True when the two words differ by at most one inserted, removed or changed letter. */
function withinOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
}

/** Saved customers with the same or a similar first name (same, one letter off, or one starts the other). */
export function similarCustomers(slug: string, firstName: string): Array<Customer> {
  const wanted = plain(firstName);
  if (wanted === '') return [];
  const score = (customer: Customer): number => {
    const other = plain(customer.firstName);
    if (other === '') return 0;
    if (other === wanted) return 3;
    if (wanted.length >= 4 && other.length >= 4 && withinOne(other, wanted)) return 2;
    const shortest = Math.min(other.length, wanted.length);
    if (shortest >= 3 && (other.startsWith(wanted) || wanted.startsWith(other))) return 1;
    return 0;
  };
  return listCustomers(slug)
    .map((customer) => ({ customer, s: score(customer) }))
    .filter((entry) => entry.s > 0)
    .sort((a, b) => b.s - a.s || b.customer.lastOrderDate.localeCompare(a.customer.lastOrderDate))
    .map((entry) => entry.customer);
}

export type BackupStatus = Readonly<{
  added: number;
  changed: number;
  lastBackupAt: string | null;
}>;

/** What is new or changed on this device since the last backup. */
export function backupStatus(slug: string): BackupStatus {
  const slot = slotFor(slug);
  const last = slot.meta.lastBackupAt;
  let added = 0;
  let changed = 0;
  for (const customer of slot.customers.values()) {
    if (last === null || customer.createdAt > last) added += 1;
    else if (customer.updatedAt > last) changed += 1;
  }
  return { added, changed, lastBackupAt: last };
}

export function markBackedUp(slug: string, now: Date = new Date()): void {
  const slot = slotFor(slug);
  slot.meta = { lastBackupAt: now.toISOString() };
  void slot.backend.setMeta(slot.meta).catch(() => undefined);
  bump(slot);
}

/** Re-renders when this kitchen's book changes; returns a number that changes with it. */
export function useAddressBook(slug: string): number {
  const slot = slotFor(slug);
  return useSyncExternalStore(
    (listener) => {
      slot.listeners.add(listener);
      return () => slot.listeners.delete(listener);
    },
    () => slot.version,
    () => 0,
  );
}
