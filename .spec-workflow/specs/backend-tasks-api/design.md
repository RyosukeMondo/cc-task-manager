# Design Document - Backend Tasks API

## Architecture Overview

The Backend Tasks API follows NestJS best practices with a layered architecture:

```
Controller (HTTP) → Service (Business Logic) → Repository (Data Access) → Database (Prisma)
                                    ↓
                            WebSocket Gateway (Real-time events)
```

### Module Structure

```typescript
TasksModule
├── TasksController (HTTP endpoints)
├── TasksService (Business logic)
├── TasksRepository (Database operations)
├── TasksGateway (WebSocket events)
└── DTOs
    ├── CreateTaskDto
    ├── UpdateTaskDto
    ├── TaskFilterDto
    └── TaskResponseDto
```

## Data Model

### Prisma Schema

```prisma
model Task {
  id          String   @id @default(uuid())
  title       String   @db.VarChar(200)
  description String?  @db.Text
  status      TaskStatus @default(PENDING)
  priority    TaskPriority @default(MEDIUM)
  userId      String   @db.VarChar(36)

  // Execution metadata
  startedAt   DateTime?
  completedAt DateTime?
  failedAt    DateTime?
  errorMessage String? @db.Text

  // Logs (JSONB for flexibility)
  logs        Json[]   @default([])

  // Timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime? // Soft delete

  // Relations
  user        User     @relation(fields: [userId], references: [id])

  @@index([userId, status])
  @@index([createdAt])
  @@map("tasks")
}

enum TaskStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

### Migration Strategy

```bash
# Migration file: 20251001_backend_tasks_api_create_tasks_table.sql
# Run: npx prisma migrate dev --name create_tasks_table
```

## API Endpoints

### 1. Create Task

```typescript
POST /api/tasks
Authorization: Bearer <jwt>

Request Body:
{
  "title": string (required, max 200 chars),
  "description"?: string (optional, max 2000 chars),
  "priority"?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" (default: MEDIUM)
}

Response (201 Created):
{
  "id": "uuid",
  "title": "Example task",
  "description": null,
  "status": "PENDING",
  "priority": "MEDIUM",
  "userId": "user-uuid",
  "createdAt": "2025-10-01T12:00:00Z",
  "updatedAt": "2025-10-01T12:00:00Z"
}

Errors:
- 400 Bad Request: Invalid input
- 401 Unauthorized: No JWT
- 422 Unprocessable Entity: Validation failed
```

### 2. List Tasks

```typescript
GET /api/tasks?status=PENDING&priority=HIGH&limit=20&offset=0
Authorization: Bearer <jwt>

Query Parameters:
- status?: TaskStatus
- priority?: TaskPriority
- limit?: number (default: 20, max: 100)
- offset?: number (default: 0)

Response (200 OK):
{
  "data": Task[],
  "meta": {
    "total": number,
    "limit": number,
    "offset": number
  }
}
```

### 3. Get Task by ID

```typescript
GET /api/tasks/:id
Authorization: Bearer <jwt>

Response (200 OK):
{
  "id": "uuid",
  "title": "Example task",
  // ... all task fields including logs
  "logs": [
    { "timestamp": "2025-10-01T12:00:00Z", "level": "info", "message": "Started task" }
  ]
}

Errors:
- 400 Bad Request: Invalid UUID
- 404 Not Found: Task doesn't exist
```

### 4. Update Task

```typescript
PATCH /api/tasks/:id
Authorization: Bearer <jwt>

Request Body (partial):
{
  "status"?: TaskStatus,
  "priority"?: TaskPriority,
  "errorMessage"?: string
}

Response (200 OK):
{ /* updated task */ }

Errors:
- 400 Bad Request: Invalid input
- 404 Not Found: Task doesn't exist
```

### 5. Delete Task

```typescript
DELETE /api/tasks/:id
Authorization: Bearer <jwt>

Response (204 No Content)

