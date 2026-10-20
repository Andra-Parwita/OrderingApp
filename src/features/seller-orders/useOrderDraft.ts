import { useEffect, useState } from 'react';
import type { Language } from '../../../shared/domain';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { draftKey, useDraft, type DraftControls } from '../../components/draft';

export type YesNo = 'yes' | 'no';

/** Plan 061 stage 7: everything typed in New order, shared by the tablet panel and the phone screen. */
export type OrderDraft = {
  firstName: string;
  customerLang: Language;
  how: string;
  qtys: Readonly<Record<string, number>>;
  /** Plan 111: a note per dish, by menu item id. */
  lineNotes?: Readonly<Record<string, string>>;
  note: string;
  confirmNow: YesNo;
  paid: YesNo;
  /** Device only (D-059): kept on this phone like any draft, cleared on Submit / Cancel / 7 days. */
  phone: string;
  address: string;
};

export const EMPTY_ORDER: OrderDraft = {
  firstName: '',
  customerLang: 'id',
  how: 'pickup',
  qtys: {},
  note: '',
  confirmNow: 'yes',
  paid: 'no',
  phone: '',
  address: '',
};

export type OrderForm = Readonly<{
  values: OrderDraft;
  set: <K extends keyof OrderDraft>(field: K, value: OrderDraft[K]) => void;
  setQty: (itemId: string, qty: number) => void;
  setLineNote: (itemId: string, note: string) => void;
  draft: DraftControls;
  /** Dishes of the draft that are no longer on the menu were removed. */
  dropped: boolean;
  /** Anything typed (a draft is worth keeping). */
  dirty: boolean;
}>;

/**
 * One draft per kitchen. `knownIds` is the list of dishes on the live menu (null while it loads):
 * dishes in a restored draft that are not on it are dropped, with a notice.
 */
export function useOrderDraft(knownIds: ReadonlyArray<string> | null): OrderForm {
  const [values, setValues, draft] = useDraft<OrderDraft>(
    draftKey(currentSellerSlug(), 'new-order', 'current'),
    EMPTY_ORDER,
  );
  const [dropped, setDropped] = useState(false);
  useEffect(() => {
    if (knownIds === null) return;
    const stale = Object.keys(values.qtys).filter((id) => !knownIds.includes(id));
    if (stale.length === 0) return;
    // A restored draft meets the live menu: an effect is the place to react to it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDropped(true);
    setValues((previous) => ({
      ...previous,
      qtys: Object.fromEntries(
        Object.entries(previous.qtys).filter(([id]) => knownIds.includes(id)),
      ),
    }));
  }, [knownIds, values.qtys, setValues]);
  const set: OrderForm['set'] = (field, value) =>
    setValues((previous) => ({ ...previous, [field]: value }));
  const setQty = (itemId: string, qty: number) =>
    setValues((previous) => ({ ...previous, qtys: { ...previous.qtys, [itemId]: qty } }));
  const setLineNote = (itemId: string, lineNote: string) =>
    setValues((previous) => ({
      ...previous,
      lineNotes: { ...previous.lineNotes, [itemId]: lineNote },
    }));
  const dirty = JSON.stringify(values) !== JSON.stringify(EMPTY_ORDER);
  return { values, set, setQty, setLineNote, draft, dropped, dirty };
}
