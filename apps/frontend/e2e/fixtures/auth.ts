/**
 * Authentication fixtures and helpers for E2E tests
 */

import { Page, expect } from '@playwright/test';

/**
 * Test user credentials
 * These users should exist in your test database
 *
 * Password requirements:
 * - At least 8 characters
 * - At least one lowercase letter
 * - At least one uppercase letter
 * - At least one number
 * - At least one special character
 */
export const TEST_USERS = {
  admin: {
    email: 'admin@test.com',
    password: 'Admin123!',
    role: 'admin',
  },
  user: {
    email: 'user@test.com',
    password: 'User123!',
    role: 'user',
  },
  viewer: {
    email: 'viewer@test.com',
    password: 'Viewer123!',
    role: 'viewer',
  },
} as const;

export type TestUserRole = keyof typeof TEST_USERS;

/**
 * Login helper that fills the form and submits
 */
export async function login(
  page: Page,
  userRole: TestUserRole = 'user'
): Promise<void> {
  const user = TEST_USERS[userRole];

  // Navigate to login page
  await page.goto('/login');

  // Wait for page to load
  await page.waitForLoadState('networkidle');

  // Fill in login form
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for navigation to complete
  await page.waitForLoadState('networkidle');

  // Verify we're logged in by checking we're NOT on login page
  await expect(page).not.toHaveURL(/\/login/);
}

/**
 * Logout helper
 */
export async function logout(page: Page): Promise<void> {
  // Look for user menu or logout button
  // Adjust selectors based on your UI
  const userMenuButton = page.locator('[aria-label="User menu"]').or(
    page.locator('button:has-text("Log out")').or(
      page.locator('[data-testid="user-menu"]')
    )
  );

  // If user menu exists, click it first
  if (await userMenuButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await userMenuButton.click();
  }

  // Click logout
  const logoutButton = page.locator('button:has-text("Log out")').or(
    page.locator('[data-testid="logout-button"]')
  );

  if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutButton.click();
    await page.waitForURL(/\/login/);
  }
}

/**
 * Check if user is authenticated by attempting to access protected route
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // If redirected to login, not authenticated
  return !page.url().includes('/login');
}

/**
 * Setup authenticated session using browser storage
 * This is faster than logging in via UI for every test
 */
export async function setupAuthenticatedSession(
  page: Page,
  userRole: TestUserRole = 'user'
): Promise<void> {
  const user = TEST_USERS[userRole];

  // First, get auth token by logging in
  const response = await page.request.post('/api/auth/login', {
    data: {
      identifier: user.email,
      password: user.password,
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to login: ${response.status()} ${await response.text()}`);
  }

  const authData = await response.json();

  // Set auth token in storage
  await page.goto('/');
  await page.evaluate((token) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify({
      email: user.email,
      role: user.role,
    }));
  }, authData.token);

  // Reload to apply authentication
  await page.reload();
  await page.waitForLoadState('networkidle');
}
