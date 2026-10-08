// Entry of the dev-only mock API: one store per Worker isolate, real clock.
import { handleMockRequest } from './routes';
import { createStore } from './store';

const store = createStore({ now: () => new Date() });

export function handleMock(request: Request): Promise<Response | null> {
  return handleMockRequest(store, request);
}
