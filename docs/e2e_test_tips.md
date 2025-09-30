# E2E Testing Tips & Best Practices

> **Goal**: Automate error detection to eliminate the manual "try → error → fix" loop

## Table of Contents
1. [Overview](#overview)
2. [Automatic Error Detection](#automatic-error-detection)
3. [Common Runtime Errors & Fixes](#common-runtime-errors--fixes)
4. [Critical Lessons Learned](#critical-lessons-learned)
5. [Testing Strategy](#testing-strategy)
6. [Best Practices](#best-practices)
7. [UI/UX Error Handling](#uiux-error-handling)
8. [Troubleshooting](#troubleshooting)

---

## Overview

E2E (End-to-End) tests simulate real user interactions with your application. When properly configured, they can **automatically detect runtime errors** that manual testing might miss.

### Why E2E Tests Matter
- ✅ **Catch errors before users do**
- ✅ **Test complete user flows**, not just isolated components
- ✅ **Verify integration** between frontend, backend, and database
- ✅ **Detect regressions** when refactoring
- ✅ **Document expected behavior** through executable specs

---

## Automatic Error Detection

### 1. Setup Error Listeners

The key to automatic error detection is setting up listeners for all types of runtime errors:

```typescript
// Example from runtime-errors.spec.ts
function setupErrorListeners(page: Page): RuntimeError[] {
  const errors: RuntimeError[] = [];

  // Listen for uncaught exceptions (most critical)
  page.on('pageerror', (error) => {
    errors.push({
      message: error.message,
      source: 'pageerror',
      stack: error.stack,
      url: page.url(),
    });
    console.error(`❌ Runtime Error: ${error.message}`);
  });

  // Listen for console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      // Filter out noise (network errors, etc)
      if (!isExpectedError(msg.text())) {
        errors.push({
          message: msg.text(),
          source: 'console.error',
          url: page.url(),
        });
      }
    }
  });

  return errors;
}
```

### 2. Test Pattern for Error Detection

```typescript
test('Page should load without runtime errors', async ({ page }) => {
  const errors = setupErrorListeners(page);

  // Navigate to page
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');

  // Wait for any late-firing errors
  await page.waitForTimeout(2000);

  // Fail test if ANY runtime errors occurred
  expect(errors).toHaveLength(0);

  // Also verify page content loaded correctly
  await expect(page.locator('h1')).toBeVisible();
});
```

### 3. Types of Errors Detected

| Error Type | Example | Detected By |
|------------|---------|-------------|
| **Type Errors** | `Cannot read property 'parseAsync' of undefined` | `pageerror` |
| **Module Import Failures** | `Module not found: @hookform/resolvers` | `pageerror` |
| **Null Reference** | `Cannot read properties of null` | `pageerror` |
| **Async Errors** | Unhandled promise rejections | `pageerror` |
| **Schema Validation** | Zod parse failures | `console.error` |
| **Network Errors** | Failed API calls (400/500 errors) | `console.error` (filtered) |

---

## Common Runtime Errors & Fixes

### Error 1: React Query Compatibility

**Symptom:**
```
TypeError: client.getQueryCache(...).get is not a function
```

**Root Cause:**
TanStack Query v5 removed deprecated `mutationCache` and `queryCache` options.

**Detection:**
```typescript
// E2E test catches this on any page using React Query
test('Dashboard loads without errors', async ({ page }) => {
  const errors = setupErrorListeners(page);
  await page.goto('/dashboard');
  // Error would be caught here: errors.length > 0
});
```

**Fix:**
```typescript
// ❌ BEFORE (v4 syntax - causes error)
const queryClient = new QueryClient({
  defaultOptions: { /* ... */ },
  mutationCache: {
    onError: (error) => { /* ... */ }
  },
  queryCache: {
    onError: (error) => { /* ... */ }
  },
});

// ✅ AFTER (v5 compatible)
const queryClient = new QueryClient({
  defaultOptions: { /* ... */ },
  // Remove mutationCache and queryCache
  // Use global error handling at component level instead
});
```

**File:** `src/lib/api/providers.tsx`

---

### Error 2: Metadata Export in Client Component

**Symptom:**
```
Error: You are attempting to export "metadata" from a component
marked with "use client", which is disallowed.
```

**Root Cause:**
Next.js doesn't allow `export const metadata` in client components.

**Detection:**
```typescript
// E2E test trying to access the page gets 500 error
test('Completed tasks page loads', async ({ page }) => {
  await page.goto('/tasks/completed');
  // Page would fail to compile and return 500
});
```

**Fix:**
```typescript
// ❌ BEFORE
'use client';

export default function Page() { /* ... */ }

export const metadata = {
  title: 'Page Title',
};

// ✅ AFTER (Option 1: Remove metadata)
'use client';

export default function Page() { /* ... */ }

// ✅ AFTER (Option 2: Move to server component wrapper)
// layout.tsx or separate server component
export const metadata = {
  title: 'Page Title',
};
```

**File:** `src/app/tasks/completed/page.tsx`

---

### Error 3: Zod Schema Import/Resolution

**Symptom:**
```
TypeError: Cannot read properties of undefined (reading 'parseAsync')
```

**Root Cause:**
- Schema not exported correctly from package
- Package not built after changes
- Module resolution issue in monorepo

**Detection:**
```typescript
// E2E test with error listeners catches this immediately
test('Settings page loads without errors', async ({ page }) => {
  const errors = setupErrorListeners(page);
  await page.goto('/settings');
  // Error caught: zodResolver receives undefined schema
});
```

**Fix:**
```bash
# 1. Rebuild schemas package
cd packages/schemas
pnpm build

# 2. Verify export exists
grep "UserProfileSchema" dist/settings/settings.schemas.js

# 3. Restart dev server to pick up changes
cd ../../apps/frontend
pnpm dev
```

**Prevention:**
- Always run `pnpm build:packages:dev` before starting frontend
- Add schema validation in tests
- Use workspace protocol (`workspace:*`) in package.json

---

### Error 4: Client-Side Rendering Delays

**Symptom:**
```
TimeoutError: page.waitForSelector: Timeout exceeded
```

**Root Cause:**
Next.js 14+ uses React Server Components (RSC) with streaming. Forms and interactive elements are client-rendered **after** initial HTML.

**Detection:**
```typescript
// Login helper times out waiting for form
await page.goto('/login');
await page.waitForSelector('#email'); // ❌ Times out!
```

**Fix:**
```typescript
// ✅ Wait for network idle (all JS loaded)
await page.goto('/login', { waitUntil: 'networkidle' });

// ✅ Increase timeout for client rendering
await page.waitForSelector('#email', {
  state: 'visible',
  timeout: 30000 // Give client time to hydrate
});

// ✅ Add explicit hydration wait
await page.waitForTimeout(1000);
```

**File:** `e2e/fixtures/auth.ts`

---

## Critical Lessons Learned

### Lesson 1: Test User Interactions, Not Just Page Loads

**The Problem:**
Initial testing only checked if pages loaded without errors. However, clicking tabs, buttons, or interacting with forms revealed **hidden runtime errors** that only trigger on user interaction.

**Real Example:**
```typescript
// ❌ INSUFFICIENT: Only tests page load
test('Settings page loads', async ({ page }) => {
  await page.goto('/settings');
  expect(errors).toHaveLength(0); // ✅ Passes!
});

// ✅ COMPREHENSIVE: Tests actual user interactions
test('Settings tabs work', async ({ page }) => {
  await page.goto('/settings');

  // Click Preferences tab
  await page.locator('[role="tab"]', { hasText: /Preferences/i }).click();
  // ❌ CRASHES: Theme.SYSTEM is undefined!

  expect(errors).toHaveLength(0); // Test would have failed here
});
```

**Bug Discovered:**
When clicking the Preferences tab, `Theme.SYSTEM` was undefined because TypeScript enums from `@cc-task-manager/schemas` weren't resolving in the browser (webpack bundling issue).

**Fix:**
Define enums inline in the component as a workaround until proper ESM module resolution is configured.

**Lesson:**
**Always test user interactions**, not just initial page renders. Create interaction tests:
- Click all tabs/buttons
- Fill out forms
- Toggle switches
- Select dropdowns
- Submit forms

---

### Lesson 2: Monorepo Package Import Issues

**The Problem:**
Schemas and enums imported from shared packages (`@cc-task-manager/schemas`) were `undefined` in browser context, even though:
- ✅ Package builds successfully
- ✅ Types work in IDE
- ✅ Node.js can require the package
- ❌ **Webpack fails to bundle it for the browser**

**Root Cause:**
CommonJS packages with `main: "dist/index.js"` don't provide proper ESM exports for modern bundlers.

**Detection:**
```typescript
// Add debugging to component (temporarily)
console.log('UserProfileSchema:', UserProfileSchema);
// Output in browser: undefined
// Output in Node: { _def: {...}, parse: [Function] }
```

**Fix (Temporary Workaround):**
```typescript
// Define schemas inline until package.json exports are fixed
const UserProfileSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email().max(255).trim().toLowerCase(),
  avatar: z.string().url().max(2048).optional().nullable(),
  bio: z.string().max(500).trim().optional().nullable(),
});
```

**Fix (Proper Solution):**
Update `packages/schemas/package.json`:
```json
{
  "main": "dist/index.js",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "sideEffects": false
}
```

**Lesson:**
- Test imports in **browser context**, not just Node.js
- Add console.log debugging in components to verify imports
- Use `exports` field for modern package resolution

---

### Lesson 3: Test ALL Imports at Component Initialization

**The Problem:**
Schemas were imported but **only used inside form initialization** (inside component function). E2E tests that just loaded the page didn't trigger the form code path.

**Example:**
```typescript
export function ProfileSettings() {
  // ✅ Component renders - page loads successfully

  const form = useForm({
    // ❌ ERROR HERE: UserProfileSchema is undefined
    // But this only executes when component actually mounts!
    resolver: zodResolver(UserProfileSchema),
  });

  return <div>...</div>;
}
```

**Why Tests Passed:**
```typescript
// Test loaded /settings page
await page.goto('/settings');
// ProfileSettings component rendered
// But the Profile tab content was LAZY loaded
// Form initialization never happened!
```

**Fix:**
```typescript
// Add test that actually clicks tabs and triggers component mount
test('Settings Preferences tab works', async ({ page }) => {
  await page.goto('/settings');

  // Click the tab - THIS triggers component mount + form init
  await page.locator('[role="tab"]', { hasText: /Preferences/i }).click();

  // Now the error would be caught
  expect(errors).toHaveLength(0);
});
```

**Lesson:**
Create E2E tests for **tab switches**, **modal opens**, **accordion expands**, and any lazy-loaded content.

---

### Lesson 4: UI/UX for Missing/Error States

**The Problem:**
When no user settings exist in the database, the UI shows:
```
HTTP 404: Not Found
```

This is technically correct (no resource exists) but creates a **terrible user experience**.

**Better Approaches:**

**Option 1: Initialize Default Settings (Backend)**
```typescript
// backend/src/settings/settings.service.ts
async getSettings(userId: string) {
  let settings = await this.db.findOne({ userId });

  // Auto-create if not exists
  if (!settings) {
    settings = await this.db.create({
      userId,
      profile: { name: '', email: '' },
      preferences: { theme: 'system', language: 'en', ... },
      notifications: { emailNotifications: true, ... },
    });
  }

  return settings;
}
```

**Option 2: Handle in Frontend (Empty State UI)**
```typescript
// frontend/src/app/settings/page.tsx
function SettingsPage() {
  const { data, error, isLoading } = useSettings();

  if (isLoading) return <LoadingSpinner />;

  if (error?.status === 404) {
    return (
      <EmptyState
        icon={<Settings />}
        title="Welcome! Let's set up your preferences"
        description="Create your profile and customize your experience"
        action={
          <Button onClick={createDefaultSettings}>
            Get Started
          </Button>
        }
      />
    );
  }

  return <SettingsForm data={data} />;
}
```

**Lesson:**
- Never show raw HTTP errors to users
- 404 = Create empty state with helpful guidance
- 500 = Show "Something went wrong" with retry button
- Missing data = Auto-initialize or guide user to create it

---

### Lesson 5: Why Initial Testing Missed These Issues

**Root Cause Analysis:**

1. **Incomplete Test Coverage**
   - ❌ Only tested page loads
   - ❌ Didn't test tab clicks, button clicks, form interactions
   - ❌ Didn't test API error responses (404, 500)

2. **Narrow Error Scope**
   - ❌ Assumed working in Node = working in browser
   - ❌ Didn't verify imports in browser console
   - ❌ Didn't test lazy-loaded components

3. **Missing UI/UX Review**
   - ❌ Didn't think about "What if no data exists?"
   - ❌ Didn't consider user experience for error states
   - ❌ Focused on "does it work?" not "is it usable?"

**How to Be More Thorough:**

✅ **Comprehensive E2E Test Matrix:**
```typescript
// For each page:
✅ Page loads without errors
✅ All tabs/accordions can be opened
✅ All buttons can be clicked
✅ All forms can be filled and submitted
✅ Error states render properly
✅ Empty states render properly
✅ Loading states work
✅ Network errors are handled gracefully
```

✅ **Test in Browser DevTools:**
```javascript
// Open browser console on each page
// Check for:
console.log('Check imports:', {
  schema: UserProfileSchema, // Should NOT be undefined
  enum: Theme.SYSTEM, // Should be 'system'
});

// Click every interactive element
// Watch console for errors
```

✅ **Think Like a User:**
- What happens if I'm a new user with no data?
- What happens if the API is down?
- What happens if I spam-click buttons?
- What happens on slow internet?

---

### Lesson 6: The Test-Driven Detection Mindset

**Old Mindset:** Build feature → Manually test → Find bugs → Fix → Repeat

**New Mindset:** Build feature → Write E2E test → Test finds bugs → Fix → Test passes → Done

**Example Workflow:**

```bash
# 1. Build feature
git checkout -b feature/settings-page

# 2. Write comprehensive E2E test FIRST
cat > e2e/settings-full-flow.spec.ts << 'EOF'
test('Complete settings workflow', async ({ page }) => {
  // Load page
  await page.goto('/settings');

  // Test Profile tab
  await page.click('[role="tab"]:has-text("Profile")');
  await page.fill('input[name="name"]', 'John Doe');
  await page.click('button:has-text("Save")');
  await expect(page.locator('text=saved successfully')).toBeVisible();

  // Test Preferences tab
  await page.click('[role="tab"]:has-text("Preferences")');
  await page.selectOption('select[name="theme"]', 'dark');
  await page.click('button:has-text("Save")');

  // Test Notifications tab
  await page.click('[role="tab"]:has-text("Notifications")');
  await page.check('input[name="emailNotifications"]');
  await page.click('button:has-text("Save")');

  // Verify no errors occurred
  expect(errors).toHaveLength(0);
});
EOF

# 3. Run test (will fail with specific errors)
pnpm test:e2e settings-full-flow

# 4. Fix errors one by one
# - Fix Theme.SYSTEM undefined
# - Fix schema imports
# - Add proper error handling

# 5. Re-run test until it passes
pnpm test:e2e settings-full-flow

# 6. Commit with confidence
git commit -m "feat: settings page with full E2E coverage"
```

**Benefits:**
- ✅ Bugs found **before** code review
- ✅ Prevents regressions
- ✅ Documents expected behavior
- ✅ Faster development (no manual testing)

---

## Testing Strategy

### 1. Test Pyramid

```
      ┌─────────────┐
      │   E2E (10%) │  ← Full user flows
      ├─────────────┤
      │ Integration │  ← API + Component
      │    (30%)    │
      ├─────────────┤
      │    Unit     │  ← Functions + Schemas
      │    (60%)    │
      └─────────────┘
```

### 2. What to Test with E2E

✅ **DO Test:**
- Complete user journeys (register → login → create task → complete)
- Authentication flows
- Page-to-page navigation
- Form submissions with validation
- Real-time features (WebSocket updates)
- Error handling and edge cases

❌ **DON'T Test:**
- Individual function logic (use unit tests)
- CSS styling (use visual regression tests)
- Performance optimization (use Lighthouse/Web Vitals)

### 3. Test Organization

```
e2e/
├── fixtures/
│   ├── auth.ts           # Login/logout helpers
│   ├── tasks.ts          # Task CRUD helpers
│   └── users.ts          # Test user data
├── smoke.spec.ts         # Quick health checks
├── auth.spec.ts          # Authentication flows
├── runtime-errors.spec.ts # Automatic error detection
├── authenticated-pages.spec.ts
├── task-operations.spec.ts
└── user-journeys.spec.ts # Complete flows
```

---

## Best Practices

### 1. Make Tests Resilient

```typescript
// ❌ BAD: Brittle selector
await page.click('.btn-primary.mt-4.px-6');

// ✅ GOOD: Semantic selector
await page.click('button[type="submit"]');
await page.getByRole('button', { name: 'Sign In' }).click();
await page.getByTestId('login-submit').click();
```

### 2. Use Test Fixtures

```typescript
// ❌ BAD: Duplicate code
test('Test 1', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"]', 'user@test.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
});

// ✅ GOOD: Reusable helper
import { login } from './fixtures/auth';

test('Test 1', async ({ page }) => {
  await login(page, 'user');
  // Test starts here
});
```

### 3. Setup Test Data Properly

```bash
# Create test users with valid data
# e2e/setup-test-users.sh

curl -X POST http://localhost:3005/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@test.com",
    "password": "User123!",  # Meets backend requirements
    "username": "testuser",
    "role": "user"
  }'
```

### 4. Wait Appropriately

```typescript
// ❌ BAD: Random timeouts
await page.waitForTimeout(5000);

// ✅ GOOD: Wait for specific conditions
await page.waitForLoadState('networkidle');
await page.waitForSelector('#email', { state: 'visible' });
await expect(page.locator('h1')).toBeVisible();

// ⚠️ ACCEPTABLE: Short wait for hydration (last resort)
await page.waitForTimeout(1000); // After networkidle
```

### 5. Isolate Tests

```typescript
// Each test should be independent
test.describe('Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // Fresh state for each test
  });

  test.afterEach(async ({ page }) => {
    // Clean up any created data
    await cleanupTestData();
  });
});
```

---

## Troubleshooting

### Debug Failing Tests

```bash
# Run with UI mode to see what's happening
pnpm test:e2e:ui

# Run specific test with headed browser
pnpm exec playwright test auth.spec.ts --headed

# Generate trace for debugging
pnpm exec playwright test --trace on

# View last test report
pnpm test:e2e:report
```

### Common Issues

**Issue: Tests pass locally but fail in CI**

Solution:
```typescript
// Use reuse existing server in CI
export default defineConfig({
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3006',
    reuseExistingServer: !process.env.CI, // Don't reuse in CI
  },
});
```

**Issue: Flaky tests (sometimes pass, sometimes fail)**

Causes:
- Race conditions (not waiting for async operations)
- Shared test data (tests affecting each other)
- Network timing (API calls taking variable time)

Solutions:
```typescript
// Add explicit waits
await page.waitForLoadState('networkidle');

// Use workers: 1 to run sequentially
pnpm exec playwright test --workers=1

// Check for stale data
await cleanupTestData();
```

**Issue: Port already in use**

Solution:
```bash
# Find process using port
lsof -ti:3006

# Kill it
kill $(lsof -ti:3006)

# Or use playwright's reuse option
reuseExistingServer: true
```

---

## Real-World Example: Complete Fix Flow

### Problem
User reports: "Settings page shows blank screen"

### 1. Reproduce with E2E Test

```typescript
test('Settings page loads', async ({ page }) => {
  const errors = setupErrorListeners(page);

  await login(page);
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');

  // ❌ Test fails with runtime error
  expect(errors).toHaveLength(0);
});
```

### 2. Analyze Error

```
❌ Runtime Error: TypeError: Cannot read properties of undefined (reading 'parseAsync')
   at ProfileSettings.tsx:48
   at zodResolver
```

### 3. Root Cause

- `UserProfileSchema` is undefined
- Schemas package not rebuilt after changes
- Frontend importing stale build

### 4. Fix

```bash
cd packages/schemas
pnpm build

cd ../../apps/frontend
pkill -f "next dev"
pnpm dev
```

### 5. Verify

```bash
pnpm test:e2e --grep "Settings"
# ✅ All tests pass
```

### 6. Prevent Regression

- Add to CI/CD pipeline
- Run E2E tests on every PR
- Automated nightly test runs

---

## Summary

### Key Takeaways

1. **Setup error listeners** in every E2E test to catch runtime errors automatically
2. **Test authenticated pages**, not just public routes
3. **Wait for client-side rendering** in Next.js 14+ (RSC/streaming)
4. **Rebuild packages** after schema changes in monorepo
5. **Use semantic selectors** (roles, test IDs) not CSS classes
6. **Isolate test data** - each test should be independent
7. **Monitor test runs** - failing tests = bugs to fix!

### Quick Commands

```bash
# Run all E2E tests
pnpm test:e2e

# Run with UI for debugging
pnpm test:e2e:ui

# Run specific test file
pnpm test:e2e:auth

# Run smoke tests (fast health check)
pnpm test:e2e:smoke

# View last test report
pnpm test:e2e:report

# Setup test users
./e2e/setup-test-users.sh
```

---

**Remember**: E2E tests are your **first line of defense** against production bugs. Invest time in writing good tests, and they'll save you hours of debugging! 🚀
