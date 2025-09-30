import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for CC Task Manager Frontend
 *
 * To use this configuration:
 * 1. Install Playwright: pnpm add -D @playwright/test
 * 2. Install browsers: pnpm exec playwright install
 * 3. Start dev server: pnpm dev (runs on port 3006)
 * 4. Run tests: pnpm exec playwright test
 */

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3006',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3006',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});