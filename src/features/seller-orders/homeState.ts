import type { Order } from '../../../shared/domain';
import type { MenuView } from '../../../shared/menusContract';
import type { PastWeekSummary } from '../../../shared/pastWeeks';

/** What Orders (the home screen) shows, decided by the menu's state (handoff, Home). */
export type HomeKind = 'first_run' | 'not_published' | 'live' | 'finished';

/**
 * - `live`: the menu is live (the orders list and detail).
 * - `finished`: the cooking day is over: a "Just finished" summary and Earlier menus.
 * - `first_run`: a brand-new kitchen. The server always holds one menu, so "no menu yet" is a menu
 *   that is not published, never edited (wizard step 0, no dishes) with no earlier menu and no order.
 * - `not_published`: a menu is being made.
 * `past` is null until the earlier menus have loaded (a first run cannot be told before that).
 */
export function homeKindOf(
  view: MenuView,
  past: ReadonlyArray<PastWeekSummary> | null,
  orders: ReadonlyArray<Order>,
): HomeKind | 'checking' {
  const { state, wizardStep } = view.menu;
  if (state === 'live') return 'live';
  // A menu the seller deleted without publishing counts as finished on the server but has no dishes
  // and was never published: it is "no menu yet", not a "Just finished" summary.
  const deleted = state === 'finished' && view.dishes.length === 0 && !view.menu.publishedAt;
  if (state === 'finished' && !deleted) return 'finished';
  if (deleted) {
    if (past === null) return 'checking';
    return past.length === 0 ? 'first_run' : 'not_published';
  }
  const untouched = wizardStep === 0 && view.dishes.length === 0 && orders.length === 0;
  if (!untouched) return 'not_published';
  if (past === null) return 'checking';
  return past.length === 0 ? 'first_run' : 'not_published';
}
