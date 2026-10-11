import { describe, expect, it } from 'vitest';
import { CSV_BOM, daySalesToCsv } from './csv';
import type { DaySaleEntry } from './daySalesContract';

const entry = (over: Partial<DaySaleEntry>): DaySaleEntry => ({
  id: 'e',
  menuId: 'm',
  itemId: 'a',
  kind: 'sale',
  change: -1,
  stockAfter: 4,
  by: 'Dewi',
  at: '2026-10-10T08:00:00.000Z',
  undone: false,
  ...over,
});

describe('daySalesToCsv (plan 029)', () => {
  it('has a header and one row per log entry, oldest first, safe for spreadsheets', () => {
    const csv = daySalesToCsv(
      [
        entry({ id: '2', kind: 'count', change: 3, stockAfter: 7, by: '=Evil, "x"' }),
        entry({ id: '1', undone: true }),
      ],
      (id) => (id === 'a' ? 'Satay' : id),
    );
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('time,type,dish,person,change,stock after,undone');
    expect(lines[1]).toBe('2026-10-10T08:00:00.000Z,sale,Satay,Dewi,-1,4,yes');
    expect(lines[2]).toContain(`"'=Evil, ""x"""`);
  });
});
