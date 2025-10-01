/**
 * Authentication API E2E Tests
 *
 * Tests direct API endpoint calls for authentication:
 * - POST /api/auth/register (creates user, rejects duplicates, validates weak passwords)
 * - POST /api/auth/login (returns JWT, rejects invalid credentials)
 * - POST /api/auth/refresh (renews token)
 * - POST /api/auth/logout (invalidates session)
 * - GET /api/auth/me (returns current user)
 * - Protected route authentication (401 without token)
 *
 * Spec: backend-auth-api (Task 12)
 */

import { test, expect, APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3006';
const API_BASE = `${BASE_URL}/api`;

// Generate unique test user for each test run
const timestamp = Date.now();
const TEST_EMAIL = `test.user.${timestamp}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Test User';

// Weak password tests
const WEAK_PASSWORDS = [
  { password: 'short', reason: 'too short (< 8 chars)' },
  { password: 'nouppercase1!', reason: 'no uppercase letter' },
  { password: 'NOLOWERCASE1!', reason: 'no lowercase letter' },
  { password: 'NoNumber!', reason: 'no number' },
  { password: 'NoSpecial123', reason: 'no special character' },
];

test.describe('Authentication API - Registration', () => {
  test('should register new user with valid data (201)', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/register`, {
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: TEST_NAME,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('user');
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');

    // Verify user object structure
    expect(body.user).toHaveProperty('id');
    expect(body.user).toHaveProperty('email', TEST_EMAIL);
    expect(body.user).toHaveProperty('name', TEST_NAME);

    // CRITICAL: Password must NEVER be returned
    expect(body.user).not.toHaveProperty('password');

    // Verify tokens are strings
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
    expect(body.accessToken.length).toBeGreaterThan(0);
    expect(body.refreshToken.length).toBeGreaterThan(0);

    console.log('✅ User registered successfully (201) with tokens');
  });

  test('should reject duplicate email registration (409)', async ({ request }) => {
    // First registration
    await request.post(`${API_BASE}/auth/register`, {
      data: {
        email: `duplicate.${timestamp}@example.com`,
        password: TEST_PASSWORD,
        name: 'First User',
      },
    });

    // Second registration with same email
    const response = await request.post(`${API_BASE}/auth/register`, {
      data: {
        email: `duplicate.${timestamp}@example.com`,
        password: TEST_PASSWORD,
        name: 'Second User',
      },
    });

    expect(response.status()).toBe(409);

    const body = await response.json();
    expect(body).toHaveProperty('message');
    expect(body.message.toLowerCase()).toContain('exist');

    console.log('✅ Duplicate email rejected (409)');
  });

  for (const { password, reason } of WEAK_PASSWORDS) {
    test(`should reject weak password: ${reason} (400)`, async ({ request }) => {
      const response = await request.post(`${API_BASE}/auth/register`, {
        data: {
          email: `weak.${timestamp}.${Math.random()}@example.com`,
          password,
          name: 'Test User',
        },
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body).toHaveProperty('message');

      console.log(`✅ Weak password rejected: ${reason} (400)`);
    });
  }

  test('should reject registration without email (400)', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/register`, {
      data: {
        password: TEST_PASSWORD,
        name: TEST_NAME,
      },
    });

    expect(response.status()).toBe(400);
    console.log('✅ Registration without email rejected (400)');
  });

  test('should reject registration with invalid email format (400)', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/register`, {
      data: {
        email: 'not-an-email',
        password: TEST_PASSWORD,
        name: TEST_NAME,
      },
    });

    expect(response.status()).toBe(400);
    console.log('✅ Invalid email format rejected (400)');
  });
});

test.describe('Authentication API - Login', () => {
  let registeredEmail: string;
  let registeredPassword: string;

  test.beforeAll(async ({ request }) => {
    // Register a user for login tests
    registeredEmail = `login.test.${timestamp}@example.com`;
    registeredPassword = 'LoginTest123!';

    await request.post(`${API_BASE}/auth/register`, {
      data: {
        email: registeredEmail,
        password: registeredPassword,
        name: 'Login Test User',
      },
    });
  });

  test('should login with valid credentials and return JWT (200)', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: registeredEmail,
        password: registeredPassword,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(body).toHaveProperty('user');

    // Verify user object
    expect(body.user.email).toBe(registeredEmail);
    expect(body.user).not.toHaveProperty('password');

    // Verify JWT format (should be three base64 segments)
    const jwtParts = body.accessToken.split('.');
    expect(jwtParts).toHaveLength(3);

    console.log('✅ Login successful with valid credentials (200)');
  });

  test('should reject login with invalid email (401)', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: 'nonexistent@example.com',
        password: registeredPassword,
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toHaveProperty('message');

    console.log('✅ Invalid email rejected (401)');
  });

  test('should reject login with wrong password (401)', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/login`, {
      data: {
        email: registeredEmail,
        password: 'WrongPassword123!',
      },
    });

    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body).toHaveProperty('message');

    console.log('✅ Wrong password rejected (401)');
  });

  test('should reject login without credentials (400)', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/login`, {
      data: {},
    });

    expect(response.status()).toBe(400);
    console.log('✅ Login without credentials rejected (400)');
  });
});

test.describe('Authentication API - Token Management', () => {
  let accessToken: string;
  let refreshToken: string;
  let userId: string;

  test.beforeAll(async ({ request }) => {
    // Register and login to get tokens
    const email = `token.test.${timestamp}@example.com`;
    const password = 'TokenTest123!';

    await request.post(`${API_BASE}/auth/register`, {
      data: { email, password, name: 'Token Test User' },
    });

    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email, password },
    });

    const body = await loginResponse.json();
    accessToken = body.accessToken;
    refreshToken = body.refreshToken;
    userId = body.user.id;
  });

  test('GET /api/auth/me should return current user (200)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('id', userId);
    expect(body).toHaveProperty('email');
    expect(body).not.toHaveProperty('password');

    console.log('✅ GET /auth/me returned current user (200)');
  });

  test('GET /api/auth/me should reject without token (401)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/auth/me`);

    expect(response.status()).toBe(401);
    console.log('✅ GET /auth/me rejected without token (401)');
  });

  test('GET /api/auth/me should reject with invalid token (401)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: 'Bearer invalid.token.here',
      },
    });

    expect(response.status()).toBe(401);
    console.log('✅ GET /auth/me rejected with invalid token (401)');
  });

  test('POST /api/auth/refresh should renew access token (200)', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/refresh`, {
      data: {
        refreshToken,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');

    // New access token should be different from original
    expect(body.accessToken).not.toBe(accessToken);

    // Verify new token works
    const meResponse = await request.get(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${body.accessToken}`,
      },
    });
    expect(meResponse.status()).toBe(200);

    console.log('✅ Token refreshed successfully (200)');
  });

  test('POST /api/auth/refresh should reject invalid refresh token (401)', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/refresh`, {
      data: {
        refreshToken: 'invalid-refresh-token',
      },
    });

    expect(response.status()).toBe(401);
    console.log('✅ Invalid refresh token rejected (401)');
  });

  test('POST /api/auth/logout should invalidate session (204)', async ({ request }) => {
    // Create new user for logout test
    const email = `logout.test.${timestamp}@example.com`;
    const password = 'LogoutTest123!';

    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: { email, password, name: 'Logout Test' },
    });

    const { accessToken: token, refreshToken: refresh } = await registerResponse.json();

    // Logout
    const logoutResponse = await request.post(`${API_BASE}/auth/logout`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(logoutResponse.status()).toBe(204);

    // Verify access token no longer works
    const meResponse = await request.get(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(meResponse.status()).toBe(401);

    // Verify refresh token no longer works
    const refreshResponse = await request.post(`${API_BASE}/auth/refresh`, {
      data: { refreshToken: refresh },
    });
    expect(refreshResponse.status()).toBe(401);

    console.log('✅ Logout invalidated session (204)');
  });

  test('POST /api/auth/logout should reject without token (401)', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/logout`);

    expect(response.status()).toBe(401);
    console.log('✅ Logout without token rejected (401)');
  });
});

test.describe('Authentication API - Protected Routes', () => {
  test('Protected routes should require JWT (401)', async ({ request }) => {
    const protectedEndpoints = [
      { method: 'GET', path: '/api/queue' },
      { method: 'GET', path: '/api/settings/user' },
    ];

    for (const endpoint of protectedEndpoints) {
      let response;

      if (endpoint.method === 'GET') {
        response = await request.get(`${BASE_URL}${endpoint.path}`);
      } else {
        response = await request.post(`${BASE_URL}${endpoint.path}`);
      }

      expect(
        response.status(),
        `${endpoint.method} ${endpoint.path} should return 401 without token`
      ).toBe(401);
    }

    console.log('✅ Protected routes require JWT (401)');
  });

  test('Protected routes should accept valid JWT (not 401)', async ({ request }) => {
    // Register and login to get valid token
    const email = `protected.test.${timestamp}@example.com`;
    const password = 'ProtectedTest123!';

    await request.post(`${API_BASE}/auth/register`, {
      data: { email, password, name: 'Protected Test' },
    });

    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email, password },
    });

    const { accessToken } = await loginResponse.json();

    // Test protected endpoint with valid token
    const response = await request.get(`${BASE_URL}/api/queue`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Should NOT return 401 (may return 200, 404, etc. depending on implementation)
    expect(response.status()).not.toBe(401);
    console.log('✅ Protected routes accept valid JWT');
  });
});

test.describe('Authentication API - Security Validation', () => {
  test('Password should never be leaked in any response', async ({ request }) => {
    const email = `security.${timestamp}@example.com`;
    const password = 'SecurityTest123!';

    // Test registration response
    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: { email, password, name: 'Security Test' },
    });
    const registerBody = await registerResponse.json();
    expect(JSON.stringify(registerBody).toLowerCase()).not.toContain(password.toLowerCase());
    expect(registerBody.user).not.toHaveProperty('password');

    // Test login response
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email, password },
    });
    const loginBody = await loginResponse.json();
    expect(JSON.stringify(loginBody).toLowerCase()).not.toContain(password.toLowerCase());
    expect(loginBody.user).not.toHaveProperty('password');

    // Test /me response
    const meResponse = await request.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${loginBody.accessToken}` },
    });
    const meBody = await meResponse.json();
    expect(JSON.stringify(meBody).toLowerCase()).not.toContain(password.toLowerCase());
    expect(meBody).not.toHaveProperty('password');

    console.log('✅ Password never leaked in responses');
  });

  test('JWT should contain expected payload structure', async ({ request }) => {
    const email = `jwt.${timestamp}@example.com`;
    const password = 'JwtTest123!';

    await request.post(`${API_BASE}/auth/register`, {
      data: { email, password, name: 'JWT Test' },
    });

    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { email, password },
    });

    const { accessToken } = await loginResponse.json();

    // Decode JWT payload (middle segment)
    const payloadBase64 = accessToken.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());

    // Verify payload structure
    expect(payload).toHaveProperty('sub'); // User ID
    expect(payload).toHaveProperty('email', email);
    expect(payload).toHaveProperty('iat'); // Issued at
    expect(payload).toHaveProperty('exp'); // Expiration

    // Verify expiration is in the future
    const now = Math.floor(Date.now() / 1000);
    expect(payload.exp).toBeGreaterThan(now);

    console.log('✅ JWT payload structure validated');
  });
});
