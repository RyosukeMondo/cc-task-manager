# E2E Testing with Playwright

## Quick Start

```bash
# 1. Install Playwright (first time only)
pnpm add -D @playwright/test
pnpm exec playwright install chromium

# 2. Setup test users (first time only)
./e2e/setup-test-users.sh

# 3. Run all tests
pnpm test:e2e

# Or run specific test suites:
pnpm test:e2e:smoke        # Quick smoke tests (no auth)
pnpm test:e2e:auth         # Authentication tests
pnpm test:e2e:pages        # Authenticated page tests
pnpm test:e2e:tasks        # Task CRUD operations

# Interactive debugging:
pnpm test:e2e:ui           # Visual test runner (recommended)
pnpm test:e2e:headed       # Watch tests run in browser
pnpm test:e2e:debug        # Step-through debugging
```

## What This Solves

**Problem:** Manual "try access → got error → fix → repeat" loop

**Solution:** Automated tests catch errors across all pages in 30 seconds

```
Before: Manually visit each page, try features, report errors
After:  pnpm test:e2e (automatically tests 7 pages + auth + CRUD)
```

## Test Suites

### 1. Smoke Tests (`smoke.spec.ts`)
Quick validation that core pages load without runtime errors.

**Tests:**
- ✅ All 7 pages load without Next.js error overlay
- ✅ No console errors or unhandled exceptions
- ✅ WebSocket connections establish successfully
- ✅ Key page elements render correctly

**Pages covered:**
- Dashboard, Tasks (all/active/completed)
- Analytics (performance/trends), Settings

### 2. Authentication Tests (`auth.spec.ts`)
Comprehensive authentication flow testing.

**Tests:**
- ✅ Login form displays correctly
- ✅ Valid credentials authenticate successfully
- ✅ Invalid credentials show error messages
- ✅ Unauthenticated users redirect to login
- ✅ Authentication persists across navigation
- ✅ Return URL preserved after login
- ✅ Logout functionality works

### 3. Authenticated Pages Tests (`authenticated-pages.spec.ts`)
Tests all pages with authenticated user context.

**Tests:**
- ✅ All pages load for authenticated users
- ✅ No redirects to login page
- ✅ Navigation between pages works
- ✅ Page content renders correctly
- ✅ No runtime errors with real user session

### 4. Task Operations Tests (`task-operations.spec.ts`)
Tests CRUD operations and real-time updates.

**Tests:**
- ✅ Task list displays correctly
- ✅ Create new tasks (UI and API)
- ✅ Filter tasks by status
- ✅ Search/filter functionality
- ✅ Task detail view
- ✅ WebSocket real-time updates
- ✅ Proper cleanup after tests

## Test Users

The test suite uses three test users with different roles:

```typescript
admin@test.com / Admin123!    // Full admin access
user@test.com / User123!      // Standard user access
viewer@test.com / Viewer123!  // Read-only access
```

**Setup:** Run `./e2e/setup-test-users.sh` to create these users in your database.

## Commands Reference

### Run Tests
```bash
pnpm test:e2e              # Run all E2E tests
pnpm test:e2e:smoke        # Smoke tests only
pnpm test:e2e:auth         # Auth tests only
pnpm test:e2e:pages        # Authenticated pages only
pnpm test:e2e:tasks        # Task operations only
pnpm test:e2e:ui           # Interactive UI mode
pnpm test:e2e:headed       # Watch browser during tests
pnpm test:e2e:debug        # Debug mode with inspector
pnpm test:e2e:report       # View last test report
```

### Watch Mode
```bash
./e2e/watch-and-test.sh    # Auto-run smoke tests on file changes
```

## Configuration

Tests are configured in `playwright.config.ts`:

- **Base URL:** `http://localhost:3006` (frontend dev server)
- **Browsers:** Chromium, Firefox, WebKit, Mobile (Chrome & Safari)
- **Retries:** 2 retries in CI, 0 locally
- **Screenshots:** Captured on failure
- **Videos:** Retained on failure
- **Traces:** Captured on first retry

## Fixtures and Helpers

### Authentication (`e2e/fixtures/auth.ts`)
```typescript
import { login, logout, isAuthenticated, TEST_USERS } from './fixtures/auth';

// Login as specific role
await login(page, 'user');     // or 'admin', 'viewer'

// Check authentication
const authenticated = await isAuthenticated(page);

// Logout
await logout(page);
```

### Task Operations (`e2e/fixtures/tasks.ts`)
```typescript
import { createTask, deleteTask, getTasks, SAMPLE_TASKS } from './fixtures/tasks';

// Create task via API (faster than UI)
const taskId = await createTask(page, 'basic');

// Create with custom data
const taskId = await createTask(page, 'urgent', {
  name: 'Custom Task Name',
});

// Cleanup
await deleteTask(page, taskId);
```

## Troubleshooting

### Tests fail with "Cannot connect to localhost:3006"
**Solution:** Start dev server first: `pnpm dev`

### Tests fail with "Invalid credentials"
**Solution:** Run setup script: `./e2e/setup-test-users.sh`

### WebSocket tests timeout
**Solution:** Ensure backend is running on port 3005: `pm2 status`

### Tests are flaky
**Solutions:**
- Use `pnpm test:e2e:headed` to watch what's happening
- Use `pnpm test:e2e:debug` to step through
- Check `playwright-report/` for screenshots/videos
- Increase timeout in test if legitimate slow operation

## Best Practices

1. **Use fixtures** for setup/teardown (auth, test data)
2. **Avoid sleeps** - use `waitForLoadState('networkidle')` instead
3. **Clean up** - delete test data in `afterEach` hooks
4. **Use data-testid** for stable selectors (add to components)
5. **Test user journeys** - not just individual features
6. **Run locally** before pushing to catch issues early

## Adding New Tests

```typescript
// e2e/my-feature.spec.ts
import { test, expect } from '@playwright/test';
import { login } from './fixtures/auth';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Login
    await login(page, 'user');

    // Setup: Navigate to feature
    await page.goto('/my-feature');
  });

  test('should do something', async ({ page }) => {
    // Arrange: Setup test data

    // Act: Perform action
    await page.click('button[data-testid="my-button"]');

    // Assert: Verify result
    await expect(page.locator('.result')).toContainText('Success');
  });
});
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/e2e.yml
- name: Run E2E Tests
  run: |
    pnpm test:e2e
  env:
    CI: true
```

Tests automatically:
- Run in headless mode
- Retry 2 times on failure
- Generate HTML report
- Capture screenshots/videos on failure
