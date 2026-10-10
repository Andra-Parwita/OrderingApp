import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { devToolsEnabled } from '../src/api/devTools';
import { closeWorld, warmWorld } from './handlers';
import { server } from './server';

beforeAll(async () => {
  server.listen({ onUnhandledFrame: 'error' });
  // The app asks the server once whether dev tools are on; know it before the first test renders.
  if (typeof window !== 'undefined') await devToolsEnabled();
  await warmWorld();
}, 60_000);
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(async () => {
  server.close();
  await closeWorld();
}, 30_000);
