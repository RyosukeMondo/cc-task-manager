# Tasks - Backend Tasks API

- [x] 1. Create Prisma Task model with enums
  - File: prisma/schema.prisma
  - Add Task model with fields: id, title, description, status, priority, userId, startedAt, completedAt, failedAt, errorMessage, logs, createdAt, updatedAt, deletedAt
  - Add TaskStatus enum: PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
  - Add TaskPriority enum: LOW, MEDIUM, HIGH, URGENT
  - Add indexes: (userId, status), (createdAt)
  - Add User relation (FK to userId)
  - Purpose: Establish database schema for task persistence
  - _Leverage: prisma/schema.prisma (existing User model)_
  - _Requirements: 1.1, 1.2_
  - _Prompt: Role: Database Engineer with expertise in Prisma ORM and PostgreSQL | Task: Create comprehensive Task model schema following requirements 1.1 and 1.2, with proper indexes and relations to existing User model | Restrictions: Must maintain referential integrity, do not modify existing models, follow Prisma naming conventions | Success: Schema validates with npx prisma format, all fields properly typed, indexes optimize common queries_

- [x] 2. Generate and apply Prisma migration
  - File: prisma/migrations/
  - Run: npx prisma migrate dev --name create_tasks_table
  - Purpose: Apply database schema changes
  - _Leverage: prisma/schema.prisma_
  - _Requirements: 1.1_
  - _Prompt: Role: DevOps Engineer with expertise in database migrations | Task: Generate and apply Prisma migration for Task model safely | Restrictions: Must ensure migration is reversible, do not drop existing tables, maintain data integrity | Success: Migration file created, database updated, can query tasks table via Prisma Studio_

- [x] 3. Create TasksModule with dependency injection
  - File: apps/backend/src/tasks/tasks.module.ts
  - Import AuthModule (provides JwtAuthGuard), PrismaModule
  - Provide: TasksService, TasksRepository, TasksGateway
  - Export: TasksService
  - Purpose: Configure NestJS module with proper dependency injection
  - _Leverage: apps/backend/src/auth/auth.module.ts_
  - _Requirements: Non-functional (Modularity)_
  - _Prompt: Role: NestJS Developer with expertise in module architecture and dependency injection | Task: Create TasksModule with proper DI configuration following NestJS best practices | Restrictions: Must not create circular dependencies, follow existing module patterns, ensure proper provider registration | Success: Module compiles without errors, all dependencies inject correctly, no circular dependency warnings_

- [x] 4. Define Zod schemas and DTOs
  - File: packages/schemas/src/task.schema.ts
  - Create createTaskSchema: title (required, max 200), description (optional, max 2000), priority (enum, default MEDIUM)
  - Create updateTaskSchema: status, priority, errorMessage (all optional)
  - Create taskFilterSchema: status, priority, limit (1-100, default 20), offset (min 0, default 0)
  - Export TypeScript types from schemas
  - Purpose: Establish single source of truth for validation
  - _Leverage: packages/schemas/src/index.ts_
  - _Requirements: 1.1, 1.2, 1.3, Non-functional (Contract-Driven, SSOT)_
  - _Prompt: Role: TypeScript Developer specializing in type systems and Zod validation | Task: Define comprehensive Zod schemas for task operations following requirements 1.1-1.3 as SSOT for types and validation | Restrictions: Must generate TypeScript types from schemas, maintain validation consistency between frontend and backend, follow existing schema patterns | Success: Schemas validate correctly, TypeScript types generated, frontend and backend share identical validation_

- [x] 5. Implement TasksRepository (data access layer)
  - File: apps/backend/src/tasks/tasks.repository.ts
  - Implement: create(data), findUnique(where), findAndCount(params), update(id, data)
  - All methods use Prisma client with proper error handling
  - Purpose: Isolate database operations from business logic
  - _Leverage: @nestjs/common (Injectable), @prisma/client_
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - _Prompt: Role: Backend Developer with expertise in repository pattern and Prisma ORM | Task: Implement TasksRepository data access layer following requirements 2.1-2.5 using Prisma best practices | Restrictions: Must not contain business logic, use parameterized queries only, maintain transaction safety, follow repository pattern | Success: All CRUD methods work correctly, proper error handling, queries are efficient with correct indexes_

