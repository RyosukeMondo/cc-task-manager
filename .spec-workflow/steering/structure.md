# Project Structure

## Directory Organization

```
cc-task-manager/                    # Project root
├── .spec-workflow/                 # Specification workflow management
│   ├── steering/                   # Project steering documents
│   │   ├── product.md             # Product vision and objectives
│   │   ├── tech.md                # Technology stack decisions
│   │   └── structure.md           # This document
│   ├── specs/                     # Feature specifications
│   │   └── [feature-name]/        # Individual feature specs
│   │       ├── requirements.md    # Feature requirements
│   │       ├── design.md          # Technical design
│   │       └── tasks.md           # Implementation tasks
│   └── templates/                 # Spec templates
├── apps/                          # Application packages
│   ├── frontend/                  # Next.js frontend application
│   │   ├── src/
│   │   │   ├── app/              # Next.js App Router pages
│   │   │   ├── components/       # Reusable UI components
│   │   │   │   ├── ui/           # Shadcn/ui components
│   │   │   │   └── features/     # Feature-specific components
│   │   │   ├── lib/              # Shared utilities and config
│   │   │   ├── hooks/            # Custom React hooks
│   │   │   ├── stores/           # Zustand state stores
│   │   │   └── types/            # TypeScript type definitions
│   │   ├── public/               # Static assets
│   │   └── package.json
│   ├── backend/                   # NestJS backend application
│   │   ├── src/
│   │   │   ├── auth/             # Authentication module
│   │   │   ├── tasks/            # Task management module
│   │   │   ├── users/            # User management module
│   │   │   ├── queue/            # Job queue management
│   │   │   ├── websocket/        # Real-time communication
│   │   │   ├── common/           # Shared decorators, filters, guards
│   │   │   │   ├── decorators/   # Custom decorators
│   │   │   │   ├── guards/       # Authorization guards
│   │   │   │   ├── filters/      # Exception filters
│   │   │   │   └── pipes/        # Validation pipes
│   │   │   ├── config/           # Configuration management
│   │   │   ├── database/         # Database configuration and migrations
│   │   │   └── main.ts          # Application entry point
│   │   └── package.json
│   └── worker/                    # Background task processing
│       ├── src/
│       │   ├── processors/       # BullMQ job processors
│       │   ├── claude-code/      # Claude Code integration
│       │   │   ├── wrapper.py    # Python SDK wrapper
│       │   │   └── executor.ts   # Node.js executor
│       │   ├── monitoring/       # Process monitoring utilities
│       │   └── main.ts          # Worker entry point
│       └── package.json
├── packages/                      # Shared packages
│   ├── types/                     # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── api/              # API contract types
│   │   │   ├── database/         # Database entity types
│   │   │   └── common/           # Common utility types
│   │   └── package.json
│   ├── schemas/                   # Zod validation schemas
│   │   ├── src/
│   │   │   ├── auth/             # Authentication schemas
│   │   │   ├── tasks/            # Task-related schemas
│   │   │   └── users/            # User-related schemas
│   │   └── package.json
│   └── utils/                     # Shared utilities
│       ├── src/
│       │   ├── date/             # Date manipulation utilities
│       │   ├── validation/       # Validation helpers
│       │   └── constants/        # Shared constants
│       └── package.json
├── scripts/                       # Build and deployment scripts
│   ├── build.sh                  # Production build script
│   ├── dev.sh                    # Development startup script
│   ├── deploy.sh                 # Deployment automation
│   └── migrate.sh               # Database migration script
├── docker/                       # Docker configuration
│   ├── Dockerfile.frontend       # Frontend container
│   ├── Dockerfile.backend        # Backend container
│   ├── Dockerfile.worker         # Worker container
│   └── docker-compose.yml       # Development orchestration
├── docs/                         # Project documentation
│   └── [research-files]          # Technical research documents
├── .github/                      # GitHub configuration
│   └── workflows/               # CI/CD pipelines
├── prisma/                       # Database schema and migrations
│   ├── schema.prisma            # Database schema definition
│   ├── migrations/              # Database migration files
│   └── seed.ts                  # Database seeding script
└── package.json                 # Root package.json (workspace config)
```

## Naming Conventions

