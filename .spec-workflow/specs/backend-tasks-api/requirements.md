# Requirements Document - Backend Tasks API

## Introduction

The Backend Tasks API provides RESTful endpoints for CRUD operations on tasks, enabling the frontend to create, read, update, and delete tasks programmatically. This API serves as the core data layer for task management, replacing the current 404-returning placeholder endpoints detected by QA automation.

**Purpose**: Implement `/api/tasks` endpoints that return valid data instead of 404 errors, enabling full task lifecycle management.

**Value**: Enables users to manage tasks through the UI, fixes critical API contract violations (10 detected by E2E tests), and unblocks frontend task creation functionality.

## Alignment with Product Vision

From `product.md`:
- **"AI Task Management"**: This API enables create, execute, and monitor Claude Code tasks with full lifecycle management
- **"Results Preservation"**: Persistent storage of task metadata in PostgreSQL database
- **"Real-time Monitoring"**: WebSocket integration for live status updates

This spec addresses the critical gap: "Backend tasks API missing - `/api/tasks` returns 404" (from IMPLEMENTATION_GAP_ANALYSIS.md)

## Requirements

### Requirement 1: Create Task

**User Story:** As a developer using the API, I want to create tasks via POST /api/tasks, so that I can initiate new Claude Code workflows programmatically

#### Acceptance Criteria (EARS)

1. WHEN client POSTs to `/api/tasks` with valid task data THEN system SHALL return 201 Created with task object
2. WHEN task data includes required fields (title) THEN system SHALL create task in database with UUID
3. WHEN task data is invalid THEN system SHALL return 400 Bad Request with validation errors
4. WHEN task is created THEN system SHALL emit WebSocket event `task:created` to all connected clients
5. WHEN task creation succeeds THEN system SHALL return task with fields: id, title, description, status=PENDING, priority, userId, createdAt, updatedAt

### Requirement 2: List Tasks

**User Story:** As a frontend application, I want to GET /api/tasks with optional filters, so that I can display task lists to users

#### Acceptance Criteria (EARS)

1. WHEN client GETs `/api/tasks` THEN system SHALL return 200 OK with array of task objects
2. WHEN query includes `?status=PENDING` THEN system SHALL return only tasks matching that status
3. WHEN query includes `?priority=HIGH` THEN system SHALL return only high-priority tasks
4. WHEN no tasks exist THEN system SHALL return 200 OK with empty array `[]`
5. WHEN tasks exist THEN system SHALL return array sorted by createdAt DESC
6. WHEN query includes pagination params THEN system SHALL support `?limit=20&offset=0`

### Requirement 3: Get Task by ID

**User Story:** As a frontend application, I want to GET /api/tasks/:id, so that I can display full task details including logs

#### Acceptance Criteria (EARS)

1. WHEN client GETs `/api/tasks/:id` with valid UUID THEN system SHALL return 200 OK with task object
2. WHEN task ID does not exist THEN system SHALL return 404 Not Found
3. WHEN task ID is invalid UUID format THEN system SHALL return 400 Bad Request
4. WHEN task exists THEN system SHALL return complete task data including all relationships

### Requirement 4: Update Task

**User Story:** As a system component, I want to PATCH /api/tasks/:id, so that I can update task status and progress

#### Acceptance Criteria (EARS)

1. WHEN client PATCHes `/api/tasks/:id` with valid updates THEN system SHALL return 200 OK with updated task
2. WHEN update changes status field THEN system SHALL emit WebSocket event `task:updated`
3. WHEN task does not exist THEN system SHALL return 404 Not Found
4. WHEN update data is invalid THEN system SHALL return 400 Bad Request with errors
5. WHEN task is updated THEN system SHALL update `updatedAt` timestamp automatically

### Requirement 5: Delete Task

**User Story:** As a user, I want to DELETE /api/tasks/:id, so that I can remove completed or failed tasks

#### Acceptance Criteria (EARS)

1. WHEN client DELETEs `/api/tasks/:id` THEN system SHALL soft-delete task (set deletedAt timestamp)
2. WHEN task is soft-deleted THEN system SHALL return 204 No Content
3. WHEN task does not exist THEN system SHALL return 404 Not Found
4. WHEN task is deleted THEN system SHALL emit WebSocket event `task:deleted` with taskId
5. WHEN tasks are listed THEN system SHALL exclude soft-deleted tasks by default

