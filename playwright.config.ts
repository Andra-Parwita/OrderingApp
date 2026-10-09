import { defineConfig, devices } from '@playwright/test';

const PORT = 5181;
// The run's own database (never `.wrangler/state`, the owner's dev data on port 5173): scratch-server.mjs
// deletes it, migrates it and seeds the sample kitchens before the server starts, then the server
// persists there (vite.config.ts, DELAVE_PERSIST_DIR). global-setup.ts asserts the same path.
const DB_DIR = 'scratch/e2e-d1';
const ORIGIN = `https://localhost:${PORT}`;

// Specs that change server-wide settings (they close ordering for a moment) cannot run beside
// specs that place orders. They live in `seller-settings*.spec.ts`, which the main projects skip;
// the "settings-*" projects run them afterwards, one project at a time (each depends on the
// one before), so nothing else is running while ordering is closed.
const ISOLATED = /(seller-settings.*|seller-menu|seller-batch3)\.spec\.ts$/;
// Closes a week and resets the mock in `finally`: runs alone, after everything else.
const ARCHIVED = /archived-orders\.spec\.ts$/;
// The one spec that orders a limited item. It runs last, alone, so nothing else sells that item out.
const LIMITS = /limits\.spec\.ts$/;
// Sign-in specs change the one admin's and Dapur Demo's accounts (keys, passwords, devices), so
// they run in the "auth-*" projects, one project after another, after the settings and limits
// specs. The two files that share Dapur Demo's account (seller-auth, session-flow) never overlap.
const AUTH = /\/(seller-auth|admin|seller-saturday)\.spec\.ts$/;
const SESSION_FLOW = /\/session-flow\.spec\.ts$/;
const MAIN = ['mobile-webkit', 'mobile-chromium', 'desktop-chromium'];
// Webkit runs after the two chromium projects, not beside them: the dev server sends every module
// as its own request, and with three projects loading at once webkit's page loads stall (a lazy
// module request never finishes, so `load` never fires).
const CHROMIUM = ['mobile-chromium', 'desktop-chromium'];

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  // 30 s is Playwright's default; webkit runs after the chromium projects so it is not starved.
  timeout: 30_000,
  // Registers the dev admin (and one passkey per auth spec) once per run, after checking that the
  // server runs on the run's own scratch database.
  globalSetup: './e2e/global-setup.ts',
  reporter: 'list',
  use: {
    baseURL: ORIGIN,
    // The server rejects writes without a same-site Origin (D-048); browsers send it, API calls do not.
    extraHTTPHeaders: { Origin: ORIGIN },
    ignoreHTTPSErrors: false,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-webkit',
      testIgnore: [ISOLATED, LIMITS, ARCHIVED, AUTH, SESSION_FLOW],
      dependencies: CHROMIUM,
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'mobile-chromium',
      testIgnore: [ISOLATED, LIMITS, ARCHIVED, AUTH, SESSION_FLOW],
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop-chromium',
      testIgnore: [ISOLATED, LIMITS, ARCHIVED, AUTH, SESSION_FLOW],
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
    {
      name: 'auth-mobile-chromium',
      testMatch: AUTH,
      dependencies: ['limits'],
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'auth-desktop-chromium',
      testMatch: AUTH,
      dependencies: ['auth-mobile-chromium'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'session-flow',
      testMatch: SESSION_FLOW,
      dependencies: ['auth-desktop-chromium'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'archived-desktop-chromium',
      testMatch: ARCHIVED,
      dependencies: ['session-flow'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `node scripts/scratch-server.mjs --port ${String(PORT)} --dir ${DB_DIR}`,
    url: `https://localhost:${PORT}/api/health`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
