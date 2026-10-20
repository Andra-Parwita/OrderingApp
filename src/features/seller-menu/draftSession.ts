import type { Dish, MenuDishView, UpdateMenuRequest } from '../../../shared/menusContract';
import type { UpdateItemRequest } from '../../../shared/setupContract';
import { clearDraft, readDraft, writeDraft } from '../../components/draft';
import type { MenuData } from './menuSlice';

// Plan 103 fix 8: an edit session keeps the seller's changes on this device until Save. This file is
// the plain store (no React) and the two pure functions that read it: what changed against the
// saved menu, and the menu as it would look with the changes in. Nothing here talks to the server.

/** The menu-level fields a session can hold (the dish list is `dishIds`). */
export type MenuPatch = Pick<
  UpdateMenuRequest,
  'cookingDate' | 'cutoffAt' | 'delivery' | 'takingOrders' | 'places'
>;
/** A change to one dish on the menu; `alsoDishId` keeps the library dish in step (name, size ...). */
export type ItemEdit = { request: Omit<UpdateItemRequest, 'soldOut'>; alsoDishId?: string };

export type SessionState = {
  /** The dishes on the menu, in order; null = the saved list is unchanged. */
  dishIds: Array<string> | null;
  menu: MenuPatch;
  /** By menu item id (a dish just ticked has no item yet: its library id stands in). */
  items: Record<string, ItemEdit>;
};

export const EMPTY_SESSION: SessionState = { dishIds: null, menu: {}, items: {} };

export class DraftSession {
  private state: SessionState;
  private readonly listeners = new Set<() => void>();
  private nextCreatedWanted = false;

  /** `persistKey`: the draft wizard keeps its state in localStorage to resume on this device. */
  constructor(private readonly persistKey?: string) {
    const found = persistKey ? readDraft<SessionState>(persistKey) : null;
    this.state = found ? { ...EMPTY_SESSION, ...found.value } : EMPTY_SESSION;
  }

  /** The next created dish goes on the menu too (the editor's "add to this menu" box). */
  wantNextCreated(): void {
    this.nextCreatedWanted = true;
  }

  /** Whether the dish just created was to go on the menu; asked once per answer. */
  takeNextCreated(): boolean {
    const wanted = this.nextCreatedWanted;
    this.nextCreatedWanted = false;
    return wanted;
  }

  getState = (): SessionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  /** A change to the menu itself; `dishIds` replaces the dish list. */
  patchMenu(request: UpdateMenuRequest): void {
    const { dishIds, wizardStep, ...rest } = request;
    void wizardStep;
    this.set({
      ...this.state,
      dishIds: dishIds ?? this.state.dishIds,
      menu: { ...this.state.menu, ...rest },
    });
  }

  patchItem(id: string, request: ItemEdit['request'], alsoDishId?: string): void {
    const previous = this.state.items[id];
    const also = alsoDishId ?? previous?.alsoDishId;
    this.set({
      ...this.state,
      items: {
        ...this.state.items,
        [id]: {
          request: { ...previous?.request, ...request },
          ...(also ? { alsoDishId: also } : {}),
        },
      },
    });
  }

  /** The seller dropped everything, or it was all saved. */
  reset(): void {
    this.set(EMPTY_SESSION);
  }

  replace(next: SessionState): void {
    this.set(next);
  }

  private set(next: SessionState): void {
    this.state = next;
    if (this.persistKey) {
      if (isEmpty(next)) clearDraft(this.persistKey);
      else writeDraft(this.persistKey, next, '');
    }
    this.listeners.forEach((listener) => listener());
  }
}

