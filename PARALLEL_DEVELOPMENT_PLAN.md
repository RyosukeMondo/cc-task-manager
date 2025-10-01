# Parallel Development Plan - 8 Atomic Specs

> **Generated**: 2025-10-01
> **Purpose**: Enable 8 developers to work simultaneously with ZERO merge conflicts

## 🎯 Objectives

- ✅ **Contract-Driven**: All APIs defined in `@cc-task-manager/schemas` first
- ✅ **SSOT**: Zod schemas as single source of truth for types + validation
- ✅ **SRP**: Each spec owns specific files/modules
- ✅ **Env-Driven**: Feature flags and config via environment variables
- ✅ **E2E Tests**: Each spec includes Playwright tests in separate files
- ✅ **Zero Conflicts**: Strict file ownership prevents merge conflicts

---

## 📋 8 Atomic Specs Overview

### Group A: Backend Infrastructure (No Dependencies)
1. **backend-tasks-api** - Task CRUD endpoints + real-time events
2. **backend-analytics-api** - Performance & trends analytics endpoints
3. **backend-auth-api** - Authentication & authorization system

### Group B: Backend Features (Depends on Auth)
4. **backend-settings-api** - User settings & preferences endpoints

### Group C: Frontend Core (Depends on Backend APIs)
5. **task-creation-modal** - Task creation dialog UI
6. **task-detail-view** - Task detail page with logs

### Group D: Frontend Advanced (Independent)
7. **queue-management-dashboard** - BullMQ queue monitoring UI
8. **system-monitoring-dashboard** - System health metrics UI

---

## 🗂️ File Ownership Matrix (Prevents Conflicts)

### Backend Files

| Spec | Owned Files | Shared Files (Append Only) |
|------|-------------|----------------------------|
| **backend-tasks-api** | `apps/backend/src/tasks/**/*` | `schema.prisma` (Task model) |
| **backend-analytics-api** | `apps/backend/src/analytics/**/*` | None |
| **backend-auth-api** | `apps/backend/src/auth/**/*` | `schema.prisma` (User/Session) |
| **backend-settings-api** | `apps/backend/src/settings/**/*` | `schema.prisma` (Settings model) |

### Frontend Files

| Spec | Owned Files | Shared Files (Append Only) |
|------|-------------|----------------------------|
| **task-creation-modal** | `src/components/tasks/TaskCreateDialog.tsx`<br>`src/components/tasks/TaskCreateForm.tsx`<br>`src/hooks/useCreateTask.ts` (edit) | `Navigation.tsx` (add route)<br>`contract-client.ts` (add method) |
| **task-detail-view** | `src/app/tasks/[id]/**/*`<br>`src/components/tasks/TaskDetail.tsx`<br>`src/components/tasks/LogViewer.tsx` | `contract-client.ts` (add method) |
| **queue-management-dashboard** | `src/app/queue/**/*`<br>`src/components/queue/**/*`<br>`src/hooks/useQueue.ts` | `Sidebar.tsx` (add link)<br>`contract-client.ts` (add method) |
| **system-monitoring-dashboard** | `src/app/monitoring/**/*`<br>`src/components/monitoring/**/*`<br>`src/hooks/useSystemMetrics.ts` | `Sidebar.tsx` (add link)<br>`contract-client.ts` (add method) |

### Shared Package Files (Contract-First)

| Package | File | Modified By | Strategy |
|---------|------|-------------|----------|
| **@cc-task-manager/schemas** | `src/task.schema.ts` | backend-tasks-api | Create new file |
| | `src/analytics.schema.ts` | backend-analytics-api | Create new file |
| | `src/auth.schema.ts` | backend-auth-api | Create new file |
| | `src/settings.schema.ts` | backend-settings-api | Create new file |
| | `src/queue.schema.ts` | queue-management-dashboard | Create new file |
| | `src/monitoring.schema.ts` | system-monitoring-dashboard | Create new file |
| | `src/index.ts` | All specs | Append exports (no conflicts) |

### E2E Test Files (Zero Conflicts)

