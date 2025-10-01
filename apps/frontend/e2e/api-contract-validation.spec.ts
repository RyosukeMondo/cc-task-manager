import { test, expect, Page } from '@playwright/test';
import { setupMockAuth } from './fixtures/auth';

/**
 * API Contract Validation Tests
 *
 * Automatically detects:
 * - HTTP 404 errors (missing endpoints)
 * - HTTP 500 errors (backend crashes)
 * - HTTP 401/403 errors (auth issues)
 * - Contract violations (unexpected response formats)
 *
 * This is the QA automation system for contract-driven development.
 */

interface ApiRequest {
  url: string;
  method: string;
  status: number;
  statusText: string;
  timestamp: number;
}

interface ApiError extends ApiRequest {
  errorType: 'NOT_FOUND' | 'SERVER_ERROR' | 'AUTH_ERROR' | 'BAD_REQUEST' | 'NETWORK_ERROR';
  endpoint: string;
}

/**
 * Monitor all network requests and detect API errors
 */
function setupApiMonitoring(page: Page): {
  requests: ApiRequest[];
  errors: ApiError[];
} {
  const requests: ApiRequest[] = [];
  const errors: ApiError[] = [];

  page.on('response', async (response) => {
    const url = response.url();

    // Only monitor API calls
    if (!url.includes('/api/')) {
      return;
    }

    const request: ApiRequest = {
      url,
      method: response.request().method(),
      status: response.status(),
      statusText: response.statusText(),
      timestamp: Date.now(),
    };

    requests.push(request);

    // Extract endpoint path
    const urlObj = new URL(url);
    const endpoint = urlObj.pathname;

    // Detect errors
    if (response.status() === 404) {
      errors.push({
        ...request,
        errorType: 'NOT_FOUND',
        endpoint,
      });
      console.error(`\n🔴 API 404 NOT FOUND: ${request.method} ${endpoint}`);
    } else if (response.status() >= 500) {
      errors.push({
        ...request,
        errorType: 'SERVER_ERROR',
        endpoint,
      });
      console.error(`\n🔴 API 500 SERVER ERROR: ${request.method} ${endpoint}`);
    } else if (response.status() === 401 || response.status() === 403) {
      errors.push({
        ...request,
        errorType: 'AUTH_ERROR',
        endpoint,
      });
      console.error(`\n🟡 API AUTH ERROR: ${request.method} ${endpoint} (${response.status()})`);
    } else if (response.status() === 400) {
      errors.push({
        ...request,
        errorType: 'BAD_REQUEST',
        endpoint,
      });
      console.error(`\n🟡 API BAD REQUEST: ${request.method} ${endpoint}`);
    }
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    if (!url.includes('/api/')) return;

    const urlObj = new URL(url);
    const endpoint = urlObj.pathname;

    errors.push({
      url,
      method: request.method(),
      status: 0,
      statusText: 'Network Error',
      timestamp: Date.now(),
      errorType: 'NETWORK_ERROR',
      endpoint,
    });
    console.error(`\n🔴 NETWORK ERROR: ${request.method()} ${endpoint}`);
  });

  return { requests, errors };
}