function isEmpty(state: SessionState): boolean {
  return (
    state.dishIds === null &&
    Object.keys(state.menu).length === 0 &&
    Object.keys(state.items).length === 0
  );
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const MENU_KEYS = ['cookingDate', 'cutoffAt', 'delivery', 'takingOrders', 'places'] as const;

/** What a menu field holds now (the patch's `places` is the menu's `placeUses`). */
function menuValue(menu: MenuData['view']['menu'], key: (typeof MENU_KEYS)[number]): unknown {
  return key === 'places' ? menu.placeUses : menu[key];
}

/** The item fields a request changes, compared with what the item holds (null = absent). */
function itemChanges(item: MenuDishView | undefined, request: ItemEdit['request']): Array<string> {
  if (!item) return Object.keys(request);
  const now: Record<string, unknown> = {
    name: item.name,
    description: item.description,
    size: item.size,
    priceCents: item.priceCents,
    limit: item.limit ?? null,
    chefId: item.chefId ?? null,
    preorder: item.preorder ?? true,
    dayStock: item.dayStock ?? null,
  };
  return Object.entries(request).flatMap(([key, value]) => (same(now[key], value) ? [] : [key]));
}

/** A library dish that is ticked but not on the saved menu yet, shaped like a menu row. */
function itemOfDish(dish: Dish): MenuDishView {
  return {
    id: dish.id,
    dishId: dish.id,
    name: dish.name,
    description: dish.description,
    size: dish.size,
    priceCents: dish.priceCents,
    remaining: dish.limit ?? null,
    soldOut: false,
    ...(dish.limit !== undefined ? { limit: dish.limit } : {}),
    ...(dish.chefId ? { chefId: dish.chefId } : {}),
    ...(dish.preorder !== undefined ? { preorder: dish.preorder } : {}),
    ...(dish.dayStock !== undefined ? { dayStock: dish.dayStock } : {}),
    ...(dish.pictureRef ? { pictureRef: dish.pictureRef } : {}),
  };
}

/** Plan 111: the choices a ticked dish brings, shaped like menu rows under it (same price). */
function choicesOfDish(dish: Dish): Array<MenuDishView> {
  const { limit: dishLimit, ...base } = itemOfDish(dish);
  void dishLimit;
  return (dish.choices ?? []).map((choice) => ({
    ...base,
    id: choice.id,
    dishId: choice.id,
    name: choice.name,
    remaining: choice.limit,
    groupId: dish.id,
    ...(choice.limit !== null ? { limit: choice.limit } : {}),
  }));
}

function withEdit(item: MenuDishView, request: ItemEdit['request']): MenuDishView {
  const next: MenuDishView = { ...item };
  if (request.name) next.name = request.name;
  if (request.description) next.description = request.description;
  if (request.size) next.size = request.size;
  if (request.priceCents !== undefined) next.priceCents = request.priceCents;
  if (request.limit !== undefined) {
    if (request.limit === null) delete next.limit;
    else next.limit = request.limit;
    next.remaining = request.limit;
  }
  if (request.chefId !== undefined) {
    if (request.chefId === null) delete next.chefId;
    else next.chefId = request.chefId;
  }
  if (request.preorder !== undefined) next.preorder = request.preorder;
  if (request.dayStock !== undefined) {
    if (request.dayStock === null) delete next.dayStock;
    else next.dayStock = request.dayStock;
  }
  return next;
}

export type SessionDiff = {
  /** Library ids newly on the menu. */
  added: Array<string>;
  /** Saved rows taken off. */
  removed: Array<MenuDishView>;
  /** Item id (or library id of an added dish) -> fields changed. */
  edited: Record<string, Array<string>>;
  menuKeys: Array<string>;
  total: number;
};

export function diffSession(data: MenuData, state: SessionState): SessionDiff {
  const saved = data.view.dishes;
  const savedIds = saved.flatMap((item) =>
    item.dishId && item.groupId === undefined ? [item.dishId] : [],
  );
  const nowIds = state.dishIds ?? savedIds;
  const added = nowIds.filter((id) => !savedIds.includes(id));
  const removed = saved.filter((item) => item.dishId && !nowIds.includes(item.dishId));
  const edited: Record<string, Array<string>> = {};
  for (const [id, edit] of Object.entries(state.items)) {
    const item = saved.find((candidate) => candidate.id === id);
    // An edit of a dish just added belongs to "Added"; one of a dish taken off is gone.
    if (!item) continue;
    if (item.dishId && !nowIds.includes(item.dishId)) continue;
    const fields = itemChanges(item, edit.request);
    if (fields.length > 0) edited[id] = fields;
  }
  const menuKeys = MENU_KEYS.filter(
    (key) =>
      state.menu[key] !== undefined && !same(state.menu[key], menuValue(data.view.menu, key)),
  );
  return {
    added,
    removed,
    edited,
    menuKeys,
    total: added.length + removed.length + Object.keys(edited).length + menuKeys.length,
  };
}

/** The menu as it would be with the session's changes in (what the screens show during a session). */
export function applySession(data: MenuData, state: SessionState): MenuData {
  if (isEmpty(state)) return data;
  const { menu } = data.view;
  const nextMenu = { ...menu };
  for (const key of MENU_KEYS) {
    const value = state.menu[key];
    if (value === undefined) continue;
    if (key === 'places') nextMenu.placeUses = state.menu.places ?? menu.placeUses;
    else Object.assign(nextMenu, { [key]: value });
  }
  let dishes = data.view.dishes;
  if (state.dishIds) {
    dishes = state.dishIds.flatMap((libraryId) => {
      const item = data.view.dishes.find(
        (candidate) => candidate.dishId === libraryId && candidate.groupId === undefined,
      );
      if (item) {
        return [item, ...data.view.dishes.filter((choice) => choice.groupId === item.id)];
      }
      const dish = data.dishes.find((candidate) => candidate.id === libraryId);
      return dish ? [itemOfDish(dish), ...choicesOfDish(dish)] : [];
    });
  }
  dishes = dishes.map((item) => {
    const edit = state.items[item.id];
    return edit ? withEdit(item, edit.request) : item;
  });
  return { ...data, view: { ...data.view, menu: nextMenu, dishes } };
}
