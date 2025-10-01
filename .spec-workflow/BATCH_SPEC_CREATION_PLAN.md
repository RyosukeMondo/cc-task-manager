# Batch Spec Creation Plan - 8 Atomic Specs

> **Created**: 2025-10-01
> **Purpose**: Create all 8 specs for parallel development with zero merge conflicts
> **Approval**: Review this plan, then I'll create all 24 documents (8 specs × 3 phases)

## 📋 Overview

Creating 8 atomic specs with complete requirements → design → tasks documentation:

1. ✅ backend-tasks-api
2. ✅ backend-analytics-api
3. ✅ backend-auth-api
4. ✅ backend-settings-api
5. ✅ task-creation-modal
6. ✅ task-detail-view
7. ✅ queue-management-dashboard
8. ✅ system-monitoring-dashboard

---

## 🎯 Spec 1: backend-tasks-api

### Requirements Summary
**User Stories**:
- As a developer, I want to create tasks via API so I can manage workflows programmatically
- As a frontend, I want to fetch task lists so I can display them to users
- As a system, I want to update task status so I can track progress
- As a user, I want to delete tasks so I can clean up completed/failed tasks

**Acceptance Criteria**:
- ✅ POST /api/tasks creates task with validation
- ✅ GET /api/tasks returns paginated task list with filters
- ✅ GET /api/tasks/:id returns single task with full details
- ✅ PATCH /api/tasks/:id updates task fields
- ✅ DELETE /api/tasks/:id soft-deletes task
- ✅ Real-time WebSocket events on task changes
- ✅ E2E tests validate all endpoints return 2xx

### Design Summary
**Architecture**:
- NestJS module: `apps/backend/src/tasks/`
- Prisma model: Task (id, title, description, status, priority, userId, createdAt, updatedAt)
- DTOs: CreateTaskDto, UpdateTaskDto, TaskResponseDto
- Service layer with business logic
- Controller with REST endpoints
- WebSocket gateway integration

**Key Files**:
- `tasks.module.ts` - Module definition
- `tasks.controller.ts` - REST API endpoints
- `tasks.service.ts` - Business logic
- `tasks.repository.ts` - Database operations
- `dto/create-task.dto.ts` - Input validation
- `dto/update-task.dto.ts` - Update validation
- `entities/task.entity.ts` - Response type

### Tasks Summary (10 tasks)
1. Create Prisma Task model schema + migration
2. Create TaskModule with dependency injection
3. Create CreateTaskDto + UpdateTaskDto with Zod validation
4. Implement TasksService with CRUD operations
5. Implement TasksController with REST endpoints
6. Add real-time WebSocket task events
7. Create E2E tests for all endpoints (tasks-api.spec.ts)
8. Add to contract-client.ts (getTasks, createTask, etc.)
9. Add environment variables (TASKS_API_ENABLED)
10. Update API documentation

---

## 🎯 Spec 2: backend-analytics-api

### Requirements Summary
**User Stories**:
- As a user, I want to see performance metrics so I can track system efficiency
- As a user, I want to view trend data so I can identify patterns over time
- As a dashboard, I want analytics data so I can visualize metrics

**Acceptance Criteria**:
- ✅ GET /api/analytics/performance returns completion rate, avg time, throughput
- ✅ GET /api/analytics/trends returns time-series data with grouping (day/week/month)
- ✅ Data cached for 5 minutes to reduce DB load
- ✅ Supports date range filtering
- ✅ E2E tests validate no 404 errors

### Design Summary
**Architecture**:
- NestJS module: `apps/backend/src/analytics/`
- Aggregation queries on Task model (no new tables)
- Caching with Redis (5min TTL)
- DTOs from @cc-task-manager/schemas (already exist)

**Key Files**:
- `analytics.module.ts`
- `analytics.controller.ts`
- `analytics.service.ts`
- `dto/analytics-filter.dto.ts`

### Tasks Summary (8 tasks)
1. Create AnalyticsModule
2. Implement performance metrics query (completion rate, avg time)
3. Implement trends query with time-series grouping
4. Add Redis caching layer
5. Create AnalyticsController with GET endpoints
6. Create E2E tests (analytics-api.spec.ts)
7. Add environment variables (ANALYTICS_CACHE_TTL)
8. Update API documentation

---

## 🎯 Spec 3: backend-auth-api

### Requirements Summary
**User Stories**:
- As a user, I want to register an account so I can use the system
- As a user, I want to log in securely so I can access my data
- As a system, I want JWT authentication so I can authorize requests
- As a user, I want to log out so I can end my session

**Acceptance Criteria**:
- ✅ POST /api/auth/register creates user with password hashing
- ✅ POST /api/auth/login returns JWT token
- ✅ POST /api/auth/logout invalidates token
- ✅ POST /api/auth/refresh renews token
- ✅ GET /api/auth/me returns current user
- ✅ Passwords hashed with bcrypt (10 rounds)
- ✅ JWT expires in 7 days
- ✅ Auth guard protects routes

