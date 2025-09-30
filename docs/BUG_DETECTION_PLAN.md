# Comprehensive Bug Detection & Fix Plan

> **Goal**: Systematically find, detect, and fix ALL bugs and errors in the application

## Executive Summary

**Current Status**: 5/8 E2E tests passing, React Query error fixed, 1 active runtime error (settings page)

**Target**: 100% E2E test pass rate, zero runtime errors, complete test coverage

---

## Phase 1: Immediate Issues (Priority: CRITICAL)

### 1.1 Settings Page Zod Resolver Error ⚠️
**Status**: DETECTED
**Error**: `TypeError: Cannot read properties of undefined (reading 'parseAsync')`
**Location**: `/settings` - ProfileSettings component
**Impact**: Settings page completely broken

**Root Cause**:
- `UserProfileSchema` resolving to undefined
- Likely: stale build artifacts in schemas package

**Fix Steps**:
```bash
# 1. Rebuild schemas package
cd packages/schemas && pnpm build

# 2. Verify export
node -e "const s = require('@cc-task-manager/schemas'); console.log(s.UserProfileSchema)"

# 3. Restart frontend
cd ../../apps/frontend && pnpm dev

# 4. Verify fix
pnpm exec playwright test runtime-errors.spec.ts --grep "Settings"
```

---

## Phase 2: Comprehensive E2E Testing

### 2.1 Runtime Error Detection (All Pages)

**Test Matrix**:
| Page | Status | Runtime Errors | Notes |
|------|--------|----------------|-------|
| `/` (Root) | ❓ Not tested | Unknown | Redirects to dashboard |
| `/login` | ✅ Working | None | Tested via auth flow |
| `/register` | ❓ Not tested | Unknown | Needs E2E test |
| `/dashboard` | ✅ Passing | None | Verified |
| `/tasks` | ❌ Failing | Selector issue | Page loads, test assertion fails |
| `/tasks/active` | ✅ Passing | None | Verified |
| `/tasks/completed` | ❌ Failing | Selector issue | Page loads, test assertion fails |
| `/analytics/performance` | ✅ Passing | None | Verified |
| `/analytics/trends` | ✅ Passing | None | Verified |
| `/settings` | ⚠️ Critical | Zod resolver | Needs immediate fix |
| `/unauthorized` | ❓ Not tested | Unknown | Needs E2E test |

**Actions**:
- [ ] Fix settings page zod error
- [ ] Fix selector issues in tasks pages (test problem, not page problem)
- [ ] Add E2E tests for: register, root, unauthorized
- [ ] Run full suite and verify 100% pass rate

### 2.2 Authentication Flow Testing

**Test Coverage**:
- [x] Login with valid credentials
- [x] Login with invalid credentials
- [x] Protected route redirection
- [ ] Logout functionality
- [ ] Session persistence
- [ ] Token refresh
- [ ] Registration flow
- [ ] Password requirements validation

### 2.3 CRUD Operations Testing

**Tasks**:
- [ ] Create task via UI
- [ ] Create task via API
- [ ] Read task list
- [ ] Update task status
- [ ] Update task details
- [ ] Delete task
- [ ] Filter tasks by status
- [ ] Sort tasks
- [ ] Search tasks

**Settings**:
- [ ] Update profile
- [ ] Update preferences
- [ ] Update notifications
- [ ] Validate form inputs
- [ ] Error handling

---

## Phase 3: API Integration Testing

### 3.1 Authentication Endpoints
```bash
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET  /api/auth/me
```

### 3.2 Task Endpoints
```bash
GET    /api/tasks
GET    /api/tasks/:id
POST   /api/tasks
PUT    /api/tasks/:id
DELETE /api/tasks/:id
PATCH  /api/tasks/:id/status
```

### 3.3 Settings Endpoints
```bash
GET    /api/settings/:userId
PUT    /api/settings/:userId
PATCH  /api/settings/:userId/profile
PATCH  /api/settings/:userId/preferences
PATCH  /api/settings/:userId/notifications
```

### 3.4 Analytics Endpoints
```bash
GET /api/analytics/performance
GET /api/analytics/trends
GET /api/analytics/summary
```

**Test Strategy**:
- [ ] Create API integration test suite
- [ ] Test happy paths (200 responses)
- [ ] Test error cases (400/401/403/404/500)
- [ ] Test authentication/authorization
- [ ] Test data validation
- [ ] Test rate limiting

---

## Phase 4: Static Analysis

### 4.1 TypeScript Type Checking

```bash
# Check frontend types
cd apps/frontend && pnpm type-check

# Check backend types
cd apps/backend && pnpm type-check

# Check schemas types
cd packages/schemas && pnpm type-check
```

**Expected Issues**:
- Implicit any types
- Unused variables
- Missing return types
- Type mismatches

### 4.2 Linting

```bash
# Run ESLint
pnpm lint

# Fix auto-fixable issues
pnpm lint:fix
```

### 4.3 Console Warnings Audit

**Known Warnings**:
```
⚠️ Unsupported metadata viewport is configured in metadata export
⚠️ Failed to fetch RSC payload (expected fallback)
```

**Actions**:
- [ ] Catalog all console warnings
- [ ] Fix or suppress appropriately
- [ ] Document expected warnings

---

## Phase 5: User Journey Testing

### 5.1 New User Journey
```
1. Visit homepage
2. Click "Sign up"
3. Fill registration form
4. Submit registration
5. Verify email (if applicable)
6. Login
7. See dashboard
8. Create first task
9. Mark task complete
10. View analytics
```