Errors:
- 404 Not Found: Task doesn't exist
```

## Component Design

### TasksController

```typescript
@Controller('api/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  async create(@Body() dto: CreateTaskDto, @User() user): Promise<TaskResponseDto> {
    return this.tasksService.create(dto, user.id);
  }

  @Get()
  async findAll(@Query() filter: TaskFilterDto, @User() user): Promise<PaginatedResponse<Task>> {
    return this.tasksService.findAll(filter, user.id);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @User() user): Promise<Task> {
    return this.tasksService.findOne(id, user.id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @User() user
  ): Promise<Task> {
    return this.tasksService.update(id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string, @User() user): Promise<void> {
    return this.tasksService.remove(id, user.id);
  }
}
```

### TasksService

```typescript
@Injectable()
export class TasksService {
  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly tasksGateway: TasksGateway,
    private readonly logger: Logger
  ) {}

  async create(dto: CreateTaskDto, userId: string): Promise<Task> {
    const task = await this.tasksRepository.create({
      ...dto,
      userId,
      status: TaskStatus.PENDING
    });

    // Emit WebSocket event
    this.tasksGateway.emitTaskCreated(task);

    this.logger.log(`Task created: ${task.id}`);
    return task;
  }

  async findAll(filter: TaskFilterDto, userId: string): Promise<PaginatedResponse<Task>> {
    const { status, priority, limit = 20, offset = 0 } = filter;

    const [tasks, total] = await this.tasksRepository.findAndCount({
      where: {
        userId,
        status,
        priority,
        deletedAt: null // Exclude soft-deleted
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    });

    return {
      data: tasks,
      meta: { total, limit, offset }
    };
  }

  async findOne(id: string, userId: string): Promise<Task> {
    const task = await this.tasksRepository.findUnique({
      where: { id, userId, deletedAt: null }
    });

    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }

    return task;
  }

  async update(id: string, dto: UpdateTaskDto, userId: string): Promise<Task> {
    // Verify ownership
    await this.findOne(id, userId);

    const updated = await this.tasksRepository.update(id, dto);

    // Emit WebSocket event
    this.tasksGateway.emitTaskUpdated(updated);

    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId);

    // Soft delete
    await this.tasksRepository.update(id, { deletedAt: new Date() });

    this.tasksGateway.emitTaskDeleted(id);
  }
}
```

### TasksRepository

```typescript
@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTaskData): Promise<Task> {
    return this.prisma.task.create({ data });
  }

  async findUnique(where: Prisma.TaskWhereUniqueInput): Promise<Task | null> {
    return this.prisma.task.findUnique({ where });
  }

  async findAndCount(params: {
    where?: Prisma.TaskWhereInput;
    orderBy?: Prisma.TaskOrderByWithRelationInput;
    skip?: number;
    take?: number;
  }): Promise<[Task[], number]> {
    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany(params),
      this.prisma.task.count({ where: params.where })
    ]);

    return [tasks, total];
  }

  async update(id: string, data: Prisma.TaskUpdateInput): Promise<Task> {
    return this.prisma.task.update({
      where: { id },
      data
    });
  }
}
```

### TasksGateway (WebSocket)

```typescript
@WebSocketGateway({ namespace: 'tasks' })
export class TasksGateway {
  @WebSocketServer()
  server: Server;

  emitTaskCreated(task: Task): void {
    this.server.emit('task:created', task);
  }

  emitTaskUpdated(task: Task): void {
    this.server.emit('task:updated', task);
  }

  emitTaskDeleted(taskId: string): void {
    this.server.emit('task:deleted', { taskId });
  }
}
```

## DTOs and Validation

### CreateTaskDto

```typescript
// Located at: @cc-task-manager/schemas/src/task.schema.ts
import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM')
});

export type CreateTaskDto = z.infer<typeof createTaskSchema>;
```

### UpdateTaskDto

```typescript
export const updateTaskSchema = z.object({
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  errorMessage: z.string().optional()
});

export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;
```

### TaskFilterDto

```typescript
export const taskFilterSchema = z.object({
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0)
});

export type TaskFilterDto = z.infer<typeof taskFilterSchema>;
```

## File Structure

```
apps/backend/src/tasks/
├── tasks.module.ts                # Module definition with DI
├── tasks.controller.ts            # HTTP endpoints
├── tasks.service.ts               # Business logic
├── tasks.repository.ts            # Database operations
├── tasks.gateway.ts               # WebSocket events
├── dto/
│   ├── create-task.dto.ts         # Import from schemas package
│   ├── update-task.dto.ts         # Import from schemas package
│   └── task-filter.dto.ts         # Query params validation
└── entities/
    └── task.entity.ts             # Response type definition

