import { defineConfig, devices } from '@playwright/test';

const PORT = 5181;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: `https://localhost:${PORT}`,
    ignoreHTTPSErrors: false,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile-webkit', use: { ...devices['iPhone 14'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
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
