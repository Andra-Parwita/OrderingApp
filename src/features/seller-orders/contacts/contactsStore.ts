import { useSyncExternalStore } from 'react';
import { parseOrderCode } from '../../../../shared/orderCode';
import { normaliseAuMobile } from '../../../../shared/phone';

// Customer contacts, kept on the seller's PHONE only (D-059, D-069 Q1): the phone number (so the
// WhatsApp button opens that chat) and the delivery address. Nothing here is ever sent to the
// server, shown at tablet widths, or put in a backup. The seller can export them to a file and
// import them again (a new phone). Every storage call is wrapped: storage can be blocked.

export const CONTACTS_KEY = 'sellerContacts.v1';
/** An entry unused for this long is dropped when something is saved (orders themselves are kept for 4 weeks). */
const KEEP_DAYS = 60;
const ADDRESS_MAX = 300;

/** The number as digits with the country code (61…), and the address as typed; either may be empty. */
export type Contact = Readonly<{ phone: string; address: string }>;
type Entry = Contact & Readonly<{ at: string }>;
type Book = Readonly<Record<string, Entry>>;

const EMPTY: Book = {};

/** The key: kitchen slug plus the order code, e.g. `onde-onde:K7M2QX`. */
export function contactKey(slug: string, code: string): string {
  return `${slug}:${(parseOrderCode(code) ?? code).toUpperCase()}`;
}

function isEntry(value: unknown): value is Entry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['phone'] === 'string' &&
    typeof v['address'] === 'string' &&
    typeof v['at'] === 'string' &&
    v['address'].length <= ADDRESS_MAX
  );
}

/** A stored or imported book: only well-formed entries survive. Null when it is not a book at all. */
function parseBook(text: string | null): Book | null {
  if (text === null) return EMPTY;
  try {
    const json: unknown = JSON.parse(text);
    if (typeof json !== 'object' || json === null) return null;
    const source = (json as Record<string, unknown>)['contacts'];
    if (typeof source !== 'object' || source === null || Array.isArray(source)) return null;
    const out: Record<string, Entry> = {};
    for (const [key, value] of Object.entries(source)) {
      if (!isEntry(value)) continue;
      const phone = value.phone === '' ? '' : (normaliseAuMobile(value.phone) ?? '');
      if (phone === '' && value.address === '') continue;
      out[key] = { phone, address: value.address, at: value.at };
    }
    return out;
  } catch {
    return null;
  }
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(CONTACTS_KEY);
  } catch {
    return null;
  }
}

// The parsed book is cached against the raw text, so a list of rows parses it once per change.
let lastRaw: string | null | undefined;
let lastBook: Book = EMPTY;
function readBook(): Book {
  const raw = readRaw();
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastBook = parseBook(raw) ?? EMPTY;
  }
  return lastBook;
}

// Storage may be blocked (private window): then the book lives in memory for this visit.
let memory: Book | null = null;
const listeners = new Set<() => void>();
function notify(): void {
  for (const listener of listeners) listener();
}

function writeBook(book: Book): boolean {
  const text = JSON.stringify({ v: 1, contacts: book });
  try {
    localStorage.setItem(CONTACTS_KEY, text);
    memory = null;
  } catch {
    memory = book;
  }
  notify();
  return memory === null;
}

function currentBook(): Book {
  return memory ?? readBook();
}

/** What is saved for this order on this phone, or null. */
export function getContact(slug: string, code: string): Contact | null {
  const entry = currentBook()[contactKey(slug, code)];
  return entry ? { phone: entry.phone, address: entry.address } : null;
}

/** The saved number as `61…` digits for `wa.me/<number>`, or null (the chat picker opens instead). */
export function getContactDigits(slug: string, code: string): string | null {
  const phone = getContact(slug, code)?.phone;
  return phone ? phone : null;
}

export type SaveResult = 'saved' | 'invalid_phone' | 'not_persisted';

/**
 * Saves (or, with both fields empty, forgets) a contact. `phone` is typed text and is normalised;
 * an unreadable number is refused and nothing is saved.
 */
export function saveContact(
  slug: string,
  code: string,
  input: Readonly<{ phone: string; address: string }>,
  now: Date = new Date(),
): SaveResult {
  const typed = input.phone.trim();
  const phone = typed === '' ? '' : normaliseAuMobile(typed);
  if (phone === null) return 'invalid_phone';
  const address = input.address.trim().slice(0, ADDRESS_MAX);
  const key = contactKey(slug, code);
  const book: Record<string, Entry> = {};
  const oldest = now.getTime() - KEEP_DAYS * 86_400_000;
  for (const [k, entry] of Object.entries(currentBook())) {
    if (k !== key && Date.parse(entry.at) >= oldest) book[k] = entry;
  }
  if (phone !== '' || address !== '') book[key] = { phone, address, at: now.toISOString() };
  return writeBook(book) ? 'saved' : 'not_persisted';
}

/** The whole book as the text of the export file (JSON). */
export function exportContacts(): string {
  return JSON.stringify({ v: 1, contacts: currentBook() }, null, 2);
}

/** Merges an exported file into this phone's contacts. Returns how many were added or updated, or null if the file is not an export. */
export function importContacts(text: string): number | null {
  const incoming = parseBook(text);
  if (incoming === null) return null;
  const merged = { ...currentBook(), ...incoming };
  writeBook(merged);
  return Object.keys(incoming).length;
}

/** How many contacts this phone holds. */
export function contactCount(): number {
  return Object.keys(currentBook()).length;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === CONTACTS_KEY || event.key === null) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

// The snapshot is the book itself (a stable object until something changes).
/** Re-renders when a contact is saved or imported. Use `getContact` for one order. */
export function useContactBook(): number {
  useSyncExternalStore(subscribe, currentBook, () => EMPTY);
  return contactCount();
}
