import { describe, expect, it } from 'vitest';
import * as contract from '../../api/kitchenOrders';
import * as slice from './sellerOrdersSlice';

// Plan 098 C5: Cook speaks to the Orders slice through api/kitchenOrders.ts by action type.
describe('kitchen orders contract', () => {
  it('uses the Orders slice action types', () => {
    expect(contract.ordersPollingStarted.type).toBe(slice.pollingStarted.type);
    expect(contract.ordersPollingStopped.type).toBe(slice.pollingStopped.type);
    expect(contract.ordersRefreshRequested.type).toBe(slice.refreshRequested.type);
    expect(contract.ordersLoaded.type).toBe(slice.ordersLoaded.type);
    expect(contract.currentMenuLoaded.type).toBe(slice.currentLoaded.type);
    expect(contract.orderPatched.type).toBe(slice.orderPatched.type);
  });
});
