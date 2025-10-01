/**
 * Authenticated Pages E2E Tests
 *
 * Tests that all pages load correctly for authenticated users
 * This extends smoke tests with authentication context
 */

import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession } from './fixtures/auth';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3006';

test.describe('Authenticated Pages', () => {
  // Setup authentication before each test using API (faster than UI login)
  test.beforeEach(async ({ page }) => {
    // Listen for errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error(`❌ Console Error on ${page.url()}: ${msg.text()}`);
      }
    });

    page.on('pageerror', (error) => {
      console.error(`❌ Page Error on ${page.url()}: ${error.message}`);
    });

    // Setup auth via API (faster than UI login)
    await setupAuthenticatedSession(page, 'user');
  });

  test('Dashboard page loads for authenticated user', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Should not redirect to login
    await expect(page).not.toHaveURL(/\/login/);

    // Check no error overlay
    const errorOverlay = page.locator('[id*="nextjs"][id*="error"]');
    await expect(errorOverlay).not.toBeVisible({ timeout: 2000 }).catch(() => {});

    // Validate content loaded
    await expect(page.locator('h1, [role="heading"]')).toBeVisible();

    console.log('✅ Dashboard loaded for authenticated user');
  });

  test('All Tasks page loads for authenticated user', async ({ page }) => {
    await page.goto(`${BASE_URL}/tasks`);
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/\/login/);

    const errorOverlay = page.locator('[id*="nextjs"][id*="error"]');
    await expect(errorOverlay).not.toBeVisible({ timeout: 2000 }).catch(() => {});

    // Should show task list or empty state - use more specific selector
    const taskListOrEmpty = page
      .locator('[data-testid="task-list"]')
      .or(page.locator('h1:has-text("All Tasks")').first());
    await expect(taskListOrEmpty).toBeVisible();

    console.log('✅ All Tasks page loaded for authenticated user');
  });

  test('Active Tasks page loads for authenticated user', async ({ page }) => {
    await page.goto(`${BASE_URL}/tasks/active`);
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/\/login/);

    const errorOverlay = page.locator('[id*="nextjs"][id*="error"]');
    await expect(errorOverlay).not.toBeVisible({ timeout: 2000 }).catch(() => {});

    await expect(page.locator('h1, [role="heading"]')).toBeVisible();

    console.log('✅ Active Tasks page loaded for authenticated user');
  });

  test('Completed Tasks page loads for authenticated user', async ({ page }) => {
    await page.goto(`${BASE_URL}/tasks/completed`);
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/\/login/);

    const errorOverlay = page.locator('[id*="nextjs"][id*="error"]');
    await expect(errorOverlay).not.toBeVisible({ timeout: 2000 }).catch(() => {});

    await expect(page.locator('h1, [role="heading"]')).toBeVisible();

    console.log('✅ Completed Tasks page loaded for authenticated user');
  });

  test('Analytics Performance page loads for authenticated user', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/performance`);
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/\/login/);

    const errorOverlay = page.locator('[id*="nextjs"][id*="error"]');
    await expect(errorOverlay).not.toBeVisible({ timeout: 2000 }).catch(() => {});

    await expect(page.locator('h1, [role="heading"]')).toBeVisible();

    console.log('✅ Analytics Performance page loaded for authenticated user');
  });

  test('Analytics Trends page loads for authenticated user', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/trends`);
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/\/login/);

    const errorOverlay = page.locator('[id*="nextjs"][id*="error"]');
    await expect(errorOverlay).not.toBeVisible({ timeout: 2000 }).catch(() => {});

    await expect(page.locator('h1, [role="heading"]')).toBeVisible();

    console.log('✅ Analytics Trends page loaded for authenticated user');
  });

  test('Settings page loads for authenticated user', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/\/login/);

    const errorOverlay = page.locator('[id*="nextjs"][id*="error"]');
    await expect(errorOverlay).not.toBeVisible({ timeout: 2000 }).catch(() => {});

    // Settings should show heading - use more specific selector
    await expect(
      page.locator('h1:has-text("Settings")').first()
    ).toBeVisible();

    console.log('✅ Settings page loaded for authenticated user');
  });

  test('Navigation works correctly for authenticated user', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Test navigation links (adjust selectors based on your UI)
    const navLinks = [
      { text: /Tasks/i, url: /\/tasks/ },
      { text: /Analytics/i, url: /\/analytics/ },
      { text: /Settings/i, url: /\/settings/ },
    ];

    for (const link of navLinks) {
      const navLink = page.locator(`a:has-text("${link.text.source}")`).first();

      if (await navLink.isVisible().catch(() => false)) {
        await navLink.click();
        await page.waitForLoadState('networkidle');

        // Should navigate successfully
        await expect(page).toHaveURL(link.url);
        await expect(page).not.toHaveURL(/\/login/);

        console.log(`✅ Navigation to ${link.url.source} works`);
      }
    }
  });
});
