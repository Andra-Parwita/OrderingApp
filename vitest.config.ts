import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    // Rendering whole screens in jsdom is CPU-heavy: with one worker per core the 5 s test timeout
    // fired at random under load. Four workers take the same time (about 40 s) and stay under it.
    maxWorkers: 4,
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./mocks/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts', 'mocks/**/*.test.ts'],
  },
});