### Design Summary
**Architecture**:
- NestJS module: `apps/backend/src/auth/`
- Prisma model: User, Session
- Passport.js + JWT strategy
- bcryptjs for password hashing
- Guards for route protection

**Key Files**:
- `auth.module.ts`
- `auth.controller.ts`
- `auth.service.ts`
- `jwt.strategy.ts`
- `jwt-auth.guard.ts`
- `dto/login.dto.ts`, `dto/register.dto.ts`

### Tasks Summary (12 tasks)
1. Create User + Session Prisma models + migration
2. Create AuthModule with Passport integration
3. Implement password hashing with bcrypt
4. Implement JWT strategy with token generation
5. Create RegisterDto + LoginDto validation
6. Implement AuthService (register, login, logout, refresh)
7. Implement AuthController with endpoints
8. Create JwtAuthGuard for route protection
9. Add auth to existing protected routes
10. Create E2E tests (auth.spec.ts)
11. Add environment variables (JWT_SECRET, JWT_EXPIRES_IN)
12. Update API documentation

---

## 🎯 Spec 4: backend-settings-api

### Requirements Summary
**User Stories**:
- As a user, I want to save my preferences so I can customize my experience
- As a frontend, I want to fetch settings so I can apply user preferences
- As a system, I want to auto-create default settings for new users

**Acceptance Criteria**:
- ✅ GET /api/settings returns user settings (auto-creates if missing)
- ✅ PATCH /api/settings updates preferences
- ✅ Settings stored per-user with userId FK
- ✅ Validates settings schema (Zod)
- ✅ No more hardcoded 'current-user'

### Design Summary
**Architecture**:
- NestJS module: `apps/backend/src/settings/`
- Prisma model: Settings (userId FK)
- Auto-create defaults on first GET

**Key Files**:
- `settings.module.ts`
- `settings.controller.ts`
- `settings.service.ts`
- `dto/update-settings.dto.ts`

### Tasks Summary (8 tasks)
1. Create Settings Prisma model + migration
2. Create SettingsModule
3. Implement SettingsService with auto-create logic
4. Create UpdateSettingsDto validation
5. Implement SettingsController (GET, PATCH)
6. Add auth guard (require logged-in user)
7. Create E2E tests (settings-api.spec.ts)
8. Update contract-client.ts

---

## 🎯 Spec 5: task-creation-modal

### Requirements Summary
**User Stories**:
- As a user, I want to click "Create Task" button so I can add new tasks
- As a user, I want a form with validation so I don't submit invalid data
- As a user, I want to see errors so I can correct my input
- As a user, I want confirmation so I know the task was created

**Acceptance Criteria**:
- ✅ Modal opens on "Create Task" button click
- ✅ Form fields: title (required), description, priority, tags
- ✅ Real-time validation with error messages
- ✅ Submit calls POST /api/tasks
- ✅ Success message + modal closes
- ✅ Error handling with user-friendly messages
- ✅ E2E tests validate full flow

### Design Summary
**Architecture**:
- Dialog component with react-hook-form
- Zod validation from @cc-task-manager/schemas
- useCreateTask hook (already exists)
- Optimistic UI updates

**Key Files**:
- `src/components/tasks/TaskCreateDialog.tsx` (new)
- `src/components/tasks/TaskCreateForm.tsx` (new)
- `src/hooks/useCreateTask.ts` (edit - add error handling)
- `src/app/tasks/page.tsx` (edit - wire up modal)

### Tasks Summary (8 tasks)
1. Create TaskCreateDialog component with modal/sheet UI
2. Create TaskCreateForm with react-hook-form
3. Add Zod validation schema
4. Wire up useCreateTask mutation
5. Add optimistic UI updates
6. Update tasks/page.tsx to open modal
7. Add error handling + toast notifications
8. Create E2E test (task-create.spec.ts)

---

## 🎯 Spec 6: task-detail-view

### Requirements Summary
**User Stories**:
- As a user, I want to click a task to see full details
- As a user, I want to see execution logs so I can debug issues
- As a user, I want to see task metadata (created, updated, status)
- As a user, I want action buttons (cancel, retry, delete)

**Acceptance Criteria**:
- ✅ Route: /tasks/:id
- ✅ Displays task metadata in card layout
- ✅ Log viewer with syntax highlighting
- ✅ Action buttons based on task status
- ✅ Real-time updates via WebSocket
- ✅ Handles missing task (404 page)

### Design Summary
**Architecture**:
- Next.js dynamic route: `app/tasks/[id]/page.tsx`
- Components: TaskDetail, LogViewer, TaskActions
- useTask hook for data fetching
- WebSocket subscription for real-time updates

**Key Files**:
- `src/app/tasks/[id]/page.tsx` (new)
- `src/components/tasks/TaskDetail.tsx` (new)
- `src/components/tasks/LogViewer.tsx` (new)
- `src/components/tasks/TaskActions.tsx` (new)
- `src/hooks/useTask.ts` (new)

