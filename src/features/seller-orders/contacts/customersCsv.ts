import { normaliseAuMobile } from '../../../../shared/phone';
import { CUSTOMER_CODE_RE } from '../../../../shared/customerCode';
import { emptyAddress, newId } from './addressBook';
import type { Customer } from './bookTypes';

// Plan 071 (D-099): the customer-details backup file. One row per customer. It holds personal data,
// so the app tells the seller to keep it private. Written and read here only; never uploaded.

/** A byte-order mark first, so Excel reads the letters as UTF-8. */
export const BOM = String.fromCharCode(0xfeff);

export const CSV_HEADER = [
  'first name',
  'phone',
  'street',
  'suburb',
  'postcode',
  'notes',
  'customer codes',
  'last order date',
] as const;

/** The file name: customers-<kitchen>-<yyyy-mm-dd>.csv */
export const csvFileName = (slug: string, date: string): string => `customers-${slug}-${date}.csv`;

// A cell that starts like a spreadsheet formula gets a leading apostrophe (and loses it on reading).
const FORMULA = /^[=+\-@\t\r]/;
function cell(value: string): string {
  const safe = FORMULA.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
const unsafe = (value: string): string => (/^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value);

export function customersToCsv(customers: ReadonlyArray<Customer>): string {
  const rows = customers.map((c) =>
    [
      c.firstName,
      c.phone ?? '',
      c.address?.street ?? '',
      c.address?.suburb ?? '',
      c.address?.postcode ?? '',
      c.address?.notes ?? '',
      c.customerCodes.join(' '),
      c.lastOrderDate,
    ]
      .map(cell)
      .join(','),
  );
  return `${BOM}${[CSV_HEADER.join(','), ...rows].join('\r\n')}\r\n`;
}

/** Splits CSV text into rows of cells (quotes, doubled quotes, CRLF or LF). */
function splitCsv(text: string): Array<Array<string>> {
  const rows: Array<Array<string>> = [];
  let row: Array<string> = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charAt(i);
    if (quoted) {
      if (ch === '"' && text.charAt(i + 1) === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text.charAt(i + 1) === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((value) => value.trim() !== ''));
}

/** A row read from a file: no id or times yet. */
export type CsvRow = Readonly<{
  firstName: string;
  phone: string;
  street: string;
  suburb: string;
  postcode: string;
  notes: string;
  customerCodes: Array<string>;
  lastOrderDate: string;
}>;

/** The rows of a backup file, or null when it is not one (no "first name" column). */
export function parseCustomersCsv(text: string): Array<CsvRow> | null {
  const rows = splitCsv(text.startsWith(BOM) ? text.slice(1) : text);
  const header = rows[0]?.map((name) => name.trim().toLowerCase());
  if (!header?.includes('first name')) return null;
  const col = (row: Array<string>, name: string): string => {
    const index = header.indexOf(name);
    return index < 0 ? '' : unsafe((row[index] ?? '').trim());
  };
  const out: Array<CsvRow> = [];
  for (const row of rows.slice(1)) {
    const rawPhone = col(row, 'phone');
    const phone = rawPhone === '' ? '' : (normaliseAuMobile(rawPhone) ?? '');
    const codes = col(row, 'customer codes')
      .split(/[\s;,]+/)
      .filter((code) => CUSTOMER_CODE_RE.test(code));
    const date = col(row, 'last order date');
    const parsed: CsvRow = {
      firstName: col(row, 'first name').slice(0, 40),
      phone,
      street: col(row, 'street').slice(0, 120),
      suburb: col(row, 'suburb').slice(0, 80),
      postcode: col(row, 'postcode').slice(0, 10),
      notes: col(row, 'notes').slice(0, 300),
      customerCodes: codes,
      lastOrderDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    };
    if (parsed.firstName === '' && parsed.phone === '' && codes.length === 0) continue;
    out.push(parsed);
  }
  return out;
}

export type MergeCounts = Readonly<{ added: number; updated: number; unchanged: number }>;
export type MergePlan = Readonly<{ counts: MergeCounts; customers: Array<Customer> }>;

/**
 * Works out what loading a file does to the book, without changing it. A row finds its customer by
 * phone, else by customer code; no match adds one. The newer last-order date wins each field; an
 * empty cell never clears anything; codes are always added together.
 */
export function planMerge(
  existing: ReadonlyArray<Customer>,
  rows: ReadonlyArray<CsvRow>,
  now: Date = new Date(),
): MergePlan {
  const book = new Map(existing.map((c) => [c.id, c]));
  const touched = new Map<string, Customer>();
  const counts = { added: 0, updated: 0, unchanged: 0 };
  const at = now.toISOString();
  for (const row of rows) {
    const all = [...book.values()];
    const match =
      (row.phone !== '' ? all.find((c) => c.phone === row.phone) : undefined) ??
      all.find((c) => row.customerCodes.some((code) => c.customerCodes.includes(code)));
    if (!match) {
      const created: Customer = {
        id: newId(),
        firstName: row.firstName,
        ...(row.phone !== '' ? { phone: row.phone } : {}),
        ...(row.street + row.suburb + row.postcode + row.notes !== ''
          ? {
              address: {
                ...emptyAddress(),
                street: row.street,
                suburb: row.suburb,
                postcode: row.postcode,
                notes: row.notes,
              },
            }
          : {}),
        customerCodes: row.customerCodes,
        orderCodes: [],
        lastOrderDate: row.lastOrderDate,
        createdAt: at,
        updatedAt: at,
      };
      book.set(created.id, created);
      touched.set(created.id, created);
      counts.added += 1;
      continue;
    }
    const newer = row.lastOrderDate >= match.lastOrderDate;
    const pick = (incoming: string, current: string | undefined): string =>
      incoming !== '' && (newer || !current) ? incoming : (current ?? '');
    const a = match.address;
    const address = {
      street: pick(row.street, a?.street),
      suburb: pick(row.suburb, a?.suburb),
      postcode: pick(row.postcode, a?.postcode),
      notes: pick(row.notes, a?.notes),
    };
    const phone = pick(row.phone, match.phone);
    const codes = [...new Set([...match.customerCodes, ...row.customerCodes])];
    const next: Customer = {
      ...match,
      firstName: pick(row.firstName, match.firstName),
      ...(phone !== '' ? { phone } : {}),
      ...(address.street + address.suburb + address.postcode + address.notes !== ''
        ? { address }
        : {}),
      customerCodes: codes,
      lastOrderDate:
        row.lastOrderDate > match.lastOrderDate ? row.lastOrderDate : match.lastOrderDate,
    };
    const same =
      next.firstName === match.firstName &&
      next.phone === match.phone &&
      JSON.stringify(next.address) === JSON.stringify(match.address) &&
      next.customerCodes.length === match.customerCodes.length &&
      next.lastOrderDate === match.lastOrderDate;
    if (same) {
      counts.unchanged += 1;
      continue;
    }
    const updated = { ...next, updatedAt: at };
    book.set(updated.id, updated);
    touched.set(updated.id, updated);
    counts.updated += 1;
  }
  return { counts, customers: [...touched.values()] };
}
