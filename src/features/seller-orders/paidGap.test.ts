import { describe, expect, it } from 'vitest';
import type { AuditEntry, Order } from '../../../shared/domain';
import { lastStaffEdit, paidGap } from './paidGap';

const at = (n: number) => `2026-10-17T10:0${String(n)}:00.000Z`;
const staff = { role: 'seller' as const, name: 'Chandra' };
const order = (paid: boolean, audit: Array<AuditEntry>, qty: number): Order =>
  ({
    paid,
    audit,
    lines: [
      { itemId: 'a', name: { en: 'A', id: 'A' }, size: { en: '', id: '' }, priceCents: 1100, qty },
    ],
  }) as unknown as Order;

describe('paidGap', () => {
  const edit: AuditEntry = {
    by: staff,
    what: 'edited',
    at: at(3),
    diff: { items: [], total: { from: 2200, to: 2600 } },
  };
  const paid: AuditEntry = { by: staff, what: 'paid', detail: 'paid', at: at(2) };
  it('shows what is left to collect', () => {
    const gap = paidGap({
      ...order(true, [edit, paid], 2),
      lines: [{ ...order(true, [], 2).lines[0]!, priceCents: 1300 }],
    });
    expect(gap).toEqual({ paidCents: 2200, totalCents: 2600, gapCents: 400 });
  });
  it('is null when unpaid or the payment scrolled out', () => {
    expect(paidGap(order(false, [edit, paid], 2))).toBeNull();
    expect(paidGap(order(true, [edit], 3))).toBeNull();
  });
  it('lastStaffEdit is the newest entry only when it is a seller edit', () => {
    expect(lastStaffEdit(order(true, [edit, paid], 2))).toBe(edit);
    expect(lastStaffEdit(order(true, [paid, edit], 2))).toBe(edit);
    const later: AuditEntry = { by: staff, what: 'status', detail: 'ready', at: at(4) };
    expect(lastStaffEdit(order(true, [later, edit], 2))).toBeNull();
  });
});
