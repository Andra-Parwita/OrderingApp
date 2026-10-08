import { defineConfig, devices } from '@playwright/test';

const PORT = 5181;

// Specs that change server-wide settings (they close ordering for a moment) cannot run beside
// specs that place orders. They live in `seller-settings*.spec.ts`, which the main projects skip;
// the "settings-*" projects run them afterwards, one project at a time (each depends on the
// one before), so nothing else is running while ordering is closed.
const ISOLATED = /seller-settings.*\.spec\.ts$/;
// The one spec that orders a limited item. It runs last, alone, so nothing else sells that item out.
const LIMITS = /limits\.spec\.ts$/;
const MAIN = ['mobile-webkit', 'mobile-chromium', 'desktop-chromium'];

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  // Webkit full-page screenshots are slow when three projects run at once.
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: `https://localhost:${PORT}`,
    ignoreHTTPSErrors: false,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile-webkit', testIgnore: [ISOLATED, LIMITS], use: { ...devices['iPhone 14'] } },
    { name: 'mobile-chromium', testIgnore: [ISOLATED, LIMITS], use: { ...devices['Pixel 7'] } },
    {
      name: 'desktop-chromium',
      testIgnore: [ISOLATED, LIMITS],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'settings-mobile-webkit',
      testMatch: ISOLATED,
      dependencies: MAIN,
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'settings-mobile-chromium',
      testMatch: ISOLATED,
      dependencies: ['settings-mobile-webkit'],
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'settings-desktop-chromium',
      testMatch: ISOLATED,
      dependencies: ['settings-mobile-chromium'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'limits',
      testMatch: LIMITS,
      dependencies: ['settings-desktop-chromium'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    env: { PORT: String(PORT) },
    url: `https://localhost:${PORT}/api/health`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
