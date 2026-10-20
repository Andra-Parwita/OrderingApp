import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from 'styled-components';
import type { MenuItemView } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import { lightTheme } from '../../theme/themes';
import { DishList } from './DishesView';
import { setupI18n } from './testSupport';

// Plan 111: a dish with choices is one card; its + opens a sheet to pick how many of each.

beforeAll(() => setupI18n('en'));
afterEach(cleanup);

const base = {
  description: { en: '', id: '' },
  size: { en: '1 Pack', id: '1 Bungkus' },
  priceCents: 600,
  remaining: null,
  soldOut: false,
} as const;
const parent: MenuItemView = { ...base, id: 'snack', name: { en: 'Snack Mix', id: 'Aneka' } };
const choice = (id: string, name: string, extra: Partial<MenuItemView> = {}): MenuItemView => ({
  ...base,
  id,
  groupId: 'snack',
  name: { en: name, id: name },
  ...extra,
});

function show(items: Array<MenuItemView>, basket: Record<string, number> = {}) {
  const onQty = vi.fn();
  const data = { items } as unknown as MenuResponse;
  render(
    <ThemeProvider theme={lightTheme}>
      <DishList data={data} basket={basket} lang="en" onQty={onQty} readOnly={false} />
    </ThemeProvider>,
  );
  return onQty;
}

const items = [
  parent,
  choice('sukun', 'Kripik Sukun', { remaining: 3 }),
  choice('lanting', 'Lanting Bawang'),
  choice('ubi', 'Kripik Ubi Ungu', { soldOut: true, remaining: 0 }),
];

describe('dish choices on the customer menu', () => {
  it('shows one card for the dish and none for its choices', () => {
    show(items);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Snack Mix')).toBeVisible();
    expect(screen.queryByText('Kripik Sukun')).toBeNull();
  });

  it('shows the total across the choices on the card', () => {
    show(items, { sukun: 2, lanting: 1 });
    expect(within(screen.getByRole('group', { name: 'Snack Mix' })).getByText('3')).toBeVisible();
  });

  it('opens the sheet, limits a choice to what is left and adds the picks', () => {
    const onQty = show(items);
    fireEvent.click(screen.getByRole('button', { name: 'Add one Snack Mix' }));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Snack Mix · $6.00')).toBeVisible();
    expect(within(sheet).getByText('3 left')).toBeVisible();
    expect(within(sheet).getByRole('button', { name: 'Add 0 to basket · $0.00' })).toBeDisabled();
    expect(within(sheet).getByText('Sold out')).toBeVisible();
    expect(within(sheet).getByRole('button', { name: 'Add one Kripik Ubi Ungu' })).toBeDisabled();
    const more = () => within(sheet).getByRole('button', { name: 'Add one Kripik Sukun' });
    for (let i = 0; i < 5; i += 1) fireEvent.click(more());
    expect(more()).toBeDisabled();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add one Lanting Bawang' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add 4 to basket · $24.00' }));
    expect(onQty).toHaveBeenCalledWith('sukun', 3);
    expect(onQty).toHaveBeenCalledWith('lanting', 1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows Sold out on the card when every choice is out', () => {
    show([parent, choice('a', 'A', { soldOut: true, remaining: 0 })]);
    expect(screen.getByText('Sold out')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Add one Snack Mix' })).toBeNull();
  });
});
