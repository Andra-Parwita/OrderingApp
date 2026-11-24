// Plan 132: the pack sheet. Ticks are local until a button; closing with changes asks; Ready with
// unticked items warns and then goes ahead.
import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { Provider } from 'react-redux';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '../../../shared/domain';
import { initI18n } from '../../i18n/init';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { registerPackI18n } from './i18n/register';

const packOrder = vi.fn();
const setOrderStatus = vi.fn();
vi.mock('../../api/kitchen', () => ({
  packOrder: (...args: Array<unknown>): unknown => packOrder(...args),
}));
vi.mock('../../api/client', () => ({
  setOrderStatus: (...args: Array<unknown>): unknown => setOrderStatus(...args),
}));
vi.mock('../../api/device/sellerContext', () => ({ currentSellerSlug: () => 'home' }));

import { PackSheet } from './PackSheet';

const line = (itemId: string, name: string, ticked?: boolean) => ({
  itemId,
  name: { en: name, id: name },
  size: { en: '', id: '' },
  priceCents: 1000,
  qty: 1,
  ...(ticked ? { ticked } : {}),
});
const order = (fulfilment = 'pickup'): Order =>
  ({
    id: 'o1',
    code: 'K7F2QX',
    firstName: 'Grace',
    status: 'confirmed',
    fulfilment,
    paid: false,
    lines: [line('a', 'Empek', true), line('b', 'Cendol'), line('c', 'Sambal')],
  }) as unknown as Order;

beforeAll(async () => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
  if (!i18n.isInitialized) await initI18n();
  registerPackI18n();
  await i18n.changeLanguage('en');
});
beforeEach(() => {
  packOrder.mockReset();
  setOrderStatus.mockReset();
});

function show(onClose = vi.fn(), onNext = vi.fn(), fulfilment = 'pickup') {
  const store = configureStore({ reducer: (state: object = {}) => state });
  render(
    <Provider store={store}>
      <AppThemeProvider>
        <PackSheet
          order={order(fulfilment)}
          where="Pickup · 11:00"
          onClose={onClose}
          onNext={onNext}
        />
      </AppThemeProvider>
    </Provider>,
  );
  return { onClose, onNext };
}

describe('PackSheet', () => {
  it('starts from the saved ticks and sends nothing on a tap', () => {
    show();
    expect(screen.getByText('1 of 3 ticked')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /Cendol/ }));
    expect(screen.getByText('2 of 3 ticked')).toBeInTheDocument();
    expect(packOrder).not.toHaveBeenCalled();
    expect(setOrderStatus).not.toHaveBeenCalled();
  });

  it('closes at once when nothing changed, and asks when something did', () => {
    const { onClose } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('checkbox', { name: /Cendol/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByText('Close without saving?')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Keep packing' }));
    expect(screen.queryByText('Close without saving?')).not.toBeInTheDocument();
  });

  it('Save sends the ticks only and closes', async () => {
    packOrder.mockResolvedValue({ ok: true, data: { order: order() } });
    const { onClose } = show();
    fireEvent.click(screen.getByRole('checkbox', { name: /Cendol/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(packOrder).toHaveBeenCalledWith('K7F2QX', { ticked: ['a', 'b'] }, undefined, 'home');
    expect(setOrderStatus).not.toHaveBeenCalled();
  });

  it('Ready with unticked items warns, naming them, then goes ahead with force', async () => {
    packOrder.mockResolvedValue({ ok: true, data: { order: order() } });
    setOrderStatus.mockResolvedValue({ ok: true, data: { order: order() } });
    const { onClose } = show();
    fireEvent.click(screen.getByRole('button', { name: /Ready for pickup/ }));
    expect(screen.getByText('2 items not ticked. Ready anyway?')).toBeInTheDocument();
    expect(screen.getByText('Cendol, Sambal')).toBeInTheDocument();
    expect(packOrder).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Ready anyway' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(packOrder).toHaveBeenCalledWith(
      'K7F2QX',
      { ticked: ['a'], packed: true, force: true },
      undefined,
      'home',
    );
    expect(setOrderStatus).toHaveBeenCalledWith('K7F2QX', 'ready_for_pickup', undefined, 'home');
  });

  it('keeps the sheet open with the ticks when the server fails', async () => {
    packOrder.mockResolvedValue({ ok: false, error: 'network', status: 0, message: '' });
    const { onClose } = show();
    fireEvent.click(screen.getByRole('checkbox', { name: /Cendol/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Sambal/ }));
    fireEvent.click(screen.getByRole('button', { name: /Ready for pickup/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('3 of 3 ticked')).toBeInTheDocument();
  });

  it('Ready & next order hands over after it worked', async () => {
    packOrder.mockResolvedValue({ ok: true, data: { order: order() } });
    setOrderStatus.mockResolvedValue({ ok: true, data: { order: order() } });
    const { onNext } = show();
    fireEvent.click(screen.getByRole('checkbox', { name: /Cendol/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Sambal/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ready & next order' }));
    await waitFor(() => expect(onNext).toHaveBeenCalled());
  });

  it('a delivery order reads Packed and only marks it packed: no status change', async () => {
    packOrder.mockResolvedValue({ ok: true, data: { order: order('delivery') } });
    const { onClose } = show(vi.fn(), vi.fn(), 'delivery');
    expect(screen.queryByRole('button', { name: /Ready for pickup/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Packed & next order' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Packed$/ }));
    expect(screen.getByText('2 items not ticked. Packed anyway?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Packed anyway' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(packOrder).toHaveBeenCalledWith(
      'K7F2QX',
      { ticked: ['a'], packed: true, force: true },
      undefined,
      'home',
    );
    expect(setOrderStatus).not.toHaveBeenCalled();
  });
});