packages/schemas/src/
├── task.schema.ts                 # Zod schemas (SSOT)
└── index.ts                       # Export schemas

apps/frontend/src/lib/api/
└── contract-client.ts             # Add task methods (getTasks, createTask, etc.)
```

## Integration Points

### 1. Authentication Integration

```typescript
// tasks.module.ts
@Module({
  imports: [AuthModule], // Provides JwtAuthGuard
  controllers: [TasksController],
  providers: [TasksService, TasksRepository, TasksGateway]
})
export class TasksModule {}
```

### 2. WebSocket Authentication

```typescript
// tasks.gateway.ts
@UseGuards(WsJwtGuard)
@WebSocketGateway({ namespace: 'tasks' })
export class TasksGateway {
  @SubscribeMessage('subscribe')
  handleSubscribe(@ConnectedSocket() client: Socket): void {
    // Client authenticated via JWT in handshake
  }
}
```

### 3. Frontend API Client

```typescript
// apps/frontend/src/lib/api/contract-client.ts

// ========== Spec: backend-tasks-api ==========
export class ApiClient {
  async getTasks(filter?: TaskFilterDto): Promise<PaginatedResponse<Task>> {
    const params = new URLSearchParams(filter as any);
    return this.http.get(`/api/tasks?${params}`);
  }

  async createTask(data: CreateTaskDto): Promise<Task> {
    return this.http.post('/api/tasks', data);
  }

  async getTaskById(id: string): Promise<Task> {
    return this.http.get(`/api/tasks/${id}`);
  }

  async updateTask(id: string, data: UpdateTaskDto): Promise<Task> {
    return this.http.patch(`/api/tasks/${id}`, data);
  }

  async deleteTask(id: string): Promise<void> {
    return this.http.delete(`/api/tasks/${id}`);
  }
}
```

## Error Handling

```typescript
// Global exception filter
@Catch()
export class TasksExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof NotFoundException) {
      return response.status(404).json({
        statusCode: 404,
        message: exception.message,
        error: 'Not Found'
      });
    }

    if (exception instanceof BadRequestException) {
      return response.status(400).json({
        statusCode: 400,
        message: exception.message,
        error: 'Bad Request'
      });
    }

    // Default to 500
    return response.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error'
    });
  }
}
```

## Security Considerations

1. **Authentication**: All endpoints require valid JWT via `JwtAuthGuard`
2. **Authorization**: Users can only access their own tasks (userId filter)
3. **Input Validation**: Zod schemas validate all inputs at API boundary
4. **SQL Injection Prevention**: Prisma ORM parameterizes all queries
5. **Rate Limiting**: Global rate limiter applies (100 req/min per IP)

## Performance Optimizations

1. **Database Indexes**: Composite index on (userId, status) for fast filtering
2. **Pagination**: Offset-based pagination prevents loading all tasks
3. **Prisma Select**: Only select needed fields (avoid over-fetching)
4. **Connection Pooling**: Prisma manages connection pool automatically

## Testing Strategy

```typescript
// apps/frontend/e2e/tasks-api.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Tasks API E2E', () => {
  test('should create task via POST /api/tasks', async ({ request }) => {
    const response = await request.post('/api/tasks', {
      data: { title: 'Test task', priority: 'HIGH' }
    });

    expect(response.status()).toBe(201);
    const task = await response.json();
    expect(task.title).toBe('Test task');
    expect(task.status).toBe('PENDING');
  });

  test('should list tasks via GET /api/tasks', async ({ request }) => {
    const response = await request.get('/api/tasks?status=PENDING');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('should return 404 for non-existent task', async ({ request }) => {
    const response = await request.get('/api/tasks/00000000-0000-0000-0000-000000000000');
    expect(response.status()).toBe(404);
  });
});
```

## Environment Variables

```bash
# .env
TASKS_API_ENABLED=true
TASKS_API_TIMEOUT=30000           # 30 seconds
TASKS_MAX_CONCURRENT=50           # Max concurrent tasks
```

## Migration Path

1. Create Prisma migration
2. Implement TasksModule with all layers
3. Add to backend main.ts
4. Update frontend contract-client.ts
5. Run E2E tests
6. Deploy to staging
