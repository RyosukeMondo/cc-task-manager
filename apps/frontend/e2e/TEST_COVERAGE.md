# E2E Test Coverage Matrix

## Frontend Pages (11 Total)

### Public Pages (No Auth Required)
- [x] `/` - Root/Home page
- [x] `/login` - Login page
- [x] `/register` - Registration page
- [ ] `/unauthorized` - Unauthorized access page

### Protected Pages (Auth Required)
- [x] `/dashboard` - Main dashboard
- [x] `/tasks` - All tasks list
- [x] `/tasks/active` - Active tasks filter
- [x] `/tasks/completed` - Completed tasks filter
- [x] `/analytics/performance` - Performance metrics
- [x] `/analytics/trends` - Trend analysis
- [x] `/settings` - User settings

## Test Suites

### 1. Smoke Tests (`smoke.spec.ts`) ✅
**Status:** 8/8 passing
**Coverage:**
- All 7 main pages load without Next.js errors
- WebSocket connection establishes
- No console errors during page load
- Key elements render correctly

**Limitations:**
- Tests unauthenticated access only (redirects to login)
- Doesn't test actual page functionality
- Doesn't catch runtime errors inside protected pages

### 2. Authentication Tests (`auth.spec.ts`) ⚠️
**Status:** 1/7 failing (login form display test)
**Coverage:**
- Login form display and interaction
- Valid/invalid credentials handling
- Redirect after login
- Session persistence
- Return URL preservation
- Logout functionality

### 3. Authenticated Pages Tests (`authenticated-pages.spec.ts`) ❌
**Status:** 7/8 failing
**Coverage:**
- Dashboard access with auth
- All task pages with auth
- Analytics pages with auth
- Settings page with auth
- Navigation between pages

**Failures Detected:**
- ❌ Runtime error: "client.getQueryCache(...).get is not a function"
- ❌ Error occurs on ALL protected pages after login
- ❌ Related to React Query / TanStack Query compatibility

### 4. Task Operations Tests (`task-operations.spec.ts`)
**Status:** Not run yet (requires authenticated pages to work)
**Coverage:**
- Task CRUD operations
- Task filtering and search
- WebSocket real-time updates
- Task detail view

## Missing Test Coverage

### Pages Not Tested
- [ ] `/` - Root page (redirects but not tested)
- [ ] `/register` - Registration flow
- [ ] `/unauthorized` - Access denied page

### Functionality Not Tested
- [ ] Registration form submission
- [ ] Profile settings update
- [ ] Notification settings
- [ ] Theme/preferences
- [ ] Task creation via UI
- [ ] Task editing via UI
- [ ] Task deletion via UI
- [ ] Task status changes
- [ ] Task priority changes
- [ ] Task filtering combinations
- [ ] Search functionality
- [ ] Pagination
- [ ] Sorting

### API Endpoints Not Tested
- [ ] `POST /api/auth/register`
- [ ] `POST /api/auth/login` (partially tested)
- [ ] `POST /api/auth/logout`
- [ ] `GET /api/tasks`
- [ ] `POST /api/tasks`
- [ ] `GET /api/tasks/:id`
- [ ] `PUT /api/tasks/:id`
- [ ] `DELETE /api/tasks/:id`
- [ ] `GET /api/analytics/performance`
- [ ] `GET /api/analytics/trends`
- [ ] `GET /api/user/profile`
- [ ] `PUT /api/user/profile`
- [ ] `GET /api/user/settings`
- [ ] `PUT /api/user/settings`

### User Flows Not Tested
- [ ] Complete registration → login → create task → complete task flow
- [ ] Login → view analytics → filter by date range flow
- [ ] Login → update settings → verify changes flow
- [ ] Login → create multiple tasks → filter → search flow
- [ ] Multi-user collaboration (WebSocket updates between users)
- [ ] Offline/online reconnection flow
- [ ] Session expiration and renewal
- [ ] Browser back/forward navigation
- [ ] Direct URL access to protected pages

## Critical Issues Found

### Issue #1: React Query Compatibility Error
**Severity:** CRITICAL - Blocks all protected pages
**Error:** `TypeError: client.getQueryCache(...).get is not a function`
**Location:** Triggered in useTasks.ts line 36
**Impact:**
- All authenticated pages fail to load
- 7/8 authenticated page tests failing
- Users cannot access any functionality after login

**Root Cause:** TanStack Query v5 compatibility issue
**Fix Needed:**
- Review providers.tsx for deprecated options
- Check all useQuery hooks for v5 breaking changes
- Clear Next.js cache (.next folder)
- Rebuild and restart frontend

### Issue #2: Test Coverage Gaps
**Severity:** HIGH - Cannot detect many classes of errors
**Impact:**
- Registration not tested
- CRUD operations not tested
- Settings changes not tested
- Complete user flows not tested

**Fix Needed:**
- Add registration tests
- Add full CRUD tests
- Add settings tests
- Add end-to-end user journey tests

### Issue #3: API Integration Not Tested
**Severity:** MEDIUM - May miss backend integration issues
**Impact:**
- API contract changes may break frontend
- Error responses not validated
- Edge cases not covered

**Fix Needed:**
- Add API integration tests
- Test error responses
- Test edge cases (empty lists, large datasets, etc.)

## Next Actions

### Immediate (Blocking)
1. ✅ Fix React Query error in providers.tsx/useTasks.ts
2. ✅ Clear .next cache and rebuild
3. ✅ Re-run authenticated pages tests to verify fix
4. ✅ Ensure all 8 authenticated page tests pass

### Short Term (High Priority)
5. [ ] Add registration E2E tests
6. [ ] Add root page (/) tests
7. [ ] Add unauthorized page tests
8. [ ] Add full CRUD operation tests
9. [ ] Add settings update tests

### Medium Term (Important)
10. [ ] Add API integration tests
11. [ ] Add complete user journey tests
12. [ ] Add multi-user WebSocket tests
13. [ ] Add offline/reconnection tests
14. [ ] Add error scenario tests

### Long Term (Nice to Have)
15. [ ] Add performance tests
16. [ ] Add accessibility tests
17. [ ] Add mobile viewport tests
18. [ ] Add cross-browser tests
19. [ ] Add visual regression tests

## Test Metrics

### Current Coverage
- **Pages Tested:** 10/11 (91%)
- **Pages Passing:** 3/10 (30%) - smoke tests only
- **Critical Paths Blocked:** 7/10 (70%)
- **API Endpoints Tested:** 0/14 (0%)
- **User Flows Tested:** 0/9 (0%)

### Target Coverage
- **Pages Tested:** 11/11 (100%)
- **Pages Passing:** 11/11 (100%)
- **Critical Paths Blocked:** 0/11 (0%)
- **API Endpoints Tested:** 14/14 (100%)
- **User Flows Tested:** 9/9 (100%)

## Success Criteria

✅ All pages load without runtime errors
✅ All authentication flows work correctly
✅ All CRUD operations function properly
✅ Real-time WebSocket updates work
✅ All API endpoints return expected responses
✅ Complete user journeys execute successfully
✅ Tests run in under 5 minutes
✅ No flaky tests
✅ Coverage maintained above 90%
