/**
 * Settings API E2E Tests
 *
 * Tests direct API endpoint calls for user settings:
 * - GET /api/settings (auto-creates defaults on first request)
 * - PATCH /api/settings (updates preferences)
 * - Validates enum values (theme, displayDensity)
 * - Validates language format (ISO 639-1)
 * - Verifies persistence across sessions
 * - Verifies authentication requirement (401 without JWT)
 *
 * Spec: backend-settings-api (Task 9)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3006';
const API_BASE = `${BASE_URL}/api`;

// Generate unique test user for each test run
const timestamp = Date.now();
const TEST_EMAIL = `settings.test.${timestamp}@example.com`;
const TEST_PASSWORD = 'SettingsTest123!';
const TEST_NAME = 'Settings Test User';

test.describe('Settings API - Auto-create and GET', () => {
  let accessToken: string;
  let userId: string;

  test.beforeAll(async ({ request }) => {
    // Register and login to get tokens
    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: TEST_NAME,
      },
    });

    const body = await registerResponse.json();
    accessToken = body.accessToken;
    userId = body.user.id;
  });

  test('GET /api/settings should auto-create defaults on first request (200)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    // Verify default values
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('userId', userId);
    expect(body).toHaveProperty('theme', 'SYSTEM');
    expect(body).toHaveProperty('notifications', true);
    expect(body).toHaveProperty('displayDensity', 'COMFORTABLE');
    expect(body).toHaveProperty('language', 'en');
    expect(body).toHaveProperty('createdAt');
    expect(body).toHaveProperty('updatedAt');

    console.log('✅ GET /api/settings auto-created defaults (200)');
  });

  test('GET /api/settings should return existing settings (200)', async ({ request }) => {
    // Second GET should return the same settings (no duplicate creation)
    const response = await request.get(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('userId', userId);
    expect(body).toHaveProperty('theme', 'SYSTEM');

    console.log('✅ GET /api/settings returned existing settings (200)');
  });

  test('GET /api/settings should reject without token (401)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/settings`);

    expect(response.status()).toBe(401);
    console.log('✅ GET /api/settings rejected without token (401)');
  });
});

test.describe('Settings API - Update preferences', () => {
  let accessToken: string;
  let userId: string;

  test.beforeAll(async ({ request }) => {
    // Register and login to get tokens
    const email = `update.test.${timestamp}@example.com`;
    const password = 'UpdateTest123!';

    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: { email, password, name: 'Update Test User' },
    });

    const body = await registerResponse.json();
    accessToken = body.accessToken;
    userId = body.user.id;
  });

  test('PATCH /api/settings should update preferences (200)', async ({ request }) => {
    const response = await request.patch(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        theme: 'DARK',
        notifications: false,
        displayDensity: 'COMPACT',
        language: 'es',
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('userId', userId);
    expect(body).toHaveProperty('theme', 'DARK');
    expect(body).toHaveProperty('notifications', false);
    expect(body).toHaveProperty('displayDensity', 'COMPACT');
    expect(body).toHaveProperty('language', 'es');

    console.log('✅ PATCH /api/settings updated preferences (200)');
  });

  test('PATCH /api/settings should support partial updates (200)', async ({ request }) => {
    // Update only theme
    const response = await request.patch(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        theme: 'LIGHT',
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('theme', 'LIGHT');
    // Previous values should be preserved
    expect(body).toHaveProperty('notifications', false);
    expect(body).toHaveProperty('displayDensity', 'COMPACT');
    expect(body).toHaveProperty('language', 'es');

    console.log('✅ PATCH /api/settings supported partial update (200)');
  });

  test('PATCH /api/settings should reject without token (401)', async ({ request }) => {
    const response = await request.patch(`${API_BASE}/settings`, {
      data: {
        theme: 'DARK',
      },
    });

    expect(response.status()).toBe(401);
    console.log('✅ PATCH /api/settings rejected without token (401)');
  });
});

test.describe('Settings API - Validation', () => {
  let accessToken: string;

  test.beforeAll(async ({ request }) => {
    // Register and login to get tokens
    const email = `validation.test.${timestamp}@example.com`;
    const password = 'ValidationTest123!';

    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: { email, password, name: 'Validation Test User' },
    });

    const body = await registerResponse.json();
    accessToken = body.accessToken;
  });

  test('PATCH /api/settings should reject invalid theme (400)', async ({ request }) => {
    const response = await request.patch(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        theme: 'INVALID_THEME',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('message');

    // Check that error message mentions allowed values
    const message = JSON.stringify(body.message).toLowerCase();
    expect(message).toMatch(/light|dark|system/);

    console.log('✅ Invalid theme rejected with allowed values (400)');
  });

  test('PATCH /api/settings should reject invalid displayDensity (400)', async ({ request }) => {
    const response = await request.patch(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        displayDensity: 'INVALID_DENSITY',
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('message');

    // Check that error message mentions allowed values
    const message = JSON.stringify(body.message).toLowerCase();
    expect(message).toMatch(/comfortable|compact|spacious/);

    console.log('✅ Invalid displayDensity rejected with allowed values (400)');
  });

  test('PATCH /api/settings should reject invalid language format - not ISO 639-1 (400)', async ({ request }) => {
    const response = await request.patch(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        language: 'eng', // Should be 'en' (2 letters)
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('message');

    console.log('✅ Invalid language format rejected (400)');
  });

  test('PATCH /api/settings should reject uppercase language code (400)', async ({ request }) => {
    const response = await request.patch(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        language: 'EN', // Should be lowercase
      },
    });

    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body).toHaveProperty('message');

    console.log('✅ Uppercase language code rejected (400)');
  });

  test('PATCH /api/settings should accept valid ISO 639-1 language codes (200)', async ({ request }) => {
    const validLanguages = ['en', 'es', 'fr', 'de', 'ja', 'zh', 'pt', 'ru'];

    for (const lang of validLanguages) {
      const response = await request.patch(`${API_BASE}/settings`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        data: {
          language: lang,
        },
      });

      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body).toHaveProperty('language', lang);
    }

    console.log('✅ Valid ISO 639-1 language codes accepted (200)');
  });
});

test.describe('Settings API - Persistence across sessions', () => {
  let accessToken1: string;
  let accessToken2: string;
  let userId: string;

  test.beforeAll(async ({ request }) => {
    // Register and login to get first token
    const email = `persistence.test.${timestamp}@example.com`;
    const password = 'PersistenceTest123!';

    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: { email, password, name: 'Persistence Test User' },
    });

    const body = await registerResponse.json();
    accessToken1 = body.accessToken;
    userId = body.user.id;

    // Update settings with first token
    await request.patch(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${accessToken1}`,
      },
      data: {
        theme: 'DARK',
        notifications: false,
        displayDensity: 'SPACIOUS',
        language: 'fr',
      },
    });

    // Logout and login again to get new token (simulating new session)
    await request.post(`${API_BASE}/auth/logout`, {
      headers: {
        Authorization: `Bearer ${accessToken1}`,
      },
    });

    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email, password },
    });

    const loginBody = await loginResponse.json();
    accessToken2 = loginBody.accessToken;
  });

  test('Settings should persist across sessions (logout/login)', async ({ request }) => {
    // Get settings with new token
    const response = await request.get(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${accessToken2}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    // Verify settings persisted
    expect(body).toHaveProperty('userId', userId);
    expect(body).toHaveProperty('theme', 'DARK');
    expect(body).toHaveProperty('notifications', false);
    expect(body).toHaveProperty('displayDensity', 'SPACIOUS');
    expect(body).toHaveProperty('language', 'fr');

    console.log('✅ Settings persisted across sessions');
  });

  test('Old token should not work after logout (401)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${accessToken1}`,
      },
    });

    expect(response.status()).toBe(401);
    console.log('✅ Old token rejected after logout (401)');
  });
});

test.describe('Settings API - Edge cases', () => {
  let accessToken: string;

  test.beforeAll(async ({ request }) => {
    // Register and login to get tokens
    const email = `edge.test.${timestamp}@example.com`;
    const password = 'EdgeTest123!';

    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: { email, password, name: 'Edge Test User' },
    });

    const body = await registerResponse.json();
    accessToken = body.accessToken;
  });

  test('PATCH /api/settings with empty body should return 200 (no changes)', async ({ request }) => {
    // First, get current settings
    const getResponse = await request.get(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const currentSettings = await getResponse.json();

    // Update with empty body
    const response = await request.patch(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {},
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    // Settings should remain unchanged
    expect(body.theme).toBe(currentSettings.theme);
    expect(body.notifications).toBe(currentSettings.notifications);
    expect(body.displayDensity).toBe(currentSettings.displayDensity);
    expect(body.language).toBe(currentSettings.language);

    console.log('✅ Empty PATCH request handled correctly (200)');
  });

  test('PATCH /api/settings should update timestamps', async ({ request }) => {
    // Get current settings
    const getResponse = await request.get(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const beforeUpdate = await getResponse.json();

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update settings
    const patchResponse = await request.patch(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        theme: 'LIGHT',
      },
    });

    const afterUpdate = await patchResponse.json();

    // Verify updatedAt changed
    expect(new Date(afterUpdate.updatedAt).getTime()).toBeGreaterThan(
      new Date(beforeUpdate.updatedAt).getTime()
    );

    // Verify createdAt remained the same
    expect(afterUpdate.createdAt).toBe(beforeUpdate.createdAt);

    console.log('✅ PATCH updates timestamps correctly');
  });
});
