import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { devToolsEnabled } from '../src/api/devTools';
import { setRetryDelays } from '../src/api/retryPolicy';
import { closeWorld, warmWorld } from './handlers';
import { server } from './server';

// Plan 062: a failing GET is retried 3 times in the app; tests that fail on purpose should not wait.
setRetryDelays([]);

beforeAll(async () => {
  server.listen({ onUnhandledFrame: 'error' });
  // The app asks the server once whether dev tools are on; know it before the first test renders.
  if (typeof window !== 'undefined') await devToolsEnabled();
  await warmWorld();
}, 60_000);
afterEach(() => {
  cleanup();
  // Plan 061: a form saves its draft when it unmounts; one test's draft must not reach the next.
  if (typeof localStorage !== 'undefined') {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('draft:')) localStorage.removeItem(key);
    }
  }
  server.resetHandlers();
});
afterAll(async () => {
  server.close();
  await closeWorld();
}, 30_000);