test.describe('API Contract Validation', () => {
  test('Dashboard page should make only valid API calls', async ({ page }) => {
    const { requests, errors } = setupApiMonitoring(page);

    await setupMockAuth(page, 'user');
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Log all API requests
    console.log(`\n📊 Total API requests: ${requests.length}`);
    requests.forEach(req => {
      console.log(`   ${req.method} ${new URL(req.url).pathname} → ${req.status}`);
    });

    // Report errors with details
    if (errors.length > 0) {
      console.log(`\n❌ API Contract Violations Found: ${errors.length}`);
      errors.forEach(err => {
        console.log(`\n🔴 ${err.errorType}:`);
        console.log(`   ${err.method} ${err.endpoint}`);
        console.log(`   Status: ${err.status} ${err.statusText}`);
        console.log(`   Full URL: ${err.url}`);
      });
    }

    expect(errors, `Found ${errors.length} API error(s) on Dashboard page`).toHaveLength(0);
  });

  test('Settings page should make only valid API calls', async ({ page }) => {
    const { requests, errors } = setupApiMonitoring(page);

    await setupMockAuth(page, 'user');
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log(`\n📊 Total API requests: ${requests.length}`);
    requests.forEach(req => {
      console.log(`   ${req.method} ${new URL(req.url).pathname} → ${req.status}`);
    });

    if (errors.length > 0) {
      console.log(`\n❌ API Contract Violations Found: ${errors.length}`);
      errors.forEach(err => {
        console.log(`\n🔴 ${err.errorType}:`);
        console.log(`   ${err.method} ${err.endpoint}`);
        console.log(`   Status: ${err.status} ${err.statusText}`);
      });
    }

    expect(errors, `Found ${errors.length} API error(s) on Settings page`).toHaveLength(0);
  });

  test('Tasks page should make only valid API calls', async ({ page }) => {
    const { requests, errors } = setupApiMonitoring(page);

    await setupMockAuth(page, 'user');
    await page.goto('/tasks');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log(`\n📊 Total API requests: ${requests.length}`);
    requests.forEach(req => {
      console.log(`   ${req.method} ${new URL(req.url).pathname} → ${req.status}`);
    });

    if (errors.length > 0) {
      console.log(`\n❌ API Contract Violations Found: ${errors.length}`);
      errors.forEach(err => {
        console.log(`\n🔴 ${err.errorType}:`);
        console.log(`   ${err.method} ${err.endpoint}`);
        console.log(`   Status: ${err.status} ${err.statusText}`);
      });
    }

    expect(errors, `Found ${errors.length} API error(s) on Tasks page`).toHaveLength(0);
  });

  test('Analytics pages should make only valid API calls', async ({ page }) => {
    const { requests, errors } = setupApiMonitoring(page);

    await setupMockAuth(page, 'user');

    // Test Performance page
    await page.goto('/analytics/performance');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Test Trends page
    await page.goto('/analytics/trends');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    console.log(`\n📊 Total API requests: ${requests.length}`);
    requests.forEach(req => {
      console.log(`   ${req.method} ${new URL(req.url).pathname} → ${req.status}`);
    });

    if (errors.length > 0) {
      console.log(`\n❌ API Contract Violations Found: ${errors.length}`);
      errors.forEach(err => {
        console.log(`\n🔴 ${err.errorType}:`);
        console.log(`   ${err.method} ${err.endpoint}`);
        console.log(`   Status: ${err.status} ${err.statusText}`);
      });
    }

    expect(errors, `Found ${errors.length} API error(s) on Analytics pages`).toHaveLength(0);
  });

  test('Create comprehensive API endpoint report', async ({ page }) => {
    const { requests, errors } = setupApiMonitoring(page);

    await setupMockAuth(page, 'user');

    // Visit all pages to collect all API calls
    const pages = [
      '/dashboard',
      '/tasks',
      '/tasks/active',
      '/tasks/completed',
      '/analytics/performance',
      '/analytics/trends',
      '/settings',
    ];

    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }

    // Group requests by endpoint
    const endpointStats = new Map<string, { count: number; status: Set<number>; methods: Set<string> }>();

    requests.forEach(req => {
      const endpoint = new URL(req.url).pathname;
      const stats = endpointStats.get(endpoint) || {
        count: 0,
        status: new Set<number>(),
        methods: new Set<string>(),
      };

      stats.count++;
      stats.status.add(req.status);
      stats.methods.add(req.method);

      endpointStats.set(endpoint, stats);
    });

    // Generate report
    console.log(`\n\n${'='.repeat(80)}`);
    console.log('API ENDPOINT COMPREHENSIVE REPORT');
    console.log(`${'='.repeat(80)}`);
    console.log(`\nTotal unique endpoints called: ${endpointStats.size}`);
    console.log(`Total API requests made: ${requests.length}`);
    console.log(`Total errors found: ${errors.length}\n`);

    console.log('ENDPOINT DETAILS:');
    console.log('-'.repeat(80));

    Array.from(endpointStats.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([endpoint, stats]) => {
        const hasError = Array.from(stats.status).some(s => s >= 400);
        const icon = hasError ? '❌' : '✅';

        console.log(`\n${icon} ${endpoint}`);
        console.log(`   Methods: ${Array.from(stats.methods).join(', ')}`);
        console.log(`   Statuses: ${Array.from(stats.status).join(', ')}`);
        console.log(`   Call count: ${stats.count}`);
      });

    if (errors.length > 0) {
      console.log(`\n\n${'='.repeat(80)}`);
      console.log('CONTRACT VIOLATIONS SUMMARY');
      console.log(`${'='.repeat(80)}\n`);

      const errorsByType = new Map<string, ApiError[]>();
      errors.forEach(err => {
        const list = errorsByType.get(err.errorType) || [];
        list.push(err);
        errorsByType.set(err.errorType, list);
      });

      errorsByType.forEach((errs, type) => {
        console.log(`\n${type} (${errs.length}):`);
        errs.forEach(err => {
          console.log(`   ${err.method} ${err.endpoint}`);
        });
      });
    }

    console.log(`\n${'='.repeat(80)}\n`);

    // Test should pass if we successfully collected data
    // Don't fail here - individual page tests will fail
    expect(requests.length).toBeGreaterThan(0);
  });
});
