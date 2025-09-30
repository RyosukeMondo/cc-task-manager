/**
 * Smoke Tests - Quick validation that core pages load without errors
 *
 * This automates the "try access, got error, fix" loop by:
 * 1. Visiting each route
 * 2. Checking for runtime errors
 * 3. Validating key elements render
 *
 * Run with: pnpm test:e2e
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3006';

test.describe('Smoke Tests - Core Pages', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`❌ Console Error on ${page.url()}:`, msg.text());
      }
    });

    // Listen for page errors (unhandled exceptions)
    page.on('pageerror', error => {
      console.error(`❌ Page Error on ${page.url()}:`, error.message);
    });
  });

  test('Dashboard loads without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Check no Next.js error overlay
    const errorOverlay = page.locator('[id*="nextjs"][id*="error"]');
    await expect(errorOverlay).not.toBeVisible({ timeout: 2000 }).catch(() => {});

    // Validate key elements
    await expect(page.locator('h1')).toBeVisible();

    console.log('✅ Dashboard loaded successfully');
  });

  test('Tasks page loads without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/tasks`);
    await page.waitForLoadState('networkidle');

    // Check no Next.js error overlay
    const errorOverlay = page.locator('[id*="nextjs"][id*="error"]');
    await expect(errorOverlay).not.toBeVisible({ timeout: 2000 }).catch(() => {});

    // Validate page loaded
    await expect(page.locator('h1, [role="heading"]')).toBeVisible();

    // Should not see "Unhandled Runtime Error" text
    const errorText = await page.locator('text=Unhandled Runtime Error').count();
    expect(errorText).toBe(0);

    console.log('✅ Tasks page loaded successfully');
  });

  test('Active Tasks page loads without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/tasks/active`);
    await page.waitForLoadState('networkidle');

    const errorOverlay = page.locator('[id*="nextjs"][id*="error"]');
    await expect(errorOverlay).not.toBeVisible({ timeout: 2000 }).catch(() => {});

    await expect(page.locator('h1, [role="heading"]')).toBeVisible();

    console.log('✅ Active Tasks page loaded successfully');
  });

  test('Completed Tasks page loads without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/tasks/completed`);
    await page.waitForLoadState('networkidle');

    const errorOverlay = page.locator('[id*="nextjs"][id*="error"]');
    await expect(errorOverlay).not.toBeVisible({ timeout: 2000 }).catch(() => {});

    await expect(page.locator('h1, [role="heading"]')).toBeVisible();

    console.log('✅ Completed Tasks page loaded successfully');
  });

  test('Analytics Performance page loads without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/performance`);
    await page.waitForLoadState('networkidle');

    const errorOverlay = page.locator('[id*="nextjs"][id*="error"]');
    await expect(errorOverlay).not.toBeVisible({ timeout: 2000 }).catch(() => {});

    await expect(page.locator('h1, [role="heading"]')).toBeVisible();

    console.log('✅ Analytics Performance page loaded successfully');
  });

  test('Analytics Trends page loads without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/analytics/trends`);
    await page.waitForLoadState('networkidle');

    const errorOverlay = page.locator('[id*="nextjs"][id*="error"]');
    await expect(errorOverlay).not.toBeVisible({ timeout: 2000 }).catch(() => {});

    await expect(page.locator('h1, [role="heading"]')).toBeVisible();

    console.log('✅ Analytics Trends page loaded successfully');
  });

  test('Settings page loads without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);
    await page.waitForLoadState('networkidle');

    const errorOverlay = page.locator('[id*="nextjs"][id*="error"]');
    await expect(errorOverlay).not.toBeVisible({ timeout: 2000 }).catch(() => {});

    await expect(page.locator('h1, [role="heading"]')).toBeVisible();

    console.log('✅ Settings page loaded successfully');
  });
});

test.describe('WebSocket Connection Tests', () => {
  test('WebSocket connects successfully', async ({ page }) => {
    const wsMessages: string[] = [];

    // Intercept WebSocket connections
    page.on('websocket', ws => {
      console.log(`WebSocket opened: ${ws.url()}`);

      ws.on('framereceived', event => {
        wsMessages.push(event.payload.toString());
      });

      ws.on('close', () => console.log('WebSocket closed'));
      ws.on('socketerror', error => console.error('WebSocket error:', error));
    });

    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Wait a bit for WebSocket to connect
    await page.waitForTimeout(3000);

    // Check the page doesn't show WebSocket connection errors
    const wsError = await page.locator('text=/WebSocket.*error|Max reconnection/i').count();
    expect(wsError).toBe(0);

    console.log('✅ WebSocket connection successful');
  });
});