### Requirement 6: Real-time Events

**User Story:** As a frontend application, I want to receive WebSocket events when tasks change, so that I can update UI in real-time

#### Acceptance Criteria (EARS)

1. WHEN task is created THEN system SHALL emit `task:created` event with task object
2. WHEN task is updated THEN system SHALL emit `task:updated` event with task object
3. WHEN task is deleted THEN system SHALL emit `task:deleted` event with `{ taskId: string }`
4. WHEN WebSocket client connects THEN system SHALL authenticate via JWT token
5. WHEN WebSocket event is emitted THEN system SHALL broadcast to all authenticated clients

## Non-Functional Requirements

### Code Architecture and Modularity
- **Single Responsibility Principle**: Separate controller (HTTP), service (business logic), repository (data access)
- **Modular Design**: NestJS module isolated in `apps/backend/src/tasks/` with clear boundaries
- **Dependency Management**: Use NestJS DI for TaskService, PrismaService, WebSocketGateway
- **Clear Interfaces**: DTOs define API contracts, entities define database models
- **File Ownership**: This spec owns all files in `apps/backend/src/tasks/**/*` (zero conflicts)

### Contract-Driven Development
- **Schema First**: Define Zod schemas in `@cc-task-manager/schemas/src/task.schema.ts`
- **SSOT**: Zod schemas generate TypeScript types AND validate requests
- **API Contract**: All endpoints match contract-client.ts expectations
- **Versioning**: API routes prefixed with `/api/` for future versioning

### Performance
- **Response Time**: < 200ms for 95th percentile requests
- **Pagination**: Support efficient offset-based pagination for large result sets
- **Database Queries**: Use Prisma select to avoid over-fetching
- **Caching**: No caching at API level (rely on frontend React Query)

### Security
- **Authentication**: All endpoints protected with JwtAuthGuard (require valid JWT)
- **Authorization**: Users can only access their own tasks (userId filter)
- **Input Validation**: Zod schemas validate all inputs at API boundary
- **SQL Injection Prevention**: Prisma ORM parameterizes all queries
- **Rate Limiting**: Apply global rate limiter (100 req/min per IP)

### Reliability
- **Error Handling**: Return proper HTTP status codes (200, 201, 400, 404, 500)
- **Transaction Safety**: Database operations wrapped in transactions where needed
- **Idempotency**: Update/delete operations are idempotent
- **Logging**: Log all errors with correlation IDs for debugging

### Usability
- **Error Messages**: Return user-friendly validation error messages
- **Consistent Format**: All responses follow standard ApiResponse<T> format
- **Documentation**: OpenAPI spec auto-generated from Zod schemas
- **Testing**: E2E tests in `apps/frontend/e2e/tasks-api.spec.ts` validate all endpoints

### Environment-Driven Configuration
- **Feature Flags**: `TASKS_API_ENABLED=true` to enable/disable API
- **Timeouts**: `TASKS_API_TIMEOUT=30000` for long-running operations
- **Limits**: `TASKS_MAX_CONCURRENT=50` for concurrent task execution

## Success Criteria

- ✅ All API endpoints return 2xx (no 404 errors) - validated by E2E tests
- ✅ Frontend can create tasks via modal - unblocks task-creation-modal spec
- ✅ Task list displays real data - replaces empty state with actual tasks
- ✅ WebSocket events work - real-time updates without page refresh
- ✅ Zero API contract violations - fixes all 10 detected issues
- ✅ Authentication works - no more hardcoded userIds

## Dependencies

**Blocked By**:
- `backend-auth-api` - Requires JwtAuthGuard and user authentication

**Blocks**:
- `task-creation-modal` - Frontend needs POST /api/tasks endpoint
- `task-detail-view` - Frontend needs GET /api/tasks/:id endpoint

**Shared Files** (Append-only, no conflicts):
- `prisma/schema.prisma` - Add Task model
- `apps/frontend/src/lib/api/contract-client.ts` - Add task methods
