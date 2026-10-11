import type { Order } from '../../../shared/domain';
import type { DishSet, MenuDefaults, MenuView } from '../../../shared/menusContract';
import type { PastWeekSummary } from '../../../shared/pastWeeks';

// What Home reads and what it can ask for. A feature may not import another feature, so the app
// (src/app/SellerHomeRoute.tsx) fills these from the menu feature's store and wires the actions.

export type HomeData = Readonly<{
  view: MenuView;
  /** Finished menus, newest first. */
  past: ReadonlyArray<PastWeekSummary>;
  sets: ReadonlyArray<DishSet>;
  /** Settings · Menu defaults: when orders close, and delivery. */
  defaults: MenuDefaults;
  /** The live menu's orders (states 3 and 4); absent until they have loaded. */
  orders?: ReadonlyArray<Order>;
}>;

/** Where a new menu's dishes come from. */
export type StartSource =
  | Readonly<{ kind: 'empty' }>
  | Readonly<{ kind: 'past'; weekId: string }>
  | Readonly<{ kind: 'set'; setId: string }>;

export type NewMenuInput = Readonly<{
  /** Local date, YYYY-MM-DD. */
  cookingDate: string;
  /** ISO instant with the cook's offset. */
  cutoffAt: string;
  source: StartSource;
}>;

/** The screens "Go to …" buttons lead to. */
export type GoTarget = 'orders' | 'kitchen' | 'handover' | 'menu' | 'settings';
