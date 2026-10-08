import type { CustomerOrdersRootState } from './slice';

export const selectList = (state: CustomerOrdersRootState) => state.customerOrders.list;
export const selectOrderPage = (state: CustomerOrdersRootState) => state.customerOrders.order;
export const selectMenu = (state: CustomerOrdersRootState) => state.customerOrders.menu;
export const selectCancel = (state: CustomerOrdersRootState) => state.customerOrders.cancel;
