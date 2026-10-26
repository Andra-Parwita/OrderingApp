import type { MenuView } from '../../../../shared/menusContract';
import { worries, type Worry } from '../worry';

// Plan 124: what the Menu card on the phone's Orders screen shows, decided by the menu alone.

/**
 * OPEN QUESTION for the owner (plan 124): after the order cut-off, does the card still offer Share on
 * WhatsApp? Flip this one constant to change it. A finished menu never offers it.
 */
export const SHARE_AFTER_CUTOFF = false;

/**
 * The tablet's readiness (`worries`, D-062) never blocks publishing there. On the phone only what
 * makes a menu unusable keeps it from being published here; the rest (picture, $0 dishes, chefs,
 * delivery note) stays a tablet matter.
 */
const MISSING: ReadonlyArray<Worry['id']> = [
  'noDishes',
  'noPlace',
  'dayPast',
  'cutoffPast',
  'cutoffAfterDay',
];

export type CardState =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'ready' }>
  | Readonly<{ kind: 'notReady'; missing: ReadonlyArray<Worry['id']> }>
  | Readonly<{ kind: 'live' }>
  | Readonly<{ kind: 'closed'; finished: boolean }>;

export function cardStateOf(view: MenuView | null, now: Date): CardState {
  if (!view) return { kind: 'none' };
  const { menu } = view;
  if (menu.state === 'finished') {
    // A menu deleted before it was ever published is "no menu", not a finished one.
    return view.dishes.length === 0 && !menu.publishedAt
      ? { kind: 'none' }
      : { kind: 'closed', finished: true };
  }
  if (menu.state === 'live') {
    return Date.parse(menu.cutoffAt) > now.getTime()
      ? { kind: 'live' }
      : { kind: 'closed', finished: false };
  }
  // Not published: a brand-new menu nobody has touched is "no menu" (the empty state shows).
  if (menu.wizardStep === 0 && view.dishes.length === 0) return { kind: 'none' };
  const missing = worries(view, now)
    .map((worry) => worry.id)
    .filter((id) => MISSING.includes(id));
  return missing.length > 0 ? { kind: 'notReady', missing } : { kind: 'ready' };
}

/** Buttons under the status: Share and Notice while live; Share alone after the cut-off if allowed. */
export function showsButtons(state: CardState): boolean {
  return (
    state.kind === 'live' || (state.kind === 'closed' && !state.finished && SHARE_AFTER_CUTOFF)
  );
}
