import { localDate, menuFinishesAt } from '../../../shared/dates';
import { viewedKitchenZone } from '../../../shared/zone';
import type { Menu, MenuView } from '../../../shared/menusContract';

// Which Home the seller sees: the first match of the rules in plan 039 (CHANGES §1), plus the
// owner's rulings 3 (paused, closed) of 2026-10-11. Pure, so it is tested without rendering.

export type LiveStage = 'taking' | 'paused' | 'closed' | 'cookingDay';
export type HomeState = 'noMenu' | 'draft' | 'quiet' | LiveStage;

const DAY_MS = 86_400_000;

/**
 * A live menu: on (or past) the cooking date it is the cooking day; after the cut-off and before
 * that date, orders are closed; before the cut-off with Taking orders switched off, orders are
 * paused; else orders are being taken.
 */
export function liveStage(
  menu: Pick<Menu, 'cookingDate' | 'cutoffAt' | 'takingOrders'>,
  now: Date,
): LiveStage {
  if (localDate(now, viewedKitchenZone()) >= menu.cookingDate) return 'cookingDay';
  if (now.getTime() >= Date.parse(menu.cutoffAt)) return 'closed';
  return menu.takingOrders ? 'taking' : 'paused';
}

export type HomeStateInput = Readonly<{
  view: MenuView;
  /** How many finished menus the kitchen has kept. */
  pastCount: number;
  /** The first menu was started from Home this visit (a new kitchen's menu stays "untouched" on the server). */
  started?: boolean;
  now: Date;
}>;

/**
 * 1 never had a menu; 2 a menu that is not published; 3 and 4 a live menu; 5 and 6 no live or
 * unpublished menu. A new kitchen holds one empty menu that was never edited: that is still
 * "never had a menu" until the seller starts one.
 */
export function homeStateOf({ view, pastCount, started = false, now }: HomeStateInput): HomeState {
  const { menu, dishes } = view;
  if (menu.state === 'live') return liveStage(menu, now);
  const neverHad = pastCount === 0 && !started;
  if (menu.state === 'not_published') {
    const untouched = menu.wizardStep === 0 && dishes.length === 0;
    return untouched && neverHad ? 'noMenu' : 'draft';
  }
  // Finished. A menu deleted before it was published is "no menu", not a summary to show.
  const deleted = dishes.length === 0 && !menu.publishedAt;
  return deleted && neverHad ? 'noMenu' : 'quiet';
}

/** How long ago the last menu finished, in days (fractions allowed). */
export function daysSince(finishedAt: string, now: Date): number {
  return Math.max(0, (now.getTime() - Date.parse(finishedAt)) / DAY_MS);
}

/** The last-menu bar: full on the day it finished, empty after 14 days. */
export function freshness(finishedAt: string, now: Date): number {
  return Math.max(0, 1 - daysSince(finishedAt, now) / 14);
}

/** Within 2 days the highlight uses the accent; older, the muted look. */
export function isRecent(finishedAt: string, now: Date): boolean {
  return daysSince(finishedAt, now) <= 2;
}

export type Ago =
  | Readonly<{ kind: 'today' }>
  | Readonly<{ kind: 'yesterday' }>
  | Readonly<{ kind: 'days'; count: number }>
  | Readonly<{ kind: 'weeks'; count: number }>;

/** "today", "yesterday", "3 days ago", "2 weeks ago". */
export function agoOf(finishedAt: string, now: Date): Ago {
  const days = daysSince(finishedAt, now);
  if (days < 1) return { kind: 'today' };
  if (days < 2) return { kind: 'yesterday' };
  if (days < 14) return { kind: 'days', count: Math.floor(days) };
  return { kind: 'weeks', count: Math.round(days / 7) };
}

/** When the menu finished: the stored time, else the end of its cooking day (older menus have none). */
export function finishedAtOf(menu: Pick<Menu, 'finishedAt' | 'cookingDate'>): string {
  return menu.finishedAt ?? menuFinishesAt(menu.cookingDate, viewedKitchenZone());
}