### 5.2 Returning User Journey
```
1. Visit homepage
2. Redirected to login (or dashboard if logged in)
3. Login
4. See task list
5. Filter tasks
6. Update task
7. Change settings
8. Logout
```

### 5.3 Error Recovery Journey
```
1. Try invalid login
2. See error message
3. Try valid login
4. Create task with invalid data
5. See validation errors
6. Fix and submit
7. Success
```

---

## Phase 6: WebSocket/Real-time Testing

### 6.1 WebSocket Connection

**Test Cases**:
- [ ] WebSocket connects on authenticated pages
- [ ] Connection survives page navigation
- [ ] Reconnects after disconnect
- [ ] Task updates broadcast in real-time
- [ ] Multiple clients receive updates

### 6.2 Real-time Features

```typescript
// Test pattern
test('Real-time task updates', async ({ page, context }) => {
  // User 1: Create task
  await login(page, 'user');
  const taskId = await createTask(page, { name: 'Test Task' });

  // User 2: Should see the task
  const page2 = await context.newPage();
  await login(page2, 'admin');
  await page2.goto('/tasks');

  // Verify task appears without refresh
  await expect(page2.locator(`[data-task-id="${taskId}"]`)).toBeVisible();
});
```

---

## Phase 7: Performance & Edge Cases

### 7.1 Performance Issues

**Test Cases**:
- [ ] Large task lists (1000+ tasks)
- [ ] Rapid API calls
- [ ] Memory leaks
- [ ] Slow network simulation

### 7.2 Edge Cases

**Data Edge Cases**:
- [ ] Empty states (no tasks, no settings)
- [ ] Very long text inputs
- [ ] Special characters in inputs
- [ ] Unicode characters
- [ ] SQL injection attempts
- [ ] XSS attempts

**UI Edge Cases**:
- [ ] Small screen sizes (mobile)
- [ ] Large screen sizes
- [ ] Browser zoom levels
- [ ] Dark mode
- [ ] Slow animations/transitions

---

## Implementation Plan

### Week 1: Critical Fixes
**Days 1-2**: Fix immediate issues
- [x] React Query error - DONE
- [x] Metadata export error - DONE
- [ ] Settings page zod error
- [ ] Test selector issues

**Days 3-5**: Complete E2E coverage
- [ ] Add missing page tests
- [ ] Achieve 100% pass rate
- [ ] Document all fixes

### Week 2: API & Integration
**Days 1-3**: API testing
- [ ] Create API test suite
- [ ] Test all endpoints
- [ ] Fix API issues

**Days 4-5**: User journeys
- [ ] Complete flow tests
- [ ] WebSocket tests
- [ ] Document flows

### Week 3: Polish & Prevention
**Days 1-2**: Static analysis
- [ ] Fix TypeScript errors
- [ ] Fix lint warnings
- [ ] Clean up console warnings

**Days 3-5**: Edge cases & performance
- [ ] Test edge cases
- [ ] Performance optimization
- [ ] Final verification

---

## Test Execution Commands

```bash
# Full test suite
pnpm test:e2e

# Individual test suites
pnpm test:e2e:smoke          # Quick health check
pnpm test:e2e:auth           # Authentication flows
pnpm test:e2e:pages          # Authenticated pages
pnpm test:e2e:tasks          # Task operations
pnpm test:e2e:runtime        # Runtime error detection

# Debug mode
pnpm test:e2e:ui             # Interactive UI mode
pnpm test:e2e --headed       # See browser
pnpm test:e2e --debug        # Debug mode

# CI mode
pnpm test:e2e --workers=1    # Sequential (reliable)
```

---

## Success Metrics

### Test Coverage
- ✅ **Target**: 100% E2E test pass rate
- ✅ **Target**: All pages tested
- ✅ **Target**: All API endpoints tested
- ✅ **Target**: All user journeys tested

### Error Reduction
- ✅ **Target**: Zero runtime errors
- ✅ **Target**: Zero TypeScript errors
- ✅ **Target**: Zero blocking console warnings

### Quality Gates
- ✅ E2E tests pass on every commit
- ✅ No new TypeScript errors
- ✅ No regression in test coverage
- ✅ All critical paths tested

---

## Risk Assessment

### High Risk Areas
1. **Settings page**: Currently broken, needs immediate fix
2. **WebSocket stability**: Real-time features may have edge cases
3. **Authentication**: Security-critical, needs thorough testing
4. **Data validation**: XSS/injection risks if not validated

### Medium Risk Areas
1. **Task CRUD**: Core functionality, high usage
2. **Analytics**: Complex queries, performance concerns
3. **Form validation**: User frustration if buggy

### Low Risk Areas
1. **UI styling**: Non-functional issues
2. **Static pages**: Less complexity
3. **Documentation**: No runtime impact

---

## Maintenance Plan

### Daily
- [ ] Run smoke tests before development
- [ ] Check CI/CD pipeline status

### Weekly
- [ ] Full E2E test suite
- [ ] Review test failures
- [ ] Update test data

### Monthly
- [ ] Audit test coverage
- [ ] Update test documentation
- [ ] Performance testing
- [ ] Security audit

---

## Next Steps

1. **Immediate**: Fix settings page zod error
2. **Short-term**: Achieve 100% E2E pass rate
3. **Medium-term**: Add API integration tests
4. **Long-term**: Automate in CI/CD

**Let's start with Phase 1!** 🚀
