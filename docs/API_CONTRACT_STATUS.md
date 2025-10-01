# API Contract Status Report

> **Purpose**: Track frontend-backend API contract alignment and detect violations automatically

## Quick Status

🔴 **CRITICAL**: Backend server not running - All API endpoints returning NETWORK_ERROR
⚠️  **10 CONTRACT VIOLATIONS DETECTED** (via automated E2E tests)

### Test Results Summary (2025-10-01)

**Automated E2E Test Run**:
- ✅ **1 page passed**: Dashboard (no API calls)
- ❌ **4 pages failed**: Settings, Tasks, Analytics (backend unavailable)
- 🔴 **10 API network errors detected**

**API Calls Attempted**:
```
GET /api/tasks → NETWORK_ERROR (called 6 times)
GET /api/analytics/performance → NETWORK_ERROR (called 2 times)
GET /api/analytics/trends?groupBy=day → NETWORK_ERROR (called 1 time)
GET /api/settings/current-user → NETWORK_ERROR (called 1 time)
```

**Detection Method**: Automated E2E tests with mock JWT authentication (apps/frontend/e2e/api-contract-validation.spec.ts)

---

## Current API Contract Violations

### 0. Authentication API - NETWORK ERROR (CRITICAL)

**Frontend Expected Endpoint**:
```
POST http://192.168.11.26:3005/api/auth/login
```

