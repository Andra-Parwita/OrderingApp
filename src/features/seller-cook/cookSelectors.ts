import { createSelector } from '@reduxjs/toolkit';
import {
  ALL_CHEFS,
  cookGroups,
  cookNotes,
  cookStats,
  countedOrders,
  filterByChef,
  isOwnItem,
  type ChefFilter,
  type CountMode,
  type GroupBy,
} from './cookModel';
import { bagsOf } from './packModel';
import type { CookRootState } from './cookSlice';

export const selectCookList = (state: CookRootState) => state.sellerCook.list;
const selectMenuOrders = (state: CookRootState) => state.sellerCook.orders;
const selectPrivateOrders = (state: CookRootState) => state.sellerCook.privateOrders;
/** Plan 081: the menu's orders and today's private ones, counted together on the event day. */
export const selectCookOrders = createSelector(
  [selectMenuOrders, selectPrivateOrders],
  (menuOrders, privateOrders) =>
    privateOrders.length === 0 ? menuOrders : [...menuOrders, ...privateOrders],
);
export const selectCookMenu = (state: CookRootState) => state.sellerCook.menu;

const modeArg = (_state: CookRootState, mode: CountMode) => mode;
const groupArg = (_state: CookRootState, _mode: CountMode, groupBy: GroupBy) => groupBy;
const notesChefArg = (_state: CookRootState, _mode: CountMode, chef: ChefFilter = ALL_CHEFS) =>
  chef;
const groupChefArg = (
  _state: CookRootState,
  _mode: CountMode,
  _groupBy: GroupBy,
  chef: ChefFilter = ALL_CHEFS,
) => chef;
const bagChefArg = (_state: CookRootState, chef: ChefFilter = ALL_CHEFS) => chef;

export const selectCounted = createSelector([selectCookOrders, modeArg], countedOrders);
export const selectCookStats = createSelector([selectCounted], cookStats);
export const selectCookNotes = createSelector(
  [selectCounted, selectCookMenu, notesChefArg],
  (counted, menu, chef) => cookNotes(filterByChef(counted, menu, chef)),
);
/** The Pack tab's bags: every order that is not cancelled (and has the chef's dishes). */
export const selectBags = createSelector(
  [selectCookOrders, selectCookMenu, bagChefArg],
  (orders, menu, chef) => bagsOf(orders, menu?.pickupPoints, (line) => isOwnItem(menu, chef, line)),
);
export const selectCookGroups = createSelector(
  [selectCounted, selectCookMenu, groupArg, groupChefArg],
  (counted, menu, groupBy, chef) => cookGroups(filterByChef(counted, menu, chef), menu, groupBy),
);
