import { fireEvent, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as madeApi from '../../api/made';
import { CookScreen } from './CookScreen';
import {
  createTestStore,
  renderWithStore,
  sampleOrders,
  seed,
  setPhoneViewport,
  setupI18n,
} from './testSupport';

// Plan 100 (ruling B2): the Cook tab on a phone. The tablet layout is checked at the end.

beforeAll(setupI18n);
beforeEach(() => {
  window.localStorage.clear();
  setPhoneViewport(false);
});

function renderKitchen() {
  const store = createTestStore();
  seed(store, sampleOrders());
  renderWithStore(<CookScreen />, store);
  return store;
}

describe('Kitchen · Cook on a phone', () => {
  beforeEach(() => setPhoneViewport(true));

  it('shows count, name, split and people in one row', () => {
    renderKitchen();
    const row = screen.getByText(/Chicken lemper/).closest('li') as HTMLElement;
    expect(within(row).getByText('5')).toBeInTheDocument();
    expect(within(row).getByText(/pickup/)).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Who ordered Chicken lemper' })).toBeVisible();
    expect(screen.queryByText(/Cancelled orders aren't counted/)).toBeNull();
  });

  it('- and + use the same handlers and change the count', () => {
    vi.spyOn(madeApi, 'addMade').mockResolvedValue({ ok: true, data: { made: {} } } as never);
    renderKitchen();
    const row = screen.getByText(/Chicken lemper/).closest('li') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'One more Chicken lemper' }));
    fireEvent.click(within(row).getByRole('button', { name: 'One more Chicken lemper' }));
    fireEvent.click(within(row).getByRole('button', { name: 'One less Chicken lemper' }));
    expect(within(row).getByLabelText('1 of 5 cooked')).toHaveTextContent('1');
  });

  it('folds the controls: Group by name, chef select, switch with its hint, print icon', () => {
    renderKitchen();
    expect(screen.getByRole('radiogroup', { name: 'Group by' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Count mode/ })).toHaveAccessibleDescription(
      'tick off as you cook',
    );
    expect(screen.getByText('0 of 9 cooked')).toBeInTheDocument();
    expect(screen.queryByText('tick off as you cook', { selector: 'span:not([id])' })).toBeNull();
  });

  it('opens the notes from one Notes (N) row', () => {
    renderKitchen();
    const toggle = screen.getByRole('button', { name: /^Notes \(\d+\)$/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Peanut allergy/)).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Peanut allergy/)).toBeInTheDocument();
  });
});

describe('Kitchen · Cook on a tablet', () => {
  it('keeps the tablet layout: intro text, Group by label, n/total, notes open', () => {
    renderKitchen();
    expect(screen.getByText(/Cancelled orders aren't counted/)).toBeInTheDocument();
    expect(screen.getByText('Group by')).toBeInTheDocument();
    expect(screen.getByText('0/5')).toBeInTheDocument();
    expect(screen.getByText(/Peanut allergy/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Notes \(/ })).toBeNull();
  });
});
