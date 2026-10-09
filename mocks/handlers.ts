import { http, HttpResponse } from 'msw';
import type { HealthResponse } from '../shared/health';
import { handleMockRequest } from '../worker/mock/routes';
import { DEFAULT_SELLER_SLUG } from '../shared/seller';
import { createStore, type MockStore, type SellerStore } from '../worker/mock/store';

/** The dev admin setup key, for tests. */
export { DEV_ADMIN_SETUP_KEY } from '../worker/mock/auth';

export const healthFixture: HealthResponse = { status: 'ok', time: '2026-10-07T10:00:00.000Z' };

/** A fixed clock: Wed 7 Oct 2026, before the cut-off. */
export const MOCK_NOW = new Date('2026-10-07T10:00:00.000Z');

/** MSW handlers for the mock API, backed by the same store and routes as the dev Worker. */
export function createApiHandlers(store: MockStore) {
  return [
    // A resolver that returns nothing falls through, so unknown /api paths still error.
    http.all('*/api/*', ({ request }) =>
      handleMockRequest(store, request.clone()).then((response) => response ?? undefined),
    ),
  ];
}

/** Every sample seller; reset() resets all of them in place. */
export const mockStores = createStore({ now: () => MOCK_NOW });

/** The default seller's store (Onde Onde), for tests that need one seller only. */
export const mockStore: SellerStore = mockStores.seller(DEFAULT_SELLER_SLUG) as SellerStore;

export const handlers = [
  http.get('*/api/health', () => HttpResponse.json(healthFixture)),
  ...createApiHandlers(mockStores),
];
