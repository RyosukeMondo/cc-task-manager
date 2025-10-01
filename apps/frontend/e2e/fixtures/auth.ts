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

  // Navigate to login page and wait for network to be idle
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for client-side JavaScript to load and render the form
  // The page uses RSC streaming, so form is rendered client-side
  await page.waitForSelector('#email', { state: 'visible', timeout: 30000 });

  // Extra wait for hydration to complete
  await page.waitForTimeout(1000);

  // Fill in login form using IDs
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for navigation to complete
  await page.waitForLoadState('networkidle', { timeout: 30000 });

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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://192.168.11.26:3005';

  // First, get auth token by logging in via backend API
  const response = await page.request.post(`${apiUrl}/api/auth/login`, {
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
  await page.evaluate((data) => {
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('user', JSON.stringify({
      email: data.email,
      role: data.role,
    }));
  }, { token: authData.token, email: user.email, role: user.role });

  // Reload to apply authentication
  await page.reload();
  await page.waitForLoadState('networkidle');
}

/**
 * Create a valid JWT token for E2E testing
 * The token will be valid for 24 hours
 */
function createMockJWT(userRole: TestUserRole): string {
  const user = TEST_USERS[userRole];

  // JWT Header
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  // JWT Payload with expiration 24 hours from now
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: `mock-${userRole}-id`,
    email: user.email,
    role: userRole,
    permissions: [],
    iat: now,
    exp: now + (24 * 60 * 60) // 24 hours from now
  };

  // Base64 encode header and payload
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '');

  // Fake signature (backend won't validate it in E2E tests)
  const signature = 'mock-signature-for-e2e-testing';

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Setup mock authenticated session without backend
 * Use this for API contract testing when backend is unavailable
 */
export async function setupMockAuth(
  page: Page,
  userRole: TestUserRole = 'user'
): Promise<void> {
  const user = TEST_USERS[userRole];
  const mockToken = createMockJWT(userRole);

  // Set mock auth token in storage without calling backend
  await page.goto('/');
  await page.evaluate((data) => {
    // Use correct localStorage keys that match tokenStorage
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify({
      id: `mock-${data.role}-id`,
      email: data.email,
      name: `Test ${data.role.charAt(0).toUpperCase() + data.role.slice(1)}`,
      role: data.role,
      permissions: [],
    }));
    localStorage.setItem('refresh_token', data.token); // Same mock token for refresh

    // Also set cookies for middleware
    document.cookie = `auth_token=${data.token};path=/;SameSite=Lax`;
  }, { email: user.email, role: userRole, token: mockToken });

  // Reload to apply authentication
  await page.reload();
  await page.waitForLoadState('networkidle');
}
