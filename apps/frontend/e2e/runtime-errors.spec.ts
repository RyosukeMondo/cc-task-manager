/**
 * Runtime Error Detection E2E Tests
 *
 * Automatically detects JavaScript runtime errors across all pages
 * This catches errors like:
 * - Undefined variable access
 * - Type errors (cannot read property of undefined)
 * - Zod schema validation errors
 * - Module import failures
 * - React rendering errors
 */

import { test, expect, Page } from '@playwright/test';
import { login } from './fixtures/auth';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3006';

/**
 * Array to collect all runtime errors from the page
 */
interface RuntimeError {
  message: string;
  source: string;
  line?: number;
  column?: number;
  stack?: string;
  url: string;
}

/**
 * Setup error listeners on a page
 * Returns array that will be populated with errors
 */
function setupErrorListeners(page: Page): RuntimeError[] {
  const errors: RuntimeError[] = [];

  // Listen for uncaught exceptions
  page.on('pageerror', (error) => {
    errors.push({
      message: error.message,
      source: 'pageerror',
      stack: error.stack,
      url: page.url(),
    });
    console.error(`\n❌ Runtime Error on ${page.url()}:`);
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n   ')}`);
    }
  });

  // Listen for console errors and logs
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out noise (network errors, etc)
      if (!text.includes('Failed to load resource') &&
          !text.includes('Failed to fetch RSC') &&
          !text.includes('404')) {
        errors.push({
          message: text,
          source: 'console.error',
          url: page.url(),
        });
        console.error(`\n⚠️  Console Error on ${page.url()}: ${text}`);
      }
    }
    // Also log console.log messages for debugging
    if (msg.type() === 'log') {
      console.log(`📝 Browser console.log: ${msg.text()}`);
    }
  });

  return errors;
}

test.describe('Runtime Error Detection', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page, 'user');
  });

  test('Settings page should load without runtime errors', async ({ page }) => {
    const errors = setupErrorListeners(page);

    // Navigate to settings page
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Wait for any late-firing errors
    await page.waitForTimeout(2000);

    // Check for runtime errors
    if (errors.length > 0) {
      console.error('\n🚨 Runtime errors detected:');
      errors.forEach((err, i) => {
        console.error(`\n${i + 1}. ${err.source}: ${err.message}`);
        if (err.stack) {
          console.error(`   ${err.stack.split('\n').slice(0, 5).join('\n   ')}`);
        }
      });
    }

    // Fail test if any runtime errors occurred
    expect(errors, `Found ${errors.length} runtime error(s) on settings page`).toHaveLength(0);

    // Additionally check that page content loaded
    await expect(page.locator('text=/Settings|Profile|Preferences|Notifications/i').first()).toBeVisible();
  });

  test('Dashboard page should load without runtime errors', async ({ page }) => {
    const errors = setupErrorListeners(page);

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.waitForTimeout(2000);

    expect(errors, `Found ${errors.length} runtime error(s) on dashboard`).toHaveLength(0);
    await expect(page.locator('h1, [role="heading"]').first()).toBeVisible();
  });

  test('All Tasks page should load without runtime errors', async ({ page }) => {
    const errors = setupErrorListeners(page);

    await page.goto(`${BASE_URL}/tasks`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.waitForTimeout(2000);

    expect(errors, `Found ${errors.length} runtime error(s) on tasks page`).toHaveLength(0);
  });

  test('Active Tasks page should load without runtime errors', async ({ page }) => {
    const errors = setupErrorListeners(page);

    await page.goto(`${BASE_URL}/tasks/active`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.waitForTimeout(2000);

    expect(errors, `Found ${errors.length} runtime error(s) on active tasks`).toHaveLength(0);
  });

  test('Completed Tasks page should load without runtime errors', async ({ page }) => {
    const errors = setupErrorListeners(page);

    await page.goto(`${BASE_URL}/tasks/completed`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.waitForTimeout(2000);

    expect(errors, `Found ${errors.length} runtime error(s) on completed tasks`).toHaveLength(0);
  });

  test('Analytics Performance page should load without runtime errors', async ({ page }) => {
    const errors = setupErrorListeners(page);

    await page.goto(`${BASE_URL}/analytics/performance`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.waitForTimeout(2000);

    expect(errors, `Found ${errors.length} runtime error(s) on performance analytics`).toHaveLength(0);
  });

  test('Analytics Trends page should load without runtime errors', async ({ page }) => {
    const errors = setupErrorListeners(page);

    await page.goto(`${BASE_URL}/analytics/trends`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    await page.waitForTimeout(2000);

    expect(errors, `Found ${errors.length} runtime error(s) on trends analytics`).toHaveLength(0);
  });
});
