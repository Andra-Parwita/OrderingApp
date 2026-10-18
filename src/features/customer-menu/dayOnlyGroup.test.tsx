import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ThemeProvider } from 'styled-components';
import type { MenuItemView } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import { lightTheme } from '../../theme/themes';
import { DishList } from './DishesView';
import { setupI18n } from './testSupport';

// Plan 107: on-the-day-only dishes sit in their own group under the orderable ones, with no add button.

beforeAll(() => setupI18n('en'));
afterEach(cleanup);

const item = (id: string, name: string, extra: Partial<MenuItemView> = {}): MenuItemView => ({
  id,
  name: { en: name, id: name },
  description: { en: '', id: '' },
  size: { en: '1 box', id: '1 kotak' },
  priceCents: 150,
  remaining: null,
  soldOut: false,
  ...extra,
});

function show(items: Array<MenuItemView>) {
  const data = { items } as unknown as MenuResponse;
  return render(
    <ThemeProvider theme={lightTheme}>
      <DishList data={data} basket={{}} lang="en" onQty={() => undefined} readOnly={false} />
    </ThemeProvider>,
  );
}

describe('on the day only group', () => {
  it('shows no group heading when every dish is orderable', () => {
    show([item('a', 'Lemper')]);
    expect(screen.queryByText('On the day only · at the stall')).toBeNull();
  });

  it('lists day-only dishes under the heading with the label and no add button', () => {
    show([
      item('a', 'Lemper'),
      item('b', 'Sambal Matah', { preorder: false, onTheDay: 'available' }),
    ]);
    const heading = screen.getByRole('heading', { name: 'On the day only · at the stall' });
    const group = heading.closest('section') as HTMLElement;
    expect(group).toHaveTextContent('Sambal Matah');
    expect(group).toHaveTextContent('Available on the day');
    expect(group.querySelector('button')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add one Lemper' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Add one Sambal Matah' })).toBeNull();
  });

  it('keeps a dish sold both ways orderable, with its stall marker, outside the group', () => {
    show([
      item('a', 'Pastel', { onTheDay: 'available' }),
      item('b', 'Sambal Matah', { preorder: false }),
    ]);
    expect(screen.getByText('Also at the stall')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add one Pastel' })).toBeEnabled();
    const group = screen.getByRole('heading', { name: /On the day only/ }).closest('section');
    expect(group).not.toHaveTextContent('Pastel');
  });
});
