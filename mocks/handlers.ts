import { http, HttpResponse } from 'msw';
import type { HealthResponse } from '../shared/health';
import { handleMockRequest } from '../worker/mock/routes';
import { createStore, type MockStore } from '../worker/mock/store';

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

export const mockStore = createStore({ now: () => MOCK_NOW });

export const handlers = [
  http.get('*/api/health', () => HttpResponse.json(healthFixture)),
  ...createApiHandlers(mockStore),
];
