import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ThemeProvider } from 'styled-components';
import type { MenuItemView } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import { lightTheme } from '../../theme/themes';
import { basketDraftOf } from './basketDraft';
import { BasketView } from './CheckoutViews';
import {
  customerReducer,
  menuLoaded,
  noteSet,
  quantitySet,
  type CustomerRootState,
} from './customerSlice';
import { selectBasketLines } from './selectors';
import { setupI18n } from './testSupport';

// Plan 111: a note per basket line, and choices as their own basket lines.

beforeAll(() => setupI18n('en'));
afterEach(cleanup);

const base = {
  description: { en: '', id: '' },
  size: { en: '1 Pack', id: '1 Bungkus' },
  remaining: null,
  soldOut: false,
} as const;
const items: Array<MenuItemView> = [
  { ...base, id: 'siomay', name: { en: 'Siomay', id: 'Siomay' }, priceCents: 1500 },
  { ...base, id: 'snack', name: { en: 'Snack Mix', id: 'Aneka' }, priceCents: 600 },
  {
    ...base,
    id: 'sukun',
    groupId: 'snack',
    name: { en: 'Kripik Sukun', id: 'Kripik Sukun' },
    priceCents: 600,
  },
];
const data = {
  seller: { id: 's1', slug: 'k', name: 'K' },
  kitchen: { sellerId: 's1', name: 'K', tagline: { en: '', id: '' } },
  week: {
    cookingDate: '2026-10-24',
    cutoffAt: '2026-10-23T12:00:00+10:30',
    status: 'published',
    pickupPoints: [],
    delivery: { available: false, note: { en: '', id: '' } },
  },
  ordering: { open: true },
  items,
} as unknown as MenuResponse;

const root = (customer: ReturnType<typeof customerReducer>): CustomerRootState => ({ customer });

function filled() {
  let state = customerReducer(undefined, menuLoaded(data));
  state = customerReducer(state, quantitySet({ itemId: 'siomay', qty: 1 }));
  return customerReducer(state, quantitySet({ itemId: 'sukun', qty: 2 }));
}

describe('line notes in the store', () => {
  it('keeps a trimmed note only for a line in the basket, and drops it with the line', () => {
    let state = customerReducer(undefined, menuLoaded(data));
    state = customerReducer(state, noteSet({ itemId: 'siomay', note: 'no pare' }));
    expect(state.basketNotes).toEqual({});
    state = customerReducer(state, quantitySet({ itemId: 'siomay', qty: 1 }));
    state = customerReducer(state, noteSet({ itemId: 'siomay', note: '  no pare  ' }));
    expect(state.basketNotes).toEqual({ siomay: 'no pare' });
    expect(basketDraftOf(root(state))?.notes).toEqual({ siomay: 'no pare' });
    state = customerReducer(state, noteSet({ itemId: 'siomay', note: '' }));
    expect(state.basketNotes).toEqual({});
    state = customerReducer(state, noteSet({ itemId: 'siomay', note: 'again' }));
    state = customerReducer(state, quantitySet({ itemId: 'siomay', qty: 0 }));
    expect(state.basketNotes).toEqual({});
  });

  it('names a choice line after its dish', () => {
    const lines = selectBasketLines(root(filled()));
    expect(lines.find((line) => line.item.id === 'sukun')?.groupName).toEqual({
      en: 'Snack Mix',
      id: 'Aneka',
    });
  });
});

function Basket() {
  const [state, setState] = useState(filled);
  const noop = () => undefined;
  return (
    <ThemeProvider theme={lightTheme}>
      <BasketView
        data={data}
        lang="en"
        lines={selectBasketLines(root(state))}
        totalCents={0}
        fulfilment="pickup"
        pickupId={undefined}
        editing={false}
        notices={[]}
        closed={null}
        stockProblem={false}
        notes={state.basketNotes}
        onQty={noop}
        onNote={(itemId, note) =>
          setState((prev) => customerReducer(prev, noteSet({ itemId, note })))
        }
        onFulfilment={noop}
        onChangePlace={noop}
        onNext={noop}
        onBack={noop}
      />
    </ThemeProvider>
  );
}

describe('basket pencil', () => {
  it('shows "dish · choice", then saves, shows and removes a note', () => {
    render(<Basket />);
    expect(screen.getByText('Snack Mix · Kripik Sukun')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Add a note for Siomay' }));
    expect(screen.getByRole('dialog', { name: 'Note for Siomay' })).toBeVisible();
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Note'), {
      target: { value: 'No pare please' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    expect(screen.getByText('No pare please')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Change the note for Siomay' }));
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Note'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    expect(screen.queryByText('No pare please')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add a note for Siomay' })).toBeVisible();
  });
});
