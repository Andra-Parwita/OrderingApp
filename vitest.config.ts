import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Plan 077: the screens show times in the device's zone, so the tests run on an Adelaide "device"
// (kitchens are in Adelaide, D-101). Set before the workers start so they inherit it.
process.env['TZ'] = 'Australia/Adelaide';

export default defineConfig({
  plugins: [react()],
  test: {
    // Rendering whole screens in jsdom is CPU-heavy: with one worker per core the 5 s test timeout
    // fired at random under load. Four workers take the same time (about 40 s) and stay under it.
    env: { TZ: 'Australia/Adelaide' },
    maxWorkers: 4,
    // A screen test now waits on a real (local) D1 behind the API: some of them need more than 5 s under load.
    testTimeout: 15_000,
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./mocks/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts', 'mocks/**/*.test.ts'],
  },
});