- [x] 6. Implement TasksService (business logic)
  - File: apps/backend/src/tasks/tasks.service.ts
  - Implement: create(dto, userId), findAll(filter, userId), findOne(id, userId), update(id, dto, userId), remove(id, userId)
  - Add ownership verification, emit WebSocket events, handle soft deletes
  - Purpose: Provide business logic layer for task operations
  - _Leverage: apps/backend/src/tasks/tasks.repository.ts, apps/backend/src/tasks/tasks.gateway.ts_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - _Prompt: Role: Backend Developer with expertise in service layer architecture and NestJS | Task: Implement TasksService business logic following requirements 1.1-1.5 with proper ownership verification and event emission | Restrictions: Must enforce user ownership, emit WebSocket events for all mutations, use soft deletes only, maintain separation from data layer | Success: All CRUD operations work with ownership enforced, WebSocket events emit correctly, business rules properly encapsulated_

- [x] 7. Implement TasksController (REST endpoints)
  - File: apps/backend/src/tasks/tasks.controller.ts
  - Implement: POST /api/tasks, GET /api/tasks, GET /api/tasks/:id, PATCH /api/tasks/:id, DELETE /api/tasks/:id
  - All routes protected with @UseGuards(JwtAuthGuard), extract userId from @User()
  - Purpose: Expose HTTP API endpoints for task operations
  - _Leverage: apps/backend/src/tasks/tasks.service.ts, apps/backend/src/auth/guards/jwt-auth.guard.ts_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - _Prompt: Role: API Developer with expertise in RESTful design and NestJS controllers | Task: Implement TasksController REST endpoints following requirements 1.1-1.5 with proper authentication and status codes | Restrictions: Must return correct HTTP status codes (200, 201, 204, 400, 404), require authentication on all routes, follow REST conventions | Success: All endpoints work with correct status codes, authentication enforced, API contract matches design_

- [ ] 8. Implement TasksGateway (WebSocket events)
  - File: apps/backend/src/tasks/tasks.gateway.ts
  - Create @WebSocketGateway({ namespace: 'tasks' })
  - Implement: emitTaskCreated(task), emitTaskUpdated(task), emitTaskDeleted(taskId)
  - Purpose: Enable real-time task updates via WebSocket
  - _Leverage: @nestjs/websockets, socket.io_
  - _Requirements: 1.6_
  - _Prompt: Role: Real-time Developer with expertise in WebSocket and Socket.IO | Task: Implement TasksGateway for real-time events following requirement 1.6 | Restrictions: Must broadcast to all authenticated clients, use proper event names (task:created, task:updated, task:deleted), handle connection lifecycle | Success: Events broadcast to all connected clients, WebSocket authentication works, events contain correct data_

- [ ] 9. Add tasks methods to contract-client.ts
  - File: apps/frontend/src/lib/api/contract-client.ts
  - Add section comment: // ========== Spec: backend-tasks-api ==========
  - Add methods: getTasks(filter), createTask(data), getTaskById(id), updateTask(id, data), deleteTask(id)
  - Purpose: Provide type-safe API client for frontend
  - _Leverage: packages/schemas/src/task.schema.ts_
  - _Requirements: Non-functional (Contract-Driven)_
  - _Prompt: Role: Full-stack Developer with expertise in API client design and TypeScript | Task: Add type-safe task API methods to contract-client following contract-driven principles | Restrictions: Must use shared Zod schemas for types, maintain section comments for parallel development, follow existing client patterns | Success: All API methods are type-safe, frontend can call without type errors, follows contract-client conventions_

- [ ] 10. Create E2E tests for all endpoints
  - File: apps/frontend/e2e/tasks-api.spec.ts
  - Test: POST /api/tasks creates task (201), GET /api/tasks returns list (200), GET /api/tasks/:id returns task (200/404), PATCH updates (200), DELETE soft-deletes (204), all require auth (401 without JWT)
  - Purpose: Validate API contract compliance
  - _Leverage: @playwright/test_
  - _Requirements: All, Non-functional (Testing)_
  - _Prompt: Role: QA Engineer with expertise in E2E testing and Playwright | Task: Create comprehensive E2E tests for all task API endpoints validating requirements and API contracts | Restrictions: Must test all HTTP status codes, verify authentication, test error scenarios, use Playwright request fixture | Success: All tests pass, API contract violations detected (no 404s), auth enforcement verified_

- [ ] 11. Add environment variables and register module
  - File: .env.example, apps/backend/src/main.ts
  - Add to .env.example: TASKS_API_ENABLED, TASKS_API_TIMEOUT, TASKS_MAX_CONCURRENT
  - Import TasksModule in backend main.ts
  - Purpose: Configure feature flags and deployment
  - _Leverage: apps/backend/src/main.ts_
  - _Requirements: Non-functional (Environment-Driven)_
  - _Prompt: Role: DevOps Engineer with expertise in configuration management | Task: Add environment variables and register TasksModule for deployment following environment-driven principles | Restrictions: Must document all variables in .env.example, use feature flags appropriately, maintain module registration order | Success: Backend starts successfully, environment variables work, /api/tasks endpoint responds_
