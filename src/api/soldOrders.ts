// Plan 103: the menu screens show sold counts from the orders the Orders feature already holds.
// Features may not import each other, so the one action ("read the orders once, quietly") and the
// shape of the slice that the menu reads live here, and each side imports this file.
import { createAction } from '@reduxjs/toolkit';
import type { SellerOrder } from '../../shared/domain';

export const soldRequested = createAction('sellerOrders/soldRequested');

export type SoldOrdersState = { sellerOrders?: { orders: ReadonlyArray<SellerOrder> } };