| Spec | E2E Test File | Tests |
|------|---------------|-------|
| backend-tasks-api | `apps/frontend/e2e/tasks-api.spec.ts` | POST/GET/PATCH/DELETE /api/tasks |
| backend-analytics-api | `apps/frontend/e2e/analytics-api.spec.ts` | GET /api/analytics/* |
| backend-auth-api | `apps/frontend/e2e/auth.spec.ts` | POST /api/auth/login, /register |
| backend-settings-api | `apps/frontend/e2e/settings-api.spec.ts` | GET/PATCH /api/settings |
| task-creation-modal | `apps/frontend/e2e/task-create.spec.ts` | Modal open, form validation, submit |
| task-detail-view | `apps/frontend/e2e/task-detail.spec.ts` | Task detail page, log viewer |
| queue-management-dashboard | `apps/frontend/e2e/queue-dashboard.spec.ts` | Queue status, job list |
| system-monitoring-dashboard | `apps/frontend/e2e/monitoring.spec.ts` | Metrics display, charts |

---

## 🔒 Shared File Conflict Resolution

### 1. Database Schema (`prisma/schema.prisma`)

**Strategy**: Numbered migrations + clear model ownership

```prisma
// Migration naming: {timestamp}_{spec-name}_{description}
// Example: 20251001_backend_tasks_api_create_tasks_table.sql

// Spec: backend-tasks-api
model Task {
  id          String   @id @default(uuid())
  // ... task fields
}

// Spec: backend-auth-api
model User {
  id          String   @id @default(uuid())
  // ... user fields
}

// Spec: backend-settings-api
model Settings {
  id          String   @id @default(uuid())
  userId      String   @unique
  // ... settings fields
}
```

**Merge Strategy**:
- Each spec creates migration in separate PR
- Migrations numbered by timestamp (no conflicts)
- Models are independent (no shared columns)

### 2. API Client (`apps/frontend/src/lib/api/contract-client.ts`)

**Strategy**: Each spec adds methods in their section

```typescript
export class ApiClient {
  // ========== Spec: backend-tasks-api ==========
  async getTasks(): Promise<Task[]> { }
  async createTask(data: CreateTaskDto): Promise<Task> { }

  // ========== Spec: backend-analytics-api ==========
  async getPerformanceMetrics(): Promise<AnalyticsResponse> { }
  async getTrendData(): Promise<TrendResponse> { }

  // ========== Spec: backend-auth-api ==========
  async login(credentials: LoginDto): Promise<AuthResponse> { }
  async register(data: RegisterDto): Promise<User> { }

  // ========== Spec: backend-settings-api ==========
  async getSettings(userId: string): Promise<Settings> { }
  async updateSettings(userId: string, data: SettingsUpdate): Promise<Settings> { }
}
```

**Merge Strategy**:
- Clear section comments
- Methods added sequentially
- No overlapping method names

### 3. Navigation (`apps/frontend/src/components/layout/Navigation.tsx`)

**Strategy**: Each spec adds route in designated section

```typescript
const navigation = [
  // ========== Spec: task-detail-view ==========
  { name: 'Tasks', href: '/tasks', icon: TaskIcon },

  // ========== Spec: queue-management-dashboard ==========
  { name: 'Queue', href: '/queue', icon: QueueIcon },

  // ========== Spec: system-monitoring-dashboard ==========
  { name: 'Monitoring', href: '/monitoring', icon: MonitorIcon },
];
```

**Merge Strategy**:
- Array append only
- Each spec owns their route entry
- No modifications to existing routes

### 4. Environment Variables (`.env`)

**Strategy**: Feature-prefixed variables

```bash
# ========== Spec: backend-tasks-api ==========
TASKS_API_ENABLED=true
TASKS_MAX_CONCURRENT=50

# ========== Spec: backend-analytics-api ==========
ANALYTICS_API_ENABLED=true
ANALYTICS_CACHE_TTL=300

# ========== Spec: backend-auth-api ==========
AUTH_JWT_SECRET=xxxxx
AUTH_JWT_EXPIRES_IN=7d
AUTH_BCRYPT_ROUNDS=10

# ========== Spec: backend-settings-api ==========
SETTINGS_API_ENABLED=true

# ========== Spec: queue-management-dashboard ==========
QUEUE_DASHBOARD_ENABLED=true

# ========== Spec: system-monitoring-dashboard ==========
MONITORING_DASHBOARD_ENABLED=true
MONITORING_METRICS_INTERVAL=5000
```

**Merge Strategy**:
- Section comments per spec
- Unique prefixes (TASKS_, ANALYTICS_, AUTH_, etc.)
- No shared variables

---

## 📦 Package.json Dependencies

### Backend (`apps/backend/package.json`)

| Spec | New Dependencies | Reason |
|------|------------------|--------|
| backend-auth-api | `bcryptjs`, `@nestjs/passport`, `passport-jwt` | Password hashing, JWT auth |
| backend-analytics-api | None | Uses existing Prisma |
| backend-tasks-api | None | Uses existing NestJS |
| backend-settings-api | None | Uses existing Prisma |

### Frontend (`apps/frontend/package.json`)

| Spec | New Dependencies | Reason |
|------|------------------|--------|
| task-creation-modal | `react-hook-form`, `@hookform/resolvers` | Form management |
| task-detail-view | `react-syntax-highlighter` | Log syntax highlighting |
| queue-management-dashboard | `recharts` | Queue charts |
| system-monitoring-dashboard | `recharts`, `date-fns` | Metrics visualization |

**Merge Strategy**: Dependencies are additive, no conflicts

---

## 🧪 E2E Testing Strategy

### Test File Naming Convention
```
apps/frontend/e2e/{feature-name}.spec.ts
```

### Test Structure Per Spec
```typescript
import { test, expect } from '@playwright/test';
import { setupMockAuth } from './fixtures/auth';

test.describe('[Spec Name] E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page, 'user');
  });

  test('should [specific user flow]', async ({ page }) => {
    // Test implementation
  });
});
```

### API Contract Validation
Each backend spec includes API contract tests:
```typescript
test('API Contract: POST /api/[resource]', async ({ page }) => {
  const { requests, errors } = setupApiMonitoring(page);
  // Verify 2xx response, not 404/500
});
```

---

## 🔄 Git Branching Strategy

### Branch Naming
```
feature/{spec-name}
```

### Branch Examples
- `feature/backend-tasks-api`
- `feature/backend-analytics-api`
- `feature/backend-auth-api`
- `feature/backend-settings-api`
- `feature/task-creation-modal`
- `feature/task-detail-view`
- `feature/queue-management-dashboard`
- `feature/system-monitoring-dashboard`

### Merge Order (To Minimize Conflicts)

**Phase 1**: Backend APIs (Parallel)
1. `backend-auth-api` (others may depend on this)
2. `backend-tasks-api`
3. `backend-analytics-api`
4. `backend-settings-api`

**Phase 2**: Frontend Features (Parallel, after backend merged)
5. `task-creation-modal`
6. `task-detail-view`
7. `queue-management-dashboard`
8. `system-monitoring-dashboard`

---

## ✅ Pre-Merge Checklist

Each spec must satisfy:
- [ ] All tasks in tasks.md marked `[x]`
- [ ] E2E tests passing (Playwright)
- [ ] API contract tests passing (no 404s)
- [ ] TypeScript compilation successful
- [ ] ESLint/Prettier passing
- [ ] No modifications to files outside ownership matrix
- [ ] Environment variables documented in .env.example
- [ ] Database migration tested (if applicable)
- [ ] Shared file sections clearly commented

---

## 🎯 Success Criteria

- ✅ 8 specs created with complete requirements/design/tasks
- ✅ Zero file conflicts between specs
- ✅ All E2E tests in separate files
- ✅ Contracts defined in @cc-task-manager/schemas
- ✅ Each spec independently testable
- ✅ Clear merge order documented
- ✅ Environment-driven feature flags
- ✅ SSOT maintained (Zod schemas)

---

## 📊 Implementation Timeline

Assuming 1 developer per spec:

**Week 1**: Backend specs (4 specs × 3-5 days)
- backend-auth-api
- backend-tasks-api
- backend-analytics-api
- backend-settings-api

**Week 2**: Frontend specs (4 specs × 3-5 days)
- task-creation-modal
- task-detail-view
- queue-management-dashboard
- system-monitoring-dashboard

**Week 3**: Integration & testing
- Merge all branches
- End-to-end testing
- Bug fixes

**Total**: 3 weeks for 8 specs in parallel vs 12 weeks sequential (75% time saved)
