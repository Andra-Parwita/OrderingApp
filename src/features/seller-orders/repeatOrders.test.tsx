// Plan 114 follow-up: the "possible repeat" note on the second of two look-alike orders.
import { screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Order } from '../../../shared/domain';
import { LiveOrderRow } from './LiveOrderRow';
import { PhoneOrderRow } from './PhoneOrderRow';
import { RepeatNote } from './RepeatNote';
import { findRepeats } from './repeatOrders';
import { createTestStore, makeOrder, renderWithStore, seed, setupI18n } from './testSupport';

beforeAll(setupI18n);

const CC = 'a1b2c3d4e5f6a1b2c3d4e5f6';
const first = (o: Partial<Order> = {}) =>
  makeOrder({ id: 'a', code: 'AAAAAA', customerCode: CC, createdAt: '2026-10-07T08:00:00Z', ...o });
const second = (o: Partial<Order> = {}) =>
  makeOrder({ id: 'b', code: 'BBBBBB', customerCode: CC, createdAt: '2026-10-07T08:00:45Z', ...o });
const noop = () => undefined;

describe('findRepeats', () => {
  it('flags only the later order, pointing to the earlier one', () => {
    const map = findRepeats([second(), first()]);
    expect([...map.keys()]).toEqual(['BBBBBB']);
    expect(map.get('BBBBBB')).toEqual({ code: 'AAAAAA', seconds: 45 });
  });

  it('ignores notes and fulfilment, but not quantities or dishes', () => {
    expect(findRepeats([first(), second({ note: 'x', fulfilment: 'delivery' })]).size).toBe(1);
    const line = first().lines[0]!;
    expect(findRepeats([first(), second({ lines: [{ ...line, qty: 3 }] })]).size).toBe(0);
    expect(findRepeats([first(), second({ lines: [{ ...line, itemId: 'other' }] })]).size).toBe(0);
  });

  it('honours the 120 s window', () => {
    expect(findRepeats([first(), second({ createdAt: '2026-10-07T08:02:00Z' })]).size).toBe(1);
    expect(findRepeats([first(), second({ createdAt: '2026-10-07T08:02:01Z' })]).size).toBe(0);
  });

  it('needs the same non-empty customer code, menu orders, none cancelled', () => {
    expect(findRepeats([first(), second({ customerCode: 'zzz' })]).size).toBe(0);
    expect(
      findRepeats([first({ customerCode: undefined }), second({ customerCode: undefined })]).size,
    ).toBe(0);
    expect(findRepeats([first({ customerCode: '' }), second({ customerCode: '' })]).size).toBe(0);
    expect(findRepeats([first(), second({ status: 'cancelled' })]).size).toBe(0);
    expect(findRepeats([first({ status: 'cancelled' }), second()]).size).toBe(0);
    expect(findRepeats([first(), second({ private: { eventDate: '2026-10-10' } })]).size).toBe(0);
  });
});

describe('Repeat note and tag', () => {
  it('shows the tag in both rows and the note in the detail, only on the later order', () => {
    const store = createTestStore({ saga: false });
    seed(store, [first(), second()]);
    const phone = renderWithStore(<PhoneOrderRow order={second()} onOpen={noop} />, store);
    expect(screen.getByTestId('repeat-tag')).toHaveAttribute(
      'title',
      'Possible repeat of AAA-AAA (same dishes, 45 s apart)',
    );
    phone.unmount();
    const live = renderWithStore(
      <LiveOrderRow order={second()} selected={false} isNew={false} onOpen={noop} />,
      store,
    );
    expect(screen.getByTestId('repeat-tag')).toBeInTheDocument();
    live.unmount();
    const earlier = renderWithStore(<PhoneOrderRow order={first()} onOpen={noop} />, store);
    expect(screen.queryByTestId('repeat-tag')).not.toBeInTheDocument();
    earlier.unmount();
    renderWithStore(<RepeatNote code="BBBBBB" />, store);
    expect(screen.getByTestId('repeat-note')).toHaveTextContent('Possible repeat of');
  });
});
