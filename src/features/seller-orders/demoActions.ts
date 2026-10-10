import { createAction } from '@reduxjs/toolkit';

// Plan 013: the demo kitchen's buttons (unlike devActions, these ship in production).
export const demoSamplesRequested = createAction('sellerOrders/demoSamplesRequested');
export const demoSamplesClearRequested = createAction('sellerOrders/demoSamplesClearRequested');
