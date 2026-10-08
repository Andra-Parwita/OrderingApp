import type { CustomerOrdersRootState } from './slice';

export const selectList = (state: CustomerOrdersRootState) => state.customerOrders.list;
export const selectOrderPage = (state: CustomerOrdersRootState) => state.customerOrders.order;
export const selectMenus = (state: CustomerOrdersRootState) => state.customerOrders.menus;
export const selectCancel = (state: CustomerOrdersRootState) => state.customerOrders.cancel;
