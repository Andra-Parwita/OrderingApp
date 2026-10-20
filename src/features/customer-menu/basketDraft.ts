import { put, select, takeEvery } from 'redux-saga/effects';
import type { LocalText } from '../../../shared/domain';
import { clearDraft, draftKey, readDraft, writeDraft } from '../../components/draft';
import {
  basketRestored,
  checkoutSet,
  menuLoaded,
  placeSucceeded,
  noteSet,
  quantitySet,
  type CheckoutState,
  type CustomerRootState,
} from './customerSlice';

// Plan 061 stage 9: the basket and the checkout fields survive a reload, per kitchen and menu
// (the menu is told apart by its cooking date). A Redux listener, not a hook: both the basket and
// the checkout pages write through the same two actions. Written at once (a few bytes per tap), so
// there is no timer to lose when the tab is killed. Device only; cleared once an order is placed.

/** What is stored: the quantities, the dish names (to say what was dropped) and the checkout fields. */
export type BasketDraft = Readonly<{
  basket: Readonly<Record<string, number>>;
  names: Readonly<Record<string, LocalText>>;
  /** Plan 111: the line notes (absent in drafts saved before). */
  notes?: Readonly<Record<string, string>>;
  checkout: CheckoutState;
}>;

/** The key of the menu on screen, or null when there is none (or an order is being edited). */
export function basketKeyOf(state: CustomerRootState): string | null {
  const { slug, menu, edit } = state.customer;
  if (slug === null || menu.status !== 'ready' || edit.status !== 'idle') return null;
  return draftKey(slug, 'basket', menu.data.week.cookingDate);
}

export function basketDraftOf(state: CustomerRootState): BasketDraft | null {
  const { menu, basket, basketNotes, checkout } = state.customer;
  if (menu.status !== 'ready') return null;
  const names: Record<string, LocalText> = {};
  for (const item of menu.data.items) if (basket[item.id]) names[item.id] = item.name;
  const typed = checkout.note !== null && checkout.note !== '';
  const empty =
    Object.keys(basket).length === 0 &&
    !typed &&
    checkout.firstName === '' &&
    checkout.fulfilment === null &&
    checkout.pickupPlaceId === null;
  if (empty) return null;
  return Object.keys(basketNotes).length > 0
    ? { basket, names, notes: basketNotes, checkout }
    : { basket, names, checkout };
}

function* save() {
  const state = (yield select()) as CustomerRootState;
  const key = basketKeyOf(state);
  if (key === null) return;
  const draft = basketDraftOf(state);
  if (draft) writeDraft(key, draft, '');
  else clearDraft(key);
}

function* restore(restoredFor: Set<string>) {
  const state = (yield select()) as CustomerRootState;
  const key = basketKeyOf(state);
  if (key === null || restoredFor.has(key)) return;
  restoredFor.add(key);
  if (Object.keys(state.customer.basket).length > 0) return;
  const found = readDraft<BasketDraft>(key);
  if (found) yield put(basketRestored(found.value));
}

function* clearAfterOrder() {
  const state = (yield select()) as CustomerRootState;
  const { slug, menu } = state.customer;
  if (slug !== null && menu.status === 'ready') {
    clearDraft(draftKey(slug, 'basket', menu.data.week.cookingDate));
  }
}

export function* basketDraftSaga() {
  // Once per kitchen and menu in this store: a basket emptied on purpose is not brought back.
  const restoredFor = new Set<string>();
  yield takeEvery([quantitySet.type, noteSet.type, checkoutSet.type], save);
  yield takeEvery(menuLoaded.type, restore, restoredFor);
  yield takeEvery(placeSucceeded.type, clearAfterOrder);
}
