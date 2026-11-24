import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from '../../api/client';
import * as kitchen from '../../api/kitchen';
import * as madeApi from '../../api/made';
import { AUTOSAVE_DELAY_MS, forgetAutoSavers } from '../../components/autoSave/autoSave';
import { CookScreen } from './CookScreen';
import {
  createTestStore,
  renderWithStore,
  sampleOrders,
  seed,
  setupI18n,
  type TestStore,
} from './testSupport';

// Plan 073: made ± is saved in one go (the plan 072 auto-save). Plan 132: Pack ticks only by a button.

beforeAll(setupI18n);
beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  forgetAutoSavers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const pause = () => act(() => vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS + 50));

function renderKitchen(): TestStore {
  const store = createTestStore();
  seed(store, sampleOrders());
  renderWithStore(<CookScreen />, store);
  return store;
}

function answerMade() {
  let total = 0;
  return vi.spyOn(madeApi, 'addMade').mockImplementation((body) => {
    total += body.delta;
    return Promise.resolve({ ok: true, data: { made: { [body.itemId]: total } } } as never);
  });
}

describe('Cook made ± in one go', () => {
  it('3 taps send nothing until the pause, then one request with the final count', async () => {
    const add = answerMade();
    const store = renderKitchen();
    const row = screen.getByText('Chicken lemper').closest('li') as HTMLElement;
    const more = () => within(row).getByRole('button', { name: 'One more Chicken lemper' });
    fireEvent.click(more());
    fireEvent.click(more());
    fireEvent.click(more());
    expect(within(row).getByText('3/5')).toBeInTheDocument();
    expect(add).not.toHaveBeenCalled();
    await pause();
    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0]?.[0]).toEqual({ itemId: 'lemper', delta: 3 });
    expect(store.getState().sellerCook.made['lemper']).toBe(3);
    expect(within(row).getByText('3/5')).toBeInTheDocument();
  });

  it('taps up and down to the same number send nothing', async () => {
    const add = answerMade();
    renderKitchen();
    const row = screen.getByText('Chicken lemper').closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'One more Chicken lemper' }));
    fireEvent.click(within(row).getByRole('button', { name: 'One less Chicken lemper' }));
    await pause();
    expect(add).not.toHaveBeenCalled();
  });

  it('a refusal puts the count back and says why', async () => {
    vi.spyOn(madeApi, 'addMade').mockResolvedValue({
      ok: false,
      error: 'forbidden',
      status: 403,
      message: 'No',
    } as never);
    renderKitchen();
    const row = screen.getByText('Chicken lemper').closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'One more Chicken lemper' }));
    expect(within(row).getByText('1/5')).toBeInTheDocument();
    await pause();
    expect(within(row).getByText('0/5')).toBeInTheDocument();
    expect(screen.getByText(/was not accepted/)).toBeInTheDocument();
  });

  it('a failure to get through keeps the count and offers Try again', async () => {
    const add = vi.spyOn(madeApi, 'addMade').mockResolvedValueOnce({
      ok: false,
      error: 'network',
      status: 0,
      message: 'offline',
    } as never);
    renderKitchen();
    const row = screen.getByText('Chicken lemper').closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'One more Chicken lemper' }));
    await pause();
    expect(within(row).getByText('1/5')).toBeInTheDocument();
    expect(screen.getByText(/Not saved yet/)).toBeInTheDocument();
    add.mockResolvedValue({ ok: true, data: { made: { lemper: 1 } } } as never);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(add).toHaveBeenCalledTimes(2);
    expect(add.mock.calls[1]?.[0]).toEqual({ itemId: 'lemper', delta: 1 });
  });

  it('the page being hidden saves at once', async () => {
    const add = answerMade();
    renderKitchen();
    const row = screen.getByText('Chicken lemper').closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'One more Chicken lemper' }));
    fireEvent.click(within(row).getByRole('button', { name: 'One more Chicken lemper' }));
    expect(add).not.toHaveBeenCalled();
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0]?.[0]).toEqual({ itemId: 'lemper', delta: 2 });
  });
});

