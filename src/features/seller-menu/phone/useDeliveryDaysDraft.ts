import { useEffect, useState } from 'react';
import { deliveryPlan } from '../../../../shared/deliveryDays';
import type { MenuView, UpdateMenuRequest } from '../../../../shared/menusContract';
import { currentSellerSlug } from '../../../api/device/sellerContext';
import { updateCurrentMenu } from '../../../api/menus';
import type { DaysChange } from '../DeliveryDaysField';
import { buildDelivery, lastOpenDay } from '../deliveryDaysModel';

// Plan 127: the phone menu's delivery days, the default day and "Keep the menu open 1 more day" are
// held here until Save (nothing is sent on a tap). Save sends the same request the tablet's Details
// step sends (PUT menus/current: delivery with days + defaultDay, finishExtraDay).

const SAVED_MS = 3000;

const sameDays = (a: ReadonlyArray<string>, b: ReadonlyArray<string>) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

export type DaysDraft = Readonly<{
  days: ReadonlyArray<string>;
  defaultDay: string;
  keepOpen: boolean;
  /** Something differs from the saved menu. */
  dirty: boolean;
  busy: boolean;
  failed: boolean;
  saved: boolean;
  /** The day the menu finishes after, with the draft's days and keep-open applied. */
  lastDay: string;
  setDays: (next: DaysChange) => void;
  setKeepOpen: (on: boolean) => void;
  save: () => Promise<void>;
  discard: () => void;
}>;

export function useDeliveryDaysDraft(view: MenuView, reload: () => void): DaysDraft {
  const { menu } = view;
  const plan = deliveryPlan(menu.cookingDate, menu.delivery);
  const [change, setChange] = useState<DaysChange | null>(null);
  const [keep, setKeep] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sent, setSent] = useState(false);

  const days = change?.days ?? plan.days;
  const defaultDay = change?.defaultDay ?? plan.defaultDay;
  const keepOpen = keep ?? menu.finishExtraDay === true;
  const daysDirty =
    change !== null && !(sameDays(days, plan.days) && defaultDay === plan.defaultDay);
  const keepDirty = keepOpen !== (menu.finishExtraDay === true);
  // Right after a save the old menu is still shown until it reloads: no bar for that moment.
  const dirty = !sent && (daysDirty || keepDirty);

  const edited = () => {
    setSent(false);
    setSaved(false);
    setFailed(false);
  };
  const setDays = (next: DaysChange) => {
    edited();
    setChange(next);
  };
  const setKeepOpen = (on: boolean) => {
    edited();
    setKeep(on);
  };
  const discard = () => {
    setChange(null);
    setKeep(null);
    setFailed(false);
  };

  useEffect(() => {
    if (!saved) return undefined;
    const timer = setTimeout(() => setSaved(false), SAVED_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  const save = async () => {
    setBusy(true);
    setFailed(false);
    const body: UpdateMenuRequest = {
      ...(daysDirty
        ? {
            delivery: buildDelivery(menu, menu.delivery.note, menu.delivery.available, {
              days: [...days].sort(),
              defaultDay,
            }),
          }
        : {}),
      ...(keepDirty ? { finishExtraDay: keepOpen } : {}),
    };
    const result = await updateCurrentMenu(body, undefined, currentSellerSlug());
    setBusy(false);
    if (!result.ok) {
      setFailed(true);
      return;
    }
    setSent(true);
    setSaved(true);
    reload();
  };

  const lastDay = lastOpenDay({
    cookingDate: menu.cookingDate,
    delivery: { ...menu.delivery, days: [...days], defaultDay },
    finishExtraDay: keepOpen,
  });

  return {
    days,
    defaultDay,
    keepOpen,
    dirty,
    busy,
    failed,
    saved,
    lastDay,
    setDays,
    setKeepOpen,
    save,
    discard,
  };
}
