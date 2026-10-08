import { createSelector } from '@reduxjs/toolkit';
import {
  cookGroups,
  cookNotes,
  cookStats,
  countedOrders,
  type CountMode,
  type GroupBy,
} from './cookModel';
import type { CookRootState } from './cookSlice';

export const selectCookList = (state: CookRootState) => state.sellerCook.list;
export const selectCookOrders = (state: CookRootState) => state.sellerCook.orders;
export const selectCookMenu = (state: CookRootState) => state.sellerCook.menu;

const modeArg = (_state: CookRootState, mode: CountMode) => mode;
const groupArg = (_state: CookRootState, _mode: CountMode, groupBy: GroupBy) => groupBy;

export const selectCounted = createSelector([selectCookOrders, modeArg], countedOrders);
export const selectCookStats = createSelector([selectCounted], cookStats);
export const selectCookNotes = createSelector([selectCounted], cookNotes);
export const selectCookGroups = createSelector(
  [selectCounted, selectCookMenu, groupArg],
  cookGroups,
);
