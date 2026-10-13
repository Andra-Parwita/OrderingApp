import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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

// Plan 073: made ± and Pack ticks are saved in one go (the plan 072 auto-save).

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
  const store = createTestStore({ saga: false });
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

describe('Pack ticks in one go', () => {
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
            lines: order.lines.map((line) => ({ ...line, ticked: ticked.includes(line.itemId) })),
          },
        },
      } as never);
    });

  function openPack(): void {
    renderKitchen();
    fireEvent.click(screen.getByRole('tab', { name: /Pack/ }));
  }

  it('a burst of ticks saves once, with the final set', async () => {
    const pack = echo();
    openPack();
    const boxes = () => screen.getAllByRole('checkbox');
    fireEvent.click(boxes()[0] as HTMLElement);
    fireEvent.click(boxes()[1] as HTMLElement);
    fireEvent.click(boxes()[1] as HTMLElement);
    expect(pack).not.toHaveBeenCalled();
    await pause();
    expect(pack).toHaveBeenCalledTimes(1);
    expect((pack.mock.calls[0]?.[1] as { ticked: Array<string> }).ticked).toHaveLength(1);
  });

  it('Packed sends the ticks first, then packed', async () => {
    const pack = echo();
    openPack();
    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Packed · next bag' }));
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(pack).toHaveBeenCalledTimes(2);
    expect(pack.mock.calls[0]?.[1]).toHaveProperty('ticked');
    expect(pack.mock.calls[1]?.[1]).toEqual({ packed: true });
  });

  it('leaving flushes pending ticks; a refusal puts the bag back', async () => {
    const pack = vi.spyOn(kitchen, 'packOrder').mockResolvedValue({
      ok: false,
      error: 'forbidden',
      status: 403,
      message: 'No',
    } as never);
    openPack();
    const box = screen.getAllByRole('checkbox')[0] as HTMLElement;
    fireEvent.click(box);
    expect(box).toHaveAttribute('aria-checked', 'true');
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(pack).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/was not accepted/)).toBeInTheDocument();
  });
});
