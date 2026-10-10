import { createAction } from '@reduxjs/toolkit';

// Dev only: add sample orders / reset the mock store, then reload the list. Kept out of the
// slice and marked pure so a production build drops the action names with their only users.
export const devSampleOrdersRequested = /* @__PURE__ */ createAction(
  'sellerOrders/devSampleOrdersRequested',
);
export const devResetRequested = /* @__PURE__ */ createAction('sellerOrders/devResetRequested');