### Files
- **Components**: `PascalCase` (e.g., `TaskCard.tsx`, `UserProfile.tsx`)
- **Services/Handlers**: `PascalCase` with suffix (e.g., `TaskService.ts`, `AuthGuard.ts`)
- **Utilities/Helpers**: `camelCase` (e.g., `dateUtils.ts`, `apiClient.ts`)
- **Tests**: `[filename].test.ts` or `[filename].spec.ts` (e.g., `TaskService.test.ts`)
- **Types**: `[name].types.ts` (e.g., `task.types.ts`, `api.types.ts`)
- **Schemas**: `[name].schema.ts` (e.g., `task.schema.ts`, `user.schema.ts`)

### Code
- **Classes/Types**: `PascalCase` (e.g., `TaskService`, `UserEntity`, `CreateTaskDto`)
- **Functions/Methods**: `camelCase` (e.g., `createTask`, `getUserById`, `validateInput`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_ATTEMPTS`, `DEFAULT_TIMEOUT`)
- **Variables**: `camelCase` (e.g., `taskId`, `userProfile`, `connectionStatus`)
- **Interfaces**: `PascalCase` with `I` prefix (e.g., `ITaskRepository`, `IAuthService`)
- **Enums**: `PascalCase` (e.g., `TaskStatus`, `UserRole`, `QueueEventType`)

## Import Patterns

### Import Order
1. **External dependencies**: Framework and third-party libraries
2. **Internal packages**: Shared packages from workspace
3. **Internal modules**: Same application modules (absolute imports)
4. **Relative imports**: Local file imports
5. **Type imports**: TypeScript type-only imports (using `import type`)

### Module/Package Organization
```typescript
// 1. External dependencies
import { Module } from '@nestjs/common';
import { Socket } from 'socket.io';

// 2. Internal packages
import { TaskSchema } from '@cc-task-manager/schemas';
import { ApiResponse } from '@cc-task-manager/types';

// 3. Internal modules (absolute imports from src)
import { AuthService } from 'src/auth/auth.service';
import { TaskService } from 'src/tasks/task.service';

// 4. Relative imports
import { TaskController } from './task.controller';
import { TaskRepository } from './task.repository';

// 5. Type imports
import type { User } from 'src/users/user.entity';
import type { CreateTaskRequest } from './types';
```

## Code Structure Patterns

### Module/Class Organization
```typescript
// 1. Imports/includes/dependencies
import { ... } from '...';

// 2. Constants and configuration
const DEFAULT_TIMEOUT = 30000;
const RETRY_ATTEMPTS = 3;

// 3. Type/interface definitions
interface TaskOptions {
  timeout?: number;
  retries?: number;
}

// 4. Main implementation
@Injectable()
export class TaskService {
  // Private properties first
  private readonly logger = new Logger(TaskService.name);

  // Constructor with dependency injection
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly queueService: QueueService,
  ) {}

  // Public methods
  async createTask(data: CreateTaskDto): Promise<Task> {
    // Implementation
  }

  // Private methods
  private validateTaskData(data: CreateTaskDto): void {
    // Implementation
  }
}

// 5. Helper/utility functions (if needed)
function formatTaskId(id: string): string {
  return `task_${id}`;
}