**Status**: ❌ NETWORK ERROR (Backend not running or endpoint doesn't exist)

**Used By**:
- ALL authenticated pages (login required for access)
- E2E test authentication (apps/frontend/e2e/fixtures/auth.ts:122)

**Impact**:
- **BLOCKS ALL E2E TESTING** - Cannot authenticate to test other endpoints
- Cannot test Dashboard, Settings, Tasks, Analytics pages
- Cannot validate other API contracts

**Root Cause**: Backend server is not running at http://192.168.11.26:3005 OR /api/auth/login endpoint doesn't exist

**Immediate Fix Required**:
1. **Backend**: Start backend server at http://192.168.11.26:3005
2. **Backend**: Implement POST /api/auth/login endpoint
3. **Testing**: Create mock auth bypass for E2E tests when backend unavailable

**Test Workaround** (for development):
```typescript
// Create setupMockAuth() that bypasses backend
export async function setupMockAuth(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'mock-token-for-testing');
    localStorage.setItem('user', JSON.stringify({
      id: 'test-user-123',
      email: 'test@example.com',
      role: 'user'
    }));
  });
}
```

---

### 1. Tasks API - 404 Not Found

**Frontend Expected Endpoint**:
```
GET http://192.168.11.26:3005/api/tasks
```

**Status**: ❌ 404 Not Found

**Used By**:
- Dashboard page (task summary widget)
- Tasks page (`/tasks`, `/tasks/active`, `/tasks/completed`)
- Task list components

**Contract Definition**:
- File: `apps/frontend/src/lib/api/contract-client.ts:108-110`
- Method: `apiClient.getTasks()`
- Returns: `Promise<TaskStatus[]>`

**Root Cause**: Backend endpoint does not exist or has different path

**Possible Fixes**:
1. **Backend**: Create `GET /api/tasks` endpoint
2. **Frontend**: Update to match actual backend endpoint (e.g., `GET /tasks` without `/api` prefix)
3. **Check**: Verify backend is running on `http://192.168.11.26:3005`

---

### 2. Settings API - 404 Not Found

**Frontend Expected Endpoint**:
```
GET http://192.168.11.26:3005/api/settings/current-user
```

**Status**: ❌ 404 Not Found

**Used By**:
- Settings page (`/settings`)
- All settings tabs (Profile, Preferences, Notifications)

**Contract Definition**:
- File: `apps/frontend/src/lib/api/contract-client.ts:225-227`
- Method: `apiClient.getSettings(userId)`
- Returns: `Promise<Settings>`

**Issues**:
1. **Hardcoded User ID**: `userId = 'current-user'` in `apps/frontend/src/app/settings/page.tsx:20`
2. **Missing Endpoint**: Backend does not have `/api/settings/{userId}` endpoint

**Fixes Required**:
1. **Frontend** (Immediate):
   ```typescript
   // apps/frontend/src/app/settings/page.tsx
   // Replace:
   const userId = 'current-user';
   // With:
   const { user } = useAuth(); // Get from auth context
   const userId = user?.id || 'anonymous';
   ```

2. **Backend**: Create `/api/settings/:userId` endpoint OR use `/api/settings/me` for current user

3. **Alternative**: Use `/api/users/me/settings` RESTful pattern

---

## All Expected API Endpoints

### Authentication (`/api/auth/*`)

| Endpoint | Method | Status | Used By |
|----------|--------|--------|---------|
| `/api/auth/login` | POST | ❓ Unknown | Login page |
| `/api/auth/logout` | POST | ❓ Unknown | Logout button |
| `/api/auth/refresh` | POST | ❓ Unknown | Token refresh |
| `/api/auth/me` | GET | ❓ Unknown | User session |

### Tasks (`/api/tasks/*`)

| Endpoint | Method | Status | Used By |
|----------|--------|--------|---------|
| `/api/tasks` | GET | ❌ 404 | Dashboard, Tasks pages |
| `/api/tasks` | POST | ❓ Unknown | Create task |
| `/api/tasks/:id` | GET | ❓ Unknown | Task details |
| `/api/tasks/:id` | PATCH | ❓ Unknown | Update task |
| `/api/tasks/:id` | DELETE | ❓ Unknown | Delete task |

### Settings (`/api/settings/*`)

| Endpoint | Method | Status | Used By |
|----------|--------|--------|---------|
| `/api/settings/:userId` | GET | ❌ 404 | Settings page |
| `/api/settings/:userId` | PATCH | ❓ Unknown | Update settings |

### Analytics (`/api/analytics/*`)

| Endpoint | Method | Status | Used By |
|----------|--------|--------|---------|
| `/api/analytics/performance` | GET | ❓ Unknown | Performance page |
| `/api/analytics/trends` | GET | ❓ Unknown | Trends page |

### Processes & Workers (`/api/processes/*`, `/api/workers/*`)

| Endpoint | Method | Status | Used By |
|----------|--------|--------|---------|
| `/api/processes` | GET | ❓ Unknown | Process management |
| `/api/processes` | POST | ❓ Unknown | Create process |
| `/api/workers` | GET | ❓ Unknown | Worker management |
| `/api/workers` | POST | ❓ Unknown | Create worker |

---

## Automated Detection

### E2E Test Coverage

✅ **Created**: `e2e/api-contract-validation.spec.ts`

**Tests Include**:
1. Monitor ALL network requests automatically
2. Detect 404, 500, 401, 403, 400 errors
3. Generate comprehensive API usage report
4. Validate each page's API calls
5. Group errors by type (NOT_FOUND, SERVER_ERROR, AUTH_ERROR, etc.)

**How to Run**:
```bash
# Test all pages for API contract violations
pnpm test:e2e api-contract-validation

# Test specific page
pnpm exec playwright test api-contract-validation.spec.ts --grep "Dashboard"

# Generate full API report
pnpm exec playwright test api-contract-validation.spec.ts --grep "comprehensive"
```

---

## Recommended Actions

### Immediate (Frontend Fixes)

1. **Fix Settings User ID**
   ```bash
   # File: apps/frontend/src/app/settings/page.tsx:20
   # Replace hardcoded 'current-user' with actual user ID from auth
   ```

2. **Add Error Handling for Missing Endpoints**
   ```typescript
   // Show friendly message instead of raw 404 error
   if (error?.status === 404) {
     return <EmptyState message="Settings not configured yet" />;
   }
   ```

3. **Mock API Responses for Development** (if backend not ready)
   ```typescript
   // Create mock API responses in development mode
   if (process.env.NODE_ENV === 'development' && !backendAvailable) {
     return mockSettings;
   }
   ```

### Backend Requirements

1. **Implement Missing Endpoints**:
   - `GET /api/tasks` → Return list of tasks
   - `GET /api/settings/:userId` OR `GET /api/settings/me` → Return user settings
   - Create initial settings if not exist (don't return 404)

2. **Auto-Initialize Data**:
   ```typescript
   // Instead of 404, auto-create default settings
   async getSettings(userId: string) {
     let settings = await db.findSettings(userId);
     if (!settings) {
       settings = await db.createDefaultSettings(userId);
     }
     return settings;
   }
   ```

3. **Document Actual Endpoints**:
   - Create OpenAPI/Swagger spec
   - Export as `docs/api-spec.yaml`
   - Generate frontend client from spec

### Long-Term (Contract-Driven Development)

1. **Shared Contract Definition**
   - Create shared `@cc-task-manager/api-contracts` package
   - Define all endpoints in one place
   - Generate both backend routes AND frontend client

2. **Contract Testing**
   - Backend: Test that all routes match contract
   - Frontend: Test that all API calls match contract
   - CI/CD: Fail build if contract violations detected

3. **Type-Safe API Client**
   - Use tRPC, gRPC, or GraphQL for end-to-end type safety
   - OR generate TypeScript types from OpenAPI spec
   - Prevent contract violations at compile time

---

## Testing Workflow

### Before Every Commit

```bash
# 1. Run API contract validation
pnpm test:e2e api-contract-validation

# 2. If failures, check API_CONTRACT_STATUS.md
# 3. Fix frontend OR flag as backend requirement
# 4. Update this document with status
```

### CI/CD Pipeline

```yaml
# .github/workflows/e2e-tests.yml
- name: API Contract Validation
  run: pnpm test:e2e api-contract-validation
  continue-on-error: true # Don't fail build, but report

- name: Upload API Report
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: api-contract-violations
    path: test-results/
```

---

## Success Criteria

✅ **All API calls return 2xx status codes**
✅ **No 404 errors from legitimate frontend requests**
✅ **Settings page loads without errors**
✅ **Tasks page loads without errors**
✅ **All authenticated pages work**

---

## Notes

- **Backend URL**: `http://192.168.11.26:3005`
- **Frontend URL**: `http://localhost:3006`
- **Last Updated**: 2025-10-01
- **Detected By**: Automated E2E tests (api-contract-validation.spec.ts)

---

## Related Documentation

- [E2E Test Tips](./e2e_test_tips.md) - General testing best practices
- [Bug Detection Plan](./BUG_DETECTION_PLAN.md) - Systematic bug fixing approach
- Contract Registry: `apps/frontend/src/contracts/ContractRegistry.ts`
- API Client: `apps/frontend/src/lib/api/contract-client.ts`
