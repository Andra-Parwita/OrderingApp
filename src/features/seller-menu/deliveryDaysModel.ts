import { addDays } from '../../../shared/dates';
import { deliveryPlan, keepInRange } from '../../../shared/deliveryDays';
import type { LocalText } from '../../../shared/domain';
import type { Menu } from '../../../shared/menusContract';
import type { DaysChange } from './DeliveryDaysField';

// Plan 126: the pure parts of the Details step's delivery days (what to send, when the menu finishes).

type DeliveryRequest = NonNullable<
  import('../../../shared/menusContract').UpdateMenuRequest['delivery']
>;

/**
 * The delivery request: it always carries the delivery days, so a note or switch change keeps them.
 * Back to just the cooking day sends an empty list (once, to clear what was stored).
 */
export function buildDelivery(
  menu: Pick<Menu, 'cookingDate' | 'delivery'>,
  note: LocalText,
  available: boolean,
  next?: DaysChange,
): DeliveryRequest {
  const plan = deliveryPlan(menu.cookingDate, menu.delivery);
  const target = next ?? { days: plan.days, defaultDay: plan.defaultDay };
  const custom = !(
    target.days.length === 1 &&
    target.days[0] === menu.cookingDate &&
    target.defaultDay === menu.cookingDate
  );
  return {
    available,
    note,
    ...(available && (custom || plan.custom)
      ? {
          days: custom ? target.days : [],
          ...(custom && target.defaultDay !== menu.cookingDate
            ? { defaultDay: target.defaultDay }
            : {}),
        }
      : {}),
  };
}

/** A new cooking day drops the days that fall out of range with it: the delivery request to send, if any. */
export function deliveryForMovedDay(
  menu: Pick<Menu, 'cookingDate' | 'delivery'>,
  note: LocalText,
  nextCookingDate: string,
): DeliveryRequest | undefined {
  const stored = menu.delivery.days ?? [];
  const kept = keepInRange(nextCookingDate, stored, menu.delivery.defaultDay);
  const plan = deliveryPlan(menu.cookingDate, menu.delivery);
  if (!plan.custom || JSON.stringify(kept.days) === JSON.stringify(stored)) return undefined;
  return buildDelivery(
    menu,
    note,
    menu.delivery.available,
    kept.days.length > 0
      ? { days: kept.days, defaultDay: kept.defaultDay ?? nextCookingDate }
      : { days: [nextCookingDate], defaultDay: nextCookingDate },
  );
}

/**
 * The last day the menu stays open: the latest of the cooking day and the delivery days, one more with
 * "Keep the menu open 1 more day". It finishes by itself at midnight after it.
 */
export function lastOpenDay(
  menu: Pick<Menu, 'cookingDate' | 'delivery' | 'finishExtraDay'>,
): string {
  const days = menu.delivery.available ? deliveryPlan(menu.cookingDate, menu.delivery).days : [];
  const last = [menu.cookingDate, ...days].sort().at(-1) ?? menu.cookingDate;
  return menu.finishExtraDay === true ? addDays(last, 1) : last;
}
