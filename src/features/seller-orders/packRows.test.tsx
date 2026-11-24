// Plan 132: the total with Paid / Not paid on the order rows, and "N of M packed".
import { screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Order } from '../../../shared/domain';
import { LiveOrderRow } from './LiveOrderRow';
import { PhoneOrderRow } from './PhoneOrderRow';
import { createTestStore, makeOrder, renderWithStore, setupI18n } from './testSupport';

beforeAll(setupI18n);

const noop = () => undefined;
const withOneTicked = (): Order => {
  const [first] = makeOrder().lines;
  if (!first) throw new Error('sample order has a line');
  return makeOrder({
    lines: [
      { ...first, ticked: true },
      { ...first, itemId: 'tempe' },
    ],
  });
};

describe.each([
  ['phone', (order: Order) => <PhoneOrderRow order={order} onOpen={noop} />],
  [
    'tablet',
    (order: Order) => <LiveOrderRow order={order} selected={false} isNew={false} onOpen={noop} />,
  ],
])('%s row', (_name, row) => {
  it('shows the total with Not paid under it, and Paid for a paid order', () => {
    const store = createTestStore({ saga: false });
    const view = renderWithStore(row(makeOrder()), store);
    expect(screen.getByText(/\$20\.00/)).toBeInTheDocument();
    expect(screen.getByText('Not paid')).toBeInTheDocument();
    view.unmount();
    renderWithStore(row(makeOrder({ paid: true })), store);
    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.queryByText('Not paid')).not.toBeInTheDocument();
  });

  it('always shows N of M packed on a packable row (0 of M too), and Packed when packed', () => {
    const store = createTestStore({ saga: false });
    const none = renderWithStore(row(makeOrder()), store);
    expect(screen.getByText('· 0 of 1 packed')).toBeInTheDocument();
    none.unmount();
    const some = renderWithStore(row(withOneTicked()), store);
    expect(screen.getByText('· 1 of 2 packed')).toBeInTheDocument();
    some.unmount();
    const done = renderWithStore(row(makeOrder({ packed: true })), store);
    expect(screen.getByText('· Packed')).toBeInTheDocument();
    done.unmount();
    renderWithStore(row(makeOrder({ status: 'cancelled' })), store);
    expect(screen.queryByText(/packed/i)).not.toBeInTheDocument();
  });
});