// 6. Exports/public API
export { TaskService };
export type { TaskOptions };
```

### Function/Method Organization
```typescript
async createTask(data: CreateTaskDto): Promise<Task> {
  // 1. Input validation first
  this.validateTaskData(data);

  // 2. Core logic in the middle
  const task = await this.taskRepository.create({
    ...data,
    status: TaskStatus.PENDING,
    createdAt: new Date(),
  });

  // 3. Side effects and notifications
  await this.queueService.addJob('process-task', { taskId: task.id });
  this.eventEmitter.emit('task.created', task);

  // 4. Clear return point
  return task;
}
```

### File Organization Principles
- **One primary export per file**: Each file should have one main class, function, or constant
- **Related functionality grouped together**: Keep related utilities in the same file
- **Public API at the top**: Main exports before private helpers
- **Implementation details hidden**: Use private methods and internal modules

## Code Organization Principles

1. **Single Responsibility**: Each file and class should have one clear, well-defined purpose
2. **Modularity**: Code should be organized into reusable, testable modules with clear interfaces
3. **Testability**: Structure code to be easily unit tested with dependency injection and pure functions
4. **Consistency**: Follow established patterns within the codebase for similar functionality
5. **Separation of Concerns**: Keep business logic separate from infrastructure and presentation layers

## Module Boundaries

### Application Layer Boundaries
- **Frontend ↔ Backend**: Communication only through REST API and WebSocket contracts
- **Backend ↔ Worker**: Interaction only through BullMQ job queue and shared database
- **Worker ↔ Claude Code**: Interaction through secure child_process.spawn and structured JSON

### Code Layer Boundaries
- **Controllers ↔ Services**: Controllers handle HTTP concerns, Services contain business logic
- **Services ↔ Repositories**: Services coordinate business operations, Repositories handle data access
- **Shared Packages**: Can be imported by any application but must remain framework-agnostic
- **Feature Modules**: Each feature (tasks, users, auth) is self-contained with clear external interfaces

### Dependency Direction Rules
- **Top-down**: Presentation → Business → Data layers
- **Inward**: Framework code depends on business logic, not vice versa
- **Shared Packages**: No dependencies on application-specific code
- **Cross-cutting**: Authentication, logging, and monitoring can be used across all layers

## Code Size Guidelines

### File Size Limits
- **Component Files**: Maximum 200 lines (encourage composition over large components)
- **Service Files**: Maximum 300 lines (split large services into smaller, focused services)
- **Utility Files**: Maximum 150 lines (group related utilities, separate unrelated ones)
- **Test Files**: No strict limit (comprehensive testing is priority)

### Function/Method Size
- **Functions**: Maximum 50 lines (break down complex logic into smaller functions)
- **Methods**: Maximum 30 lines (use private methods for complex operations)
- **React Components**: Maximum 100 lines (use composition and custom hooks)

### Complexity Guidelines
- **Nesting Depth**: Maximum 4 levels (use early returns and guard clauses)
- **Cyclomatic Complexity**: Target <10 per function (break down complex conditional logic)
- **Class Complexity**: Maximum 20 public methods (consider splitting large classes)

## Dashboard/Monitoring Structure

### Frontend Dashboard Organization
```
apps/frontend/src/
├── app/
│   ├── dashboard/              # Dashboard pages
│   │   ├── page.tsx           # Main dashboard
│   │   ├── tasks/             # Task management pages
│   │   └── monitoring/        # System monitoring pages
│   └── api/                   # Next.js API routes
├── components/
│   ├── dashboard/             # Dashboard-specific components
│   │   ├── TaskCard.tsx      # Individual task display
│   │   ├── TaskList.tsx      # Task collection display
│   │   ├── StatusIndicator.tsx # Real-time status display
│   │   └── ProgressChart.tsx  # Progress visualization
│   └── ui/                    # Shared UI components
└── hooks/
    └── useDashboard.ts        # Dashboard state management
```

### Real-time Communication Structure
```
apps/backend/src/websocket/
├── websocket.gateway.ts       # Main WebSocket gateway
├── events/                    # Event type definitions
├── handlers/                  # Event-specific handlers
│   ├── task-events.handler.ts
│   └── system-events.handler.ts
└── middleware/               # WebSocket middleware
    └── auth.middleware.ts    # Connection authentication
```

### Separation of Concerns
- **Dashboard Frontend**: Isolated in dedicated routes and components, can be built independently
- **Real-time Backend**: WebSocket gateway isolated from REST API, shares only data models
- **Monitoring Data**: Separate from business logic, can be disabled without affecting core functionality
- **Dashboard API**: Specific endpoints for dashboard needs, separate from main business API

## Documentation Standards

### Code Documentation Requirements
- **All public APIs**: Must have TSDoc comments describing parameters, return values, and behavior
- **Complex business logic**: Inline comments explaining the "why" behind non-obvious decisions
- **Component props**: PropTypes or TypeScript interface documentation for all React components
- **Database schemas**: Comments in Prisma schema explaining entity relationships and constraints

### File Documentation Standards
- **README files**: Required for each major module/package explaining purpose and usage
- **API Documentation**: OpenAPI specification auto-generated from Zod schemas and NestJS decorators
- **Architecture Decision Records**: Document significant architectural choices in dedicated ADR files
- **Setup Documentation**: Clear instructions for local development, testing, and deployment