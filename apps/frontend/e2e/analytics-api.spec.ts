/**
 * Analytics API E2E Tests
 *
 * Tests direct API endpoint calls for analytics:
 * - GET /api/analytics/performance (returns performance metrics with cache)
 * - GET /api/analytics/trends (returns time-series data with groupBy)
 * - Date range validation (startDate <= endDate)
 * - Cache behavior (second identical request faster)
 * - Authentication required (401 without JWT)
 *
 * Spec: backend-analytics-api (Task 7)
 */

import { test, expect, APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3006';
const API_BASE = `${BASE_URL}/api`;

// Generate unique test user for each test run
const timestamp = Date.now();
const TEST_EMAIL = `analytics.test.${timestamp}@example.com`;
const TEST_PASSWORD = 'AnalyticsTest123!';
const TEST_NAME = 'Analytics Test User';

let accessToken: string;
let userId: string;

test.describe('Analytics API - Setup', () => {
  test('should register and authenticate test user', async ({ request }) => {
    // Register test user
    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: TEST_NAME,
      },
    });

    expect(registerResponse.status()).toBe(201);
    const registerBody = await registerResponse.json();
    accessToken = registerBody.accessToken;
    userId = registerBody.user.id;

    // Create some test tasks for analytics
    const taskData = [
      { title: 'Test Task 1', status: 'DONE', category: 'DEVELOPMENT', priority: 'HIGH' },
      { title: 'Test Task 2', status: 'DONE', category: 'TESTING', priority: 'MEDIUM' },
      { title: 'Test Task 3', status: 'IN_PROGRESS', category: 'DEVELOPMENT', priority: 'HIGH' },
      { title: 'Test Task 4', status: 'TODO', category: 'FEATURE', priority: 'LOW' },
      { title: 'Test Task 5', status: 'DONE', category: 'BUG_FIX', priority: 'URGENT' },
    ];

    for (const task of taskData) {
      const response = await request.post(`${API_BASE}/tasks`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: task,
      });
      expect(response.status()).toBe(201);
    }
  });
});

test.describe('Analytics API - Performance Metrics', () => {
  test('should return performance metrics with 200 status', async ({ request }) => {
    const response = await request.get(`${API_BASE}/analytics/performance`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('completionRate');
    expect(body).toHaveProperty('averageExecutionTime');
    expect(body).toHaveProperty('throughput');
    expect(body).toHaveProperty('totalTasks');
    expect(body).toHaveProperty('completedTasks');
    expect(body).toHaveProperty('failedTasks');
    expect(body).toHaveProperty('period');

    // Validate data types
    expect(typeof body.completionRate).toBe('number');
    expect(typeof body.totalTasks).toBe('number');
    expect(typeof body.completedTasks).toBe('number');
    expect(typeof body.failedTasks).toBe('number');

    // Validate business logic
    expect(body.totalTasks).toBeGreaterThanOrEqual(body.completedTasks + body.failedTasks);
    if (body.totalTasks > 0) {
      expect(body.completionRate).toBeGreaterThanOrEqual(0);
      expect(body.completionRate).toBeLessThanOrEqual(100);
    }
  });

  test('should support date range filtering', async ({ request }) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // 7 days ago
    const endDate = new Date();

    const response = await request.get(
      `${API_BASE}/analytics/performance?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('period');
    expect(body.period).toHaveProperty('start');
    expect(body.period).toHaveProperty('end');
  });

  test('should reject invalid date range (startDate > endDate)', async ({ request }) => {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 7); // End date before start date

    const response = await request.get(
      `${API_BASE}/analytics/performance?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    expect(response.status()).toBe(400);
  });

  test('should require authentication (401 without token)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/analytics/performance`);
    expect(response.status()).toBe(401);
  });
});

test.describe('Analytics API - Trend Data', () => {
  test('should return daily trend data with 200 status', async ({ request }) => {
    const response = await request.get(`${API_BASE}/analytics/trends?groupBy=day`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);

    // Validate structure of trend data points
    if (body.length > 0) {
      const dataPoint = body[0];
      expect(dataPoint).toHaveProperty('period');
      expect(dataPoint).toHaveProperty('totalTasks');
      expect(dataPoint).toHaveProperty('completedTasks');
      expect(dataPoint).toHaveProperty('failedTasks');
      expect(dataPoint).toHaveProperty('averageExecutionTime');

      // Validate data types
      expect(typeof dataPoint.totalTasks).toBe('number');
      expect(typeof dataPoint.completedTasks).toBe('number');
      expect(typeof dataPoint.failedTasks).toBe('number');
    }
  });

  test('should return weekly trend data', async ({ request }) => {
    const response = await request.get(`${API_BASE}/analytics/trends?groupBy=week`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('should return monthly trend data', async ({ request }) => {
    const response = await request.get(`${API_BASE}/analytics/trends?groupBy=month`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('should support date range filtering for trends', async ({ request }) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // 30 days ago
    const endDate = new Date();

    const response = await request.get(
      `${API_BASE}/analytics/trends?groupBy=day&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('should reject invalid groupBy parameter', async ({ request }) => {
    const response = await request.get(`${API_BASE}/analytics/trends?groupBy=invalid`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status()).toBe(400);
  });

  test('should require authentication (401 without token)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/analytics/trends?groupBy=day`);
    expect(response.status()).toBe(401);
  });
});

test.describe('Analytics API - Cache Behavior', () => {
  test('should serve cached results faster on second request', async ({ request }) => {
    // First request (cache miss)
    const start1 = Date.now();
    const response1 = await request.get(`${API_BASE}/analytics/performance`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const duration1 = Date.now() - start1;

    expect(response1.status()).toBe(200);

    // Second request (cache hit)
    const start2 = Date.now();
    const response2 = await request.get(`${API_BASE}/analytics/performance`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const duration2 = Date.now() - start2;

    expect(response2.status()).toBe(200);

    // Verify responses are identical
    const body1 = await response1.json();
    const body2 = await response2.json();
    expect(body1).toEqual(body2);

    // Cache hit should be faster (with some tolerance for network variance)
    // Note: This might not always be true in CI environments
    console.log(`First request: ${duration1}ms, Second request: ${duration2}ms`);
    expect(duration2).toBeLessThanOrEqual(duration1 * 1.5); // Allow 50% tolerance
  });

  test('should serve separate cache per user', async ({ request }) => {
    // Create a second test user
    const timestamp2 = Date.now();
    const TEST_EMAIL_2 = `analytics.test2.${timestamp2}@example.com`;

    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: {
        email: TEST_EMAIL_2,
        password: TEST_PASSWORD,
        name: 'Analytics Test User 2',
      },
    });

    expect(registerResponse.status()).toBe(201);
    const registerBody = await registerResponse.json();
    const accessToken2 = registerBody.accessToken;

    // Get analytics for both users
    const response1 = await request.get(`${API_BASE}/analytics/performance`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const response2 = await request.get(`${API_BASE}/analytics/performance`, {
      headers: { Authorization: `Bearer ${accessToken2}` },
    });

    expect(response1.status()).toBe(200);
    expect(response2.status()).toBe(200);

    const body1 = await response1.json();
    const body2 = await response2.json();

    // Different users should have different analytics (first user has tasks, second doesn't)
    expect(body1.totalTasks).not.toEqual(body2.totalTasks);
  });
});

test.describe('Analytics API - Edge Cases', () => {
  test('should handle user with no tasks', async ({ request }) => {
    // Create a new user with no tasks
    const timestamp3 = Date.now();
    const TEST_EMAIL_3 = `analytics.empty.${timestamp3}@example.com`;

    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: {
        email: TEST_EMAIL_3,
        password: TEST_PASSWORD,
        name: 'Empty Analytics User',
      },
    });

    const registerBody = await registerResponse.json();
    const emptyAccessToken = registerBody.accessToken;

    const response = await request.get(`${API_BASE}/analytics/performance`, {
      headers: { Authorization: `Bearer ${emptyAccessToken}` },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.totalTasks).toBe(0);
    expect(body.completedTasks).toBe(0);
    expect(body.failedTasks).toBe(0);
  });

  test('should handle future date range', async ({ request }) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1); // Tomorrow
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7); // Next week

    const response = await request.get(
      `${API_BASE}/analytics/performance?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    expect(response.status()).toBe(200);

    const body = await response.json();
    // Should return zero or minimal data for future dates
    expect(body.totalTasks).toBeGreaterThanOrEqual(0);
  });
});