describe('Pack ticks saved only by a button (plan 132)', () => {
  const echo = () =>
    vi.spyOn(kitchen, 'packOrder').mockImplementation((code, body) => {
      const order = sampleOrders().find((candidate) => candidate.code === code);
      if (!order) throw new Error(code);
      const ticked = body.ticked ?? [];
      return Promise.resolve({
        ok: true,
        data: {
          order: {
            ...order,
            ...(body.packed ? { packed: true } : {}),
            lines: order.lines.map((line) => ({ ...line, ticked: ticked.includes(line.itemId) })),
          },
        },
      } as never);
    });
  const status = () =>
    vi.spyOn(client, 'setOrderStatus').mockImplementation((code, to) => {
      const order = sampleOrders().find((candidate) => candidate.code === code);
      return Promise.resolve({ ok: true, data: { order: { ...order, status: to } } } as never);
    });

  function openPack(): void {
    renderKitchen();
    fireEvent.click(screen.getByRole('tab', { name: /Pack/ }));
  }
  const boxes = () => screen.getAllByRole('checkbox');
  const flush = () => act(() => vi.advanceTimersByTimeAsync(0));

  it('a tap sends nothing, even after the old auto-save pause', async () => {
    const pack = echo();
    openPack();
    fireEvent.click(boxes()[0] as HTMLElement);
    fireEvent.click(boxes()[1] as HTMLElement);
    fireEvent.click(boxes()[1] as HTMLElement);
    expect(boxes()[0]).toHaveAttribute('aria-checked', 'true');
    await pause();
    expect(pack).not.toHaveBeenCalled();
  });

  it('Save sends the final set of ticks only', async () => {
    const pack = echo();
    const moved = status();
    openPack();
    fireEvent.click(boxes()[0] as HTMLElement);
    fireEvent.click(boxes()[1] as HTMLElement);
    fireEvent.click(boxes()[1] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await flush();
    expect(pack).toHaveBeenCalledTimes(1);
    expect((pack.mock.calls[0]?.[1] as { ticked: Array<string> }).ticked).toHaveLength(1);
    expect(pack.mock.calls[0]?.[1]).not.toHaveProperty('packed');
    expect(moved).not.toHaveBeenCalled();
  });

  it('Ready & next bag sends ticks + packed, then the status, and opens the next bag', async () => {
    const pack = echo();
    const moved = status();
    openPack();
    expect(screen.getByRole('region', { name: /Rina/ })).toBeInTheDocument();
    fireEvent.click(boxes()[0] as HTMLElement);
    fireEvent.click(boxes()[1] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Ready & next bag' }));
    await flush();
    expect(pack).toHaveBeenCalledTimes(1);
    expect((pack.mock.calls[0]?.[1] as { ticked: Array<string> }).ticked).toHaveLength(2);
    expect(pack.mock.calls[0]?.[1]).toHaveProperty('packed', true);
    expect(moved).toHaveBeenCalledTimes(1);
    expect(moved.mock.calls[0]?.[1]).toBe('ready_for_pickup');
    expect(screen.queryByRole('region', { name: /Rina/ })).not.toBeInTheDocument();
  });

  it('Ready with unticked items asks first, and sends force only on "Ready anyway"', async () => {
    const pack = echo();
    status();
    openPack();
    fireEvent.click(boxes()[0] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Ready for pickup' }));
    await flush();
    expect(pack).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('1 item not ticked. Ready anyway?')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ready anyway' }));
    await flush();
    expect(pack).toHaveBeenCalledTimes(1);
    expect(pack.mock.calls[0]?.[1]).toHaveProperty('force', true);
  });

  it('switching bag with unsaved ticks asks "Close without saving?"', async () => {
    const pack = echo();
    openPack();
    fireEvent.click(boxes()[0] as HTMLElement);
    const rows = within(screen.getByRole('list', { name: 'Bags' })).getAllByRole('button');
    const last = rows[rows.length - 1] as HTMLElement;
    fireEvent.click(last);
    expect(screen.getByText('Close without saving?', { selector: 'h4' })).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Keep packing' }),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(boxes()[0]).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(last);
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Close' }));
    await flush();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(pack).not.toHaveBeenCalled();
  });

  it('a refused Save keeps the ticks on the page and shows the error', async () => {
    vi.spyOn(kitchen, 'packOrder').mockResolvedValue({
      ok: false,
      error: 'forbidden',
      status: 403,
      message: 'No',
    } as never);
    openPack();
    fireEvent.click(boxes()[0] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await flush();
    expect(boxes()[0]).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
