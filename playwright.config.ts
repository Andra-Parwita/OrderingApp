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
// seller-setup changes the shared kitchens' pictures, pickup places and chefs (and puts them back),
// which banners and the order specs read, so it is here too. Plan 067's dish-pictures adds a dish to
// the live menu for a moment, so it is here as well. Plan 081's p081-private-orders makes a private order
// for today (and cancels it), which Cook counts, so it is here too.
// label-print makes one too (and cancels it).
const ISOLATED =
  /(seller-settings.*|seller-menu|seller-batch3|seller-setup|dish-pictures|p081-private-orders|label-print)\.spec\.ts$/;
// Plan 029: changes Onde Onde's stock of one dish (and puts it back); the order specs read it, so it
// runs alone, after limits, on the Android phone project.
const DAY_SELLING = /\/day-selling\.spec\.ts$/;
// Capture-only specs that reset the database or onboard people into the shared kitchens. Never in
// the normal run: `CAPTURES=1 pnpm exec playwright test --project=captures-desktop-chromium --no-deps`.
const CAPTURES = /\/p0(33|39)-captures\.spec\.ts$/;
// Closes a week and resets the mock in `finally`: runs alone, after everything else.
const ARCHIVED = /archived-orders\.spec\.ts$/;
// The one spec that orders a limited item. It runs last, alone, so nothing else sells that item out.
const LIMITS = /\/(limits|p089-order-limit)\.spec\.ts$/;
// Sign-in specs change the one admin's and Dapur Demo's accounts (keys, passwords, devices), so
// they run in the "auth-*" projects, one project after another, after the settings and limits
// specs. The two files that share Dapur Demo's account (seller-auth, session-flow) never overlap.
const AUTH = /\/(seller-auth|admin|seller-saturday)\.spec\.ts$/;
const SESSION_FLOW = /\/session-flow\.spec\.ts$/;
// Plan 028: the helper on the phone; shares Dapur Demo and an admin passkey, so it runs after session-flow.
const HELPER_FLOW = /\/helper-flow\.spec\.ts$/;
// Plan 030: a chef adds and edits a dish; same shared account, so it runs after the helper.
const CHEF_DISHES = /\/chef-dishes\.spec\.ts$/;
// The iPhone-size check: Chromium with an iPhone 15 screen, running only this small set (customer flow
// + Indonesian, the native-app customer shell, a customer order reaching the seller, nudge and lock). Everything else runs on the Android phone and desktop projects.
const IPHONE_SMOKE =
  /\/(customer-batch1|native-customer|order-flow|batch2-flow|customer-live)\.spec\.ts$/;
// Plan 046: turns maintenance on for a moment, which every page shows; runs alone, after the auth specs and before archived (which resets the database, and with it the admin).
const MAINTENANCE = /\/admin-maintenance\.spec\.ts$/;
// Plan 086: signs in with the same admin passkey as MAINTENANCE, so it runs after it, never beside it (two
// browsers on one passkey break the signature counter).
const SHORT_MESSAGE = /\/p086-short-message\.spec\.ts$/;
const MAIN = ['iphone-chromium', 'mobile-chromium', 'desktop-chromium'];

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  // 30 s is Playwright's default.
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
    // Plan 077: times show in the device's zone; the sample kitchens are in Adelaide (D-101).
    timezoneId: 'Australia/Adelaide',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'iphone-chromium',
      testMatch: IPHONE_SMOKE,
      use: { ...devices['iPhone 15'], browserName: 'chromium' },
    },
    {
      // One basic WebKit (Safari engine) smoke spec; runs last, after everything else. WebKit is slower, so 60 s.
      name: 'mobile-webkit',
      testMatch: /\/customer-batch1\.spec\.ts$/,
      timeout: 60_000,
      dependencies: ['archived-desktop-chromium'],
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'mobile-chromium',
      testIgnore: [
        ISOLATED,
        LIMITS,
        ARCHIVED,
        AUTH,
        SESSION_FLOW,
        HELPER_FLOW,
        CHEF_DISHES,
        DAY_SELLING,
        MAINTENANCE,
        SHORT_MESSAGE,
        CAPTURES,
      ],
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'desktop-chromium',
      testIgnore: [
        ISOLATED,
        LIMITS,
        ARCHIVED,
        AUTH,
        SESSION_FLOW,
        HELPER_FLOW,
        CHEF_DISHES,
        DAY_SELLING,
        MAINTENANCE,
        SHORT_MESSAGE,
        CAPTURES,
      ],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'settings-mobile-chromium',
      testMatch: ISOLATED,
      dependencies: MAIN,
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
      name: 'day-selling-mobile-chromium',
      testMatch: DAY_SELLING,
      dependencies: ['limits'],
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'auth-mobile-chromium',
      testMatch: AUTH,
      dependencies: ['day-selling-mobile-chromium'],
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
      name: 'helper-mobile-chromium',
      testMatch: HELPER_FLOW,
      dependencies: ['session-flow'],
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'chef-dishes-desktop-chromium',
      testMatch: CHEF_DISHES,
      dependencies: ['helper-mobile-chromium'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'archived-desktop-chromium',
      testMatch: ARCHIVED,
      dependencies: ['short-message-desktop-chromium'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'short-message-desktop-chromium',
      testMatch: SHORT_MESSAGE,
      dependencies: ['maintenance-desktop-chromium'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'maintenance-desktop-chromium',
      testMatch: MAINTENANCE,
      dependencies: ['chef-dishes-desktop-chromium'],
      use: { ...devices['Desktop Chrome'] },
    },
    ...(process.env['CAPTURES'] === '1'
      ? [
          {
            name: 'captures-desktop-chromium',
            testMatch: CAPTURES,
            use: { ...devices['Desktop Chrome'] },
          },
        ]
      : []),
  ],
  webServer: {
    command: `node scripts/scratch-server.mjs --port ${String(PORT)} --dir ${DB_DIR}`,
    url: `https://localhost:${PORT}/api/health`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