### Tasks Summary (10 tasks)
1. Create dynamic route app/tasks/[id]/page.tsx
2. Create TaskDetail component
3. Create LogViewer with syntax highlighting
4. Create TaskActions component (cancel, retry, delete)
5. Implement useTask hook
6. Add WebSocket real-time subscription
7. Handle loading/error/404 states
8. Add to Navigation (task links)
9. Create E2E test (task-detail.spec.ts)
10. Update contract-client.ts (getTaskById)

---

## 🎯 Spec 7: queue-management-dashboard

### Requirements Summary
**User Stories**:
- As an admin, I want to see BullMQ queue status
- As an admin, I want to view active/pending/failed jobs
- As an admin, I want to retry/cancel jobs
- As a system, I want real-time queue metrics

**Acceptance Criteria**:
- ✅ Route: /queue
- ✅ Shows queue metrics (active, pending, completed, failed)
- ✅ Job list with status, progress, timestamps
- ✅ Actions: retry failed jobs, cancel pending jobs
- ✅ Real-time updates (queue metrics refresh every 5s)
- ✅ Charts showing job throughput

### Design Summary
**Architecture**:
- Next.js route: `app/queue/page.tsx`
- Backend endpoint: GET /api/queue/status
- WebSocket events for queue changes
- Recharts for visualization

**Key Files**:
- `src/app/queue/page.tsx` (new)
- `src/components/queue/QueueMetrics.tsx` (new)
- `src/components/queue/JobList.tsx` (new)
- `src/hooks/useQueue.ts` (new)
- `apps/backend/src/queue/queue.controller.ts` (edit)

### Tasks Summary (10 tasks)
1. Create GET /api/queue/status backend endpoint
2. Create queue/page.tsx route
3. Create QueueMetrics component with charts
4. Create JobList component with actions
5. Implement useQueue hook
6. Add retry/cancel job mutations
7. Add WebSocket subscription for queue events
8. Add to Sidebar navigation
9. Create E2E test (queue-dashboard.spec.ts)
10. Add environment variables (QUEUE_DASHBOARD_ENABLED)

---

## 🎯 Spec 8: system-monitoring-dashboard

### Requirements Summary
**User Stories**:
- As an admin, I want to see system health metrics
- As an admin, I want to monitor resource usage (CPU, memory)
- As an admin, I want to see performance trends over time

**Acceptance Criteria**:
- ✅ Route: /monitoring
- ✅ Real-time CPU/memory charts
- ✅ API response time metrics
- ✅ WebSocket connection status
- ✅ Database connection pool status
- ✅ Metrics auto-refresh every 5 seconds

### Design Summary
**Architecture**:
- Next.js route: `app/monitoring/page.tsx`
- Backend endpoint: GET /api/monitoring/metrics
- System metrics collection with os module
- Recharts for visualization

**Key Files**:
- `src/app/monitoring/page.tsx` (new)
- `src/components/monitoring/SystemMetrics.tsx` (new)
- `src/components/monitoring/MetricsChart.tsx` (new)
- `src/hooks/useSystemMetrics.ts` (new)
- `apps/backend/src/monitoring/monitoring.controller.ts` (new)

### Tasks Summary (9 tasks)
1. Create GET /api/monitoring/metrics backend endpoint
2. Collect system metrics (os.cpuUsage, os.totalmem)
3. Create monitoring/page.tsx route
4. Create SystemMetrics component
5. Create MetricsChart component with Recharts
6. Implement useSystemMetrics hook with polling
7. Add to Sidebar navigation
8. Create E2E test (monitoring.spec.ts)
9. Add environment variables (MONITORING_METRICS_INTERVAL)

---

## 📊 Summary Statistics

| Spec | Requirements (stories) | Design (files) | Tasks | E2E Tests |
|------|----------------------|----------------|-------|-----------|
| 1. backend-tasks-api | 4 | 7 | 10 | tasks-api.spec.ts |
| 2. backend-analytics-api | 3 | 4 | 8 | analytics-api.spec.ts |
| 3. backend-auth-api | 5 | 6 | 12 | auth.spec.ts |
| 4. backend-settings-api | 3 | 4 | 8 | settings-api.spec.ts |
| 5. task-creation-modal | 4 | 4 | 8 | task-create.spec.ts |
| 6. task-detail-view | 4 | 5 | 10 | task-detail.spec.ts |
| 7. queue-dashboard | 4 | 5 | 10 | queue-dashboard.spec.ts |
| 8. system-monitoring | 3 | 5 | 9 | monitoring.spec.ts |
| **TOTAL** | **30 stories** | **40 files** | **75 tasks** | **8 test files** |

---

## ✅ Next Steps

**Option A: Approve & Generate All** (Recommended)
- You approve this plan via dashboard
- I generate all 24 documents (8 specs × 3 phases)
- Each spec gets: requirements.md, design.md, tasks.md
- All follow contract-driven, SSOT, SRP principles
- Zero file conflicts (per parallel development plan)

**Option B: One-by-One Review**
- I create each spec individually
- You approve each one via dashboard
- Takes longer but allows for adjustments

**Which option do you prefer?**

Once approved, I'll create all specs and you can start parallel development immediately across 8 feature branches.
