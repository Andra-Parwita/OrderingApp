import { localDate } from '../../../shared/dates';
import type { MenuView } from '../../../shared/menusContract';
import { splitInstant } from './instant';

/** "Worth a look" (D-062): things to check before publishing. None of them ever stops publishing. */
export type Worry = {
  id:
    | 'noDishes'
    | 'noPicture'
    | 'freeDish'
    | 'noChef'
    | 'noPlace'
    | 'dayPast'
    | 'cutoffPast'
    | 'cutoffAfterDay'
    | 'deliveryNote';
  /** Which step fixes it: 0 Dishes, 1 Details, 2 this step's own table. */
  fix: 'dishes' | 'details' | 'prices';
  count?: number;
};

export function worries(view: MenuView, now: Date): Array<Worry> {
  const { menu, dishes, pickupPoints } = view;
  const out: Array<Worry> = [];
  if (dishes.length === 0) out.push({ id: 'noDishes', fix: 'dishes' });
  if (menu.pictureRef === undefined) out.push({ id: 'noPicture', fix: 'details' });
  const free = dishes.filter((dish) => dish.priceCents === 0).length;
  if (free > 0) out.push({ id: 'freeDish', fix: 'prices', count: free });
  const unassigned = dishes.filter((dish) => dish.chefId === undefined).length;
  if (unassigned > 0) out.push({ id: 'noChef', fix: 'prices', count: unassigned });
  if (pickupPoints.length === 0 && !menu.delivery.available) {
    out.push({ id: 'noPlace', fix: 'details' });
  }
  if (
    menu.delivery.available &&
    menu.delivery.note.en.trim() === '' &&
    menu.delivery.note.id.trim() === ''
  ) {
    out.push({ id: 'deliveryNote', fix: 'details' });
  }
  if (menu.cookingDate < localDate(now)) out.push({ id: 'dayPast', fix: 'details' });
  if (Date.parse(menu.cutoffAt) <= now.getTime()) out.push({ id: 'cutoffPast', fix: 'details' });
  if (splitInstant(menu.cutoffAt).date > menu.cookingDate) {
    out.push({ id: 'cutoffAfterDay', fix: 'details' });
  }
  return out;
}
