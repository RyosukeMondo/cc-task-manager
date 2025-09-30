import { test, expect, Page } from '@playwright/test';
import { login } from './fixtures/auth';

/**
 * Settings Page Interaction Tests
 *
 * Tests user interactions on the settings page including:
 * - Tab switching
 * - Form interactions
 * - Runtime error detection during interactions
 */

interface RuntimeError {
  message: string;
  source: string;
  stack?: string;
  url: string;
}

function setupErrorListeners(page: Page): RuntimeError[] {
  const errors: RuntimeError[] = [];

  page.on('pageerror', (error) => {
    errors.push({
      message: error.message,
      source: 'pageerror',
      stack: error.stack,
      url: page.url(),
    });
    console.error(`\n❌ Runtime Error: ${error.message}`);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('Failed to load resource') &&
          !text.includes('Failed to fetch RSC') &&
          !text.includes('404')) {
        errors.push({
          message: text,
          source: 'console.error',
          url: page.url(),
        });
        console.error(`\n⚠️  Console Error: ${text}`);
      }
    }
  });

  return errors;
}

test.describe('Settings Page Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'user');
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('Should switch to Profile tab without errors', async ({ page }) => {
    const errors = setupErrorListeners(page);

    // Click Profile tab
    const profileTab = page.locator('[role="tab"]', { hasText: /Profile/i });
    await profileTab.click();
    await page.waitForTimeout(1000);

    expect(errors, `Found ${errors.length} runtime error(s) when clicking Profile tab`).toHaveLength(0);

    // Verify Profile content is visible
    await expect(page.locator('text=/Profile Settings|Display Name|Email Address/i').first()).toBeVisible();
  });

  test('Should switch to Preferences tab without errors', async ({ page }) => {
    const errors = setupErrorListeners(page);

    // Click Preferences tab
    const preferencesTab = page.locator('[role="tab"]', { hasText: /Preferences/i });
    await preferencesTab.click();
    await page.waitForTimeout(1000);

    expect(errors, `Found ${errors.length} runtime error(s) when clicking Preferences tab`).toHaveLength(0);

    // Verify Preferences content is visible
    await expect(page.locator('text=/Application Preferences|Theme|Language/i').first()).toBeVisible();
  });

  test('Should switch to Notifications tab without errors', async ({ page }) => {
    const errors = setupErrorListeners(page);

    // Click Notifications tab
    const notificationsTab = page.locator('[role="tab"]', { hasText: /Notifications/i });
    await notificationsTab.click();
    await page.waitForTimeout(1000);

    expect(errors, `Found ${errors.length} runtime error(s) when clicking Notifications tab`).toHaveLength(0);

    // Verify Notifications content is visible
    await expect(page.locator('text=/Notification Settings|Email Notifications|Push Notifications/i').first()).toBeVisible();
  });

  test('Should switch between all tabs without errors', async ({ page }) => {
    const errors = setupErrorListeners(page);

    // Test switching through all tabs in sequence
    const tabs = ['Profile', 'Preferences', 'Notifications'];

    for (const tabName of tabs) {
      const tab = page.locator('[role="tab"]', { hasText: new RegExp(tabName, 'i') });
      await tab.click();
      await page.waitForTimeout(500);

      // Verify no errors accumulated
      expect(errors, `Found ${errors.length} runtime error(s) when switching to ${tabName} tab`).toHaveLength(0);
    }
  });

  test('Should handle form interactions on Profile tab', async ({ page }) => {
    const errors = setupErrorListeners(page);

    // Click Profile tab
    const profileTab = page.locator('[role="tab"]', { hasText: /Profile/i });
    await profileTab.click();
    await page.waitForTimeout(500);

    // Try to interact with form fields
    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('Test User');
      await page.waitForTimeout(300);
    }

    expect(errors, `Found ${errors.length} runtime error(s) during Profile form interaction`).toHaveLength(0);
  });

  test('Should handle form interactions on Preferences tab', async ({ page }) => {
    const errors = setupErrorListeners(page);

    // Click Preferences tab
    const preferencesTab = page.locator('[role="tab"]', { hasText: /Preferences/i });
    await preferencesTab.click();
    await page.waitForTimeout(500);

    // Try to interact with theme selector
    const themeSelect = page.locator('[role="combobox"]', { hasText: /Theme|theme/i }).or(
      page.locator('select[name="theme"]')
    ).first();

    if (await themeSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await themeSelect.click();
      await page.waitForTimeout(300);
    }

    expect(errors, `Found ${errors.length} runtime error(s) during Preferences form interaction`).toHaveLength(0);
  });

  test('Should handle form interactions on Notifications tab', async ({ page }) => {
    const errors = setupErrorListeners(page);

    // Click Notifications tab
    const notificationsTab = page.locator('[role="tab"]', { hasText: /Notifications/i });
    await notificationsTab.click();
    await page.waitForTimeout(500);

    // Try to interact with notification toggles
    const emailToggle = page.locator('[role="switch"]').first();
    if (await emailToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await emailToggle.click();
      await page.waitForTimeout(300);
    }

    expect(errors, `Found ${errors.length} runtime error(s) during Notifications form interaction`).toHaveLength(0);
  });
});
