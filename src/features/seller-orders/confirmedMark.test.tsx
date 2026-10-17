// Plan 087: the "✓ C-7K3M" mark on a Remember me order, and nothing on any other.
import { screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { LiveOrderRow } from './LiveOrderRow';
import { OrderDetailScreen } from './OrderDetailScreen';
import { PhoneOrderRow } from './PhoneOrderRow';
import {
  createTestStore,
  makeMenuView,
  makeOrder,
  renderWithStore,
  seed,
  seedMenu,
  setupI18n,
} from './testSupport';

beforeAll(setupI18n);

const CODE = 'a1b2c3d4e5f6a1b2c3d4e5f6';
const noop = () => undefined;
const confirmed = () => makeOrder({ confirmed: true, customerCode: CODE });
const plain = () => makeOrder({ customerCode: CODE });

describe('Passkey-confirmed mark', () => {
  it('shows a short pill in the phone and tablet rows only for a confirmed order', () => {
    const store = createTestStore({ saga: false });
    const { unmount } = renderWithStore(<PhoneOrderRow order={confirmed()} onOpen={noop} />, store);
    expect(screen.getByText(/^✓ C-[A-Z0-9]{4}$/)).toBeInTheDocument();
    unmount();
    const tablet = renderWithStore(
      <LiveOrderRow order={confirmed()} selected={false} isNew={false} onOpen={noop} />,
      store,
    );
    expect(screen.getByText(/^✓ C-[A-Z0-9]{4}$/)).toBeInTheDocument();
    tablet.unmount();
    renderWithStore(<PhoneOrderRow order={plain()} onOpen={noop} />, store);
    expect(screen.queryByText(/✓ C-/)).not.toBeInTheDocument();
  });

  it('shows the pill with its hint in the order detail', () => {
    const store = createTestStore({ saga: false });
    seed(store, [confirmed()]);
    seedMenu(store, makeMenuView('live'));
    renderWithStore(<OrderDetailScreen code="K7F2QX" onBack={noop} />, store);
    expect(screen.getByText(/^✓ Passkey-confirmed · C-[A-Z0-9]{4}$/)).toBeInTheDocument();
    expect(screen.getByText('Placed by a customer signed in with Remember me')).toBeInTheDocument();
  });
});
