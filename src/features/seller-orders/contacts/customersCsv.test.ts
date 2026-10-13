import { describe, expect, it } from 'vitest';
import type { Customer } from './bookTypes';
import {
  CSV_HEADER,
  csvFileName,
  customersToCsv,
  parseCustomersCsv,
  planMerge,
} from './customersCsv';

const CODE = 'a1b2c3d4e5f6a1b2c3d4e5f6';
const rina: Customer = {
  id: 'c1',
  firstName: 'Rina',
  phone: '61412345678',
  address: {
    street: '12 Jetty Road',
    suburb: 'Glenelg',
    postcode: '5045',
    notes: 'blue gate, "call"',
  },
  customerCodes: [CODE],
  orderCodes: [],
  lastOrderDate: '2026-10-10',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-10T00:00:00Z',
};

describe('customer details CSV (plan 071)', () => {
  it('writes the agreed columns, quotes awkward text and names the file by kitchen and date', () => {
    expect(csvFileName('onde-onde', '2026-10-13')).toBe('customers-onde-onde-2026-10-13.csv');
    const lines = customersToCsv([rina]).slice(1).trim().split('\r\n');
    expect(lines[0]).toBe(
      'first name,phone,street,suburb,postcode,notes,customer codes,last order date',
    );
    expect(CSV_HEADER).toHaveLength(8);
    expect(lines[1]).toBe(
      `Rina,61412345678,12 Jetty Road,Glenelg,5045,"blue gate, ""call""",${CODE},2026-10-10`,
    );
  });

  it('reads back what it wrote, and refuses a file that is not a backup', () => {
    const rows = parseCustomersCsv(customersToCsv([rina]));
    expect(rows).toHaveLength(1);
    expect(rows?.[0]).toMatchObject({
      firstName: 'Rina',
      phone: '61412345678',
      notes: 'blue gate, "call"',
      customerCodes: [CODE],
      lastOrderDate: '2026-10-10',
    });
    expect(parseCustomersCsv('a,b\n1,2')).toBeNull();
  });

  it('neutralises spreadsheet formulas on the way out and in', () => {
    const csv = customersToCsv([{ ...rina, firstName: '=SUM(A1)' }]);
    expect(csv).toContain("'=SUM(A1)");
    expect(parseCustomersCsv(csv)?.[0]?.firstName).toBe('=SUM(A1)');
  });

  it('merges by phone, else by code; newer wins; empty cells never wipe; counts first', () => {
    const rows = parseCustomersCsv(
      [
        CSV_HEADER.join(','),
        // same phone, newer order, new street, no notes: street changes, notes stay
        'Rina S,0412 345 678,5 Hay St,,,,,2026-10-12',
        // no phone, matches by code, older: nothing new
        `,,,,,,${CODE},2026-10-01`,
        // brand new
        'Dewi,0411222333,,,,,,2026-10-05',
      ].join('\r\n'),
    );
    expect(rows).toHaveLength(3);
    const plan = planMerge([rina], rows ?? [], new Date('2026-10-13T00:00:00Z'));
    expect(plan.counts).toEqual({ added: 1, updated: 1, unchanged: 1 });
    const updated = plan.customers.find((c) => c.id === 'c1');
    expect(updated?.firstName).toBe('Rina S');
    expect(updated?.address).toEqual({
      street: '5 Hay St',
      suburb: 'Glenelg',
      postcode: '5045',
      notes: 'blue gate, "call"',
    });
    expect(updated?.lastOrderDate).toBe('2026-10-12');
    expect(updated?.customerCodes).toEqual([CODE]);
  });

  it('an older row does not overwrite, but adds codes and fills blanks', () => {
    const other = 'f'.repeat(24);
    const rows = parseCustomersCsv(
      [CSV_HEADER.join(','), `Old Name,61412345678,1 Old St,,,,${other},2026-01-01`].join('\r\n'),
    );
    const plan = planMerge([rina], rows ?? []);
    expect(plan.counts.updated).toBe(1);
    const merged = plan.customers[0];
    expect(merged?.firstName).toBe('Rina');
    expect(merged?.address?.street).toBe('12 Jetty Road');
    expect(merged?.customerCodes).toEqual([CODE, other]);
  });
});
