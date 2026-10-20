import { configureStore, type Middleware } from '@reduxjs/toolkit';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppThemeProvider } from '../../theme/AppThemeProvider';
import { forgetAutoSavers } from './autoSave';
import { DishEditor } from './DishEditor';
import { applySession, EMPTY_SESSION } from './draftSession';
import {
  EMPTY_DRAFT,
  changedOnly,
  createRequestOf,
  draftOfDish,
  newChoiceDraft,
  updateDishRequestOf,
  validateDraft,
  type ItemDraft,
} from './itemForm';
import { MenuScreen } from './MenuScreen';
import { menuReducer, opRequested, type MenuData } from './menuSlice';
import type { MenuSlots } from './slots';
import { useMenuTestSetup } from './testKit';

// Plan 111 (D-112): the seller's dish editor, Menu and edit session know a dish's choices.

vi.mock('../../api/useSellerLanguages', () => ({ useSellerLanguages: () => 'both' }));
vi.mock('../../api/device/sellerContext', () => ({ currentSellerSlug: () => 'home' }));
vi.mock('../../api/client', () => ({
  fetchSellerOrders: () => Promise.resolve({ ok: true, data: { orders: [] } }),
}));

const notices = vi.hoisted(() => ({ status: vi.fn() }));
vi.mock('../../api/menuNotices', () => ({
  fetchMenuNoticeStatus: notices.status,
  sendMenuNotice: vi.fn(),
}));

const text = (en: string) => ({ en, id: en });
const row = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: text(name),
  description: text(''),
  size: text(''),
  priceCents: 600,
  soldOut: false,
  remaining: null,
  ...extra,
});
const DATA = {
  view: {
    menu: {
      id: 'm1',
      state: 'live',
      cookingDate: '2026-10-24',
      cutoffAt: '2026-10-22T20:00:00+10:00',
      delivery: { available: false, note: text('') },
      placeUses: [],
      wizardStep: 3,
      takingOrders: true,
    },
    dishes: [
      row('i0', 'Siomay', { priceCents: 1500, dishId: 'd0' }),
      row('i1', 'Snacks', { dishId: 'd1' }),
      row('i2', 'Cheese', { dishId: 'c1', groupId: 'i1', limit: 10, remaining: 5 }),
      row('i3', 'Sweet', { dishId: 'c2', groupId: 'i1' }),
    ],
    pickupPoints: [],
  },
  dishes: [
    {
      id: 'd1',
      name: text('Snacks'),
      description: text(''),
      size: text(''),
      priceCents: 600,
      choices: [
        { id: 'c1', name: text('Cheese'), limit: 10 },
        { id: 'c2', name: text('Sweet'), limit: null },
      ],
    },
  ],
  sets: [],
  places: [],
  chefs: [],
  prefs: {},
  past: [],
} as unknown as MenuData;
const slots = {
  preview: () => null,
  share: () => null,
  chefs: () => null,
  newMenu: () => null,
} as unknown as MenuSlots;

const orders = [
  {
    status: 'confirmed',
    lines: [
      { itemId: 'i2', qty: 5 },
      { itemId: 'i3', qty: 3 },
      { itemId: 'i0', qty: 6 },
    ],
  },
];

function setup(data: MenuData = DATA) {
  const sent: Array<{ kind: string; id?: string; request?: unknown }> = [];
  const spy: Middleware = () => (next) => (action) => {
    if (opRequested.match(action)) sent.push(action.payload);
    return next(action);
  };
  const store = configureStore({
    reducer: { sellerMenu: menuReducer, sellerOrders: (state: unknown = { orders }) => state },
    preloadedState: {
      sellerMenu: { load: 'ready' as const, data, busy: false, result: null, seq: 0 },
    },
    middleware: (defaults) => defaults({ serializableCheck: false }).concat(spy),
  });
  const wrap = (ui: React.ReactNode) => (
    <Provider store={store}>
      <MemoryRouter>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </MemoryRouter>
    </Provider>
  );
  return { sent, wrap };
}

beforeEach(() => {
  forgetAutoSavers();
  localStorage.clear();
});

describe('Menu with choices', () => {
  useMenuTestSetup();

  it('lists a dish with its choice count and total sold, and its choices indented', () => {
    const { wrap } = setup();
    render(wrap(<MenuScreen slots={slots} />));
    const parent = screen.getByText('Snacks').closest('[role="row"]') as HTMLElement;
    expect(within(parent).getByText(/2 choices/)).toBeInTheDocument();
    expect(within(parent).getByText('8')).toBeInTheDocument(); // 5 + 3 sold
    expect(within(parent).getByText('$6.00')).toBeInTheDocument();
    const cheese = screen.getByText('Cheese').closest('[role="row"]') as HTMLElement;
    expect(within(cheese).getByText('10')).toBeInTheDocument(); // its limit
    expect(within(cheese).getByText('5')).toBeInTheDocument(); // its sold
    expect(within(cheese).queryByText('$6.00')).not.toBeInTheDocument(); // no price of its own
  });

  it('sells one choice out on its own', () => {
    const { sent, wrap } = setup();
    render(wrap(<MenuScreen slots={slots} />));
    fireEvent.click(screen.getByRole('switch', { name: /Sold out: Cheese/ }));
    expect(sent.at(-1)).toMatchObject({
      kind: 'updateMenuDish',
      id: 'i2',
      request: { soldOut: true },
    });
  });

  it('sells the whole dish out with the dish switch', () => {
    const { sent, wrap } = setup();
    render(wrap(<MenuScreen slots={slots} />));
    fireEvent.click(screen.getByRole('switch', { name: /Sold out: Snacks/ }));
    expect(sent.at(-1)).toMatchObject({ id: 'i1', request: { soldOut: true } });
  });

  it('a chef or helper (not the owner) makes no notice request; the owner does', async () => {
    notices.status.mockReset();
    notices.status.mockResolvedValue({ ok: false, error: 'forbidden', status: 403, message: '' });
    const { wrap } = setup();
    const staff = render(wrap(<MenuScreen slots={slots} />));
    await screen.findByText('Snacks');
    expect(notices.status).not.toHaveBeenCalled();
    staff.unmount();
    render(wrap(<MenuScreen slots={slots} canNotify />));
    await waitFor(() => expect(notices.status).toHaveBeenCalledTimes(1));
  });

  it('hides the choices of a dish that is folded', () => {
    const { wrap } = setup();
    render(wrap(<MenuScreen slots={slots} />));
    fireEvent.click(screen.getByRole('button', { name: /2 choices/ }));
    expect(screen.queryByText('Cheese')).not.toBeInTheDocument();
  });
});

describe('The dish editor with choices', () => {
  useMenuTestSetup();
  const editor = (onClose = vi.fn()) => (
    <DishEditor data={DATA} target={{ kind: 'library', dishId: null }} onClose={onClose} />
  );

  it('adds choices, hides the dish limit, and sends the whole list on Add dish', () => {
    const { sent, wrap } = setup();
    render(wrap(editor()));
    expect(screen.getAllByLabelText('Limit (optional)')).toHaveLength(1);
    expect(screen.getByText('For dishes sold at one price in several kinds.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Add a choice' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Add a choice' }));
    expect(screen.queryAllByLabelText('Limit (optional)')).toHaveLength(0);
    expect(screen.getByText('Every choice sells at this price.')).toBeInTheDocument();
    const names = screen.getAllByLabelText('Choice (English)');
    expect(names).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Name (English)'), { target: { value: 'Snacks' } });
    fireEvent.change(screen.getByLabelText('Price (AUD)'), { target: { value: '6' } });
    fireEvent.change(names[0] as HTMLElement, { target: { value: 'Cheese' } });
    fireEvent.change(names[1] as HTMLElement, { target: { value: 'Sweet' } });
    fireEvent.change(screen.getAllByLabelText('Limit')[0] as HTMLElement, {
      target: { value: '10' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add dish' }));
    expect(sent.at(-1)).toMatchObject({
      kind: 'createDish',
      request: {
        choices: [
          { name: { en: 'Cheese', id: '' }, limit: 10 },
          { name: { en: 'Sweet', id: '' }, limit: null },
        ],
      },
    });
  });

  it('refuses an empty choice name, and a choice goes with its X', () => {
    const { sent, wrap } = setup();
    render(wrap(editor()));
    fireEvent.click(screen.getByRole('button', { name: '+ Add a choice' }));
    fireEvent.change(screen.getByLabelText('Name (English)'), { target: { value: 'Snacks' } });
    fireEvent.change(screen.getByLabelText('Price (AUD)'), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add dish' }));
    expect(screen.getByText('Give the choice a name.')).toBeInTheDocument();
    expect(sent).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /^Remove choice/ }));
    expect(screen.queryAllByLabelText('Choice (English)')).toHaveLength(0);
  });
});

describe('itemForm choices', () => {
  const base: ItemDraft = { ...EMPTY_DRAFT, nameEn: 'Snacks', price: '6', limit: '3' };

  it('ignores the dish limit once there is a choice and checks each choice', () => {
    const choice = { ...newChoiceDraft(), nameEn: 'Cheese', limit: '0' };
    expect(validateDraft({ ...base, choices: [choice] }).errors.choices).toBe('invalid');
    const ok = { ...base, choices: [{ ...choice, limit: '4' }] };
    const result = validateDraft(ok);
    expect(result.errors).toEqual({});
    expect(result.limit).toBeNull();
    expect(createRequestOf(ok)).toMatchObject({
      choices: [{ name: { en: 'Cheese', id: '' }, limit: 4 }],
    });
    expect(createRequestOf(base)).not.toHaveProperty('choices');
  });

  it('sends the saved ids back, and nothing when the choices did not change', () => {
    const dish = DATA.dishes[0];
    if (!dish) throw new Error('no dish');
    const draft = draftOfDish(dish);
    const request = updateDishRequestOf(draft);
    expect(request?.choices).toEqual([
      { id: 'c1', name: text('Cheese'), limit: 10 },
      { id: 'c2', name: text('Sweet'), limit: null },
    ]);
    expect(changedOnly(request ?? {}, updateDishRequestOf(draft))).toBeNull();
    const removed = updateDishRequestOf({ ...draft, choices: (draft.choices ?? []).slice(0, 1) });
    expect(changedOnly(removed ?? {}, request)?.choices).toHaveLength(1);
  });
});

describe('edit session with choices', () => {
  it('keeps a saved dish with its choices and brings the choices of a ticked dish', () => {
    const saved = applySession(DATA, { ...EMPTY_SESSION, dishIds: ['d0', 'd1'] });
    expect(saved.view.dishes.map((d) => d.id)).toEqual(['i0', 'i1', 'i2', 'i3']);
    const library = [
      ...DATA.dishes,
      {
        id: 'd9',
        name: text('Chips'),
        description: text(''),
        size: text(''),
        priceCents: 500,
        limit: 20,
        choices: [{ id: 'c9', name: text('Salt'), limit: null }],
      },
    ] as MenuData['dishes'];
    const added = applySession({ ...DATA, dishes: library }, { ...EMPTY_SESSION, dishIds: ['d9'] });
    expect(added.view.dishes).toHaveLength(2);
    expect(added.view.dishes[1]).toMatchObject({ id: 'c9', groupId: 'd9', priceCents: 500 });
    expect(added.view.dishes[1]?.limit).toBeUndefined();
  });
});
