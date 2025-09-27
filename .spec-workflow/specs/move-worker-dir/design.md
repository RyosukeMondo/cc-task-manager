# Design Document

## Overview

This design document outlines the architecture for relocating the worker implementation from `src/worker/` to `apps/worker/` to establish it as an independent application within the monorepo structure. The worker will become a standalone NestJS application dedicated to background task processing with its own package.json, build configuration, and deployment independence while maintaining seamless integration with the existing system through shared database and queue infrastructure.

## Steering Document Alignment

### Technical Standards (tech.md)

The design follows documented technical patterns:
- **NestJS 10+**: Worker maintains NestJS modular architecture with dependency injection
- **TypeScript 5.0+**: Strict mode and type safety preserved across the application boundary
- **BullMQ**: Job queue system remains unchanged for reliable task processing
- **PM2 Process Management**: Worker becomes independently manageable process
- **Prisma ORM**: Shared database access through workspace packages
- **Docker Containerization**: Independent container build capability

### Project Structure (structure.md)

Implementation follows project organization conventions:
- **Application Separation**: Worker becomes independent application under `apps/worker/`
- **Shared Packages**: Continues using `packages/types`, `packages/schemas`, `packages/utils`
- **Module Boundaries**: Maintains clear separation between worker and backend applications
- **Naming Conventions**: Follows established TypeScript and file naming patterns
- **Directory Organization**: Source code organized under `apps/worker/src/` with proper module structure

## Code Reuse Analysis

### Existing Components to Leverage
- **Configuration System**: Reuse `ConfigModule` pattern for worker-specific configuration
- **Shared Types**: Continue using `@cc-task-manager/types` workspace package
- **Validation Schemas**: Leverage `@cc-task-manager/schemas` for data validation
- **Utility Functions**: Utilize `@cc-task-manager/utils` for common operations
- **Database Models**: Access shared Prisma schema through workspace setup

### Integration Points
- **Job Queue System**: BullMQ connection remains through Redis infrastructure
- **Database Access**: PostgreSQL connection through shared Prisma client configuration
- **Event Communication**: Event emitter system for cross-application coordination
- **Configuration Management**: Environment-based configuration following existing patterns
- **Monitoring Integration**: State monitoring continues through existing logging infrastructure

## Architecture

The worker application will be restructured as an independent NestJS application while maintaining architectural consistency with the overall system design.

### Modular Design Principles
- **Single Application Responsibility**: Worker handles only background job processing concerns
- **Component Isolation**: Services remain focused on specific worker capabilities
- **Service Layer Separation**: Clear separation between job processing, state management, and monitoring
- **Utility Modularity**: Claude Code integration and process management as focused modules

```mermaid
graph TD
    A[Worker App] --> B[Worker Module]
    B --> C[Claude Code Processor]
    B --> D[Process Manager Service]
    B --> E[State Monitor Service]
    B --> F[Claude Code Client Service]
    B --> G[Worker Service]

    A --> H[Shared Packages]
    H --> I[@cc-task-manager/types]
    H --> J[@cc-task-manager/schemas]
    H --> K[@cc-task-manager/utils]

    A --> L[External Dependencies]
    L --> M[Redis/BullMQ]
    L --> N[PostgreSQL/Prisma]
    L --> O[Python SDK Process]
```

## Components and Interfaces

### Worker Application Entry Point
- **Purpose:** Independent application bootstrap and configuration
- **Interfaces:** NestJS application factory, configuration loading, graceful shutdown
- **Dependencies:** ConfigModule, WorkerModule, logging infrastructure
- **Reuses:** Existing configuration patterns, shared utilities

### Worker Module
- **Purpose:** Core dependency injection container for worker services
- **Interfaces:** NestJS module decorator, provider exports, import management
- **Dependencies:** BullMQ, EventEmitter, ConfigModule
- **Reuses:** Existing module structure, configuration patterns

### Claude Code Processor
- **Purpose:** BullMQ job processor for Claude Code task execution
- **Interfaces:** Job processing methods, error handling, progress reporting
- **Dependencies:** ProcessManagerService, StateMonitorService, ClaudeCodeClientService
- **Reuses:** Existing processor logic, error handling patterns

### Process Manager Service
- **Purpose:** Child process lifecycle management for Python SDK execution
- **Interfaces:** Process spawning, monitoring, cleanup operations
- **Dependencies:** Node.js child_process, filesystem operations
- **Reuses:** Current process management logic, monitoring patterns

### State Monitor Service
- **Purpose:** Real-time state tracking and event emission
- **Interfaces:** State update methods, event emission, monitoring hooks
- **Dependencies:** EventEmitter, logging infrastructure
- **Reuses:** Existing state tracking, event patterns

### Claude Code Client Service
- **Purpose:** Python SDK wrapper integration and communication
- **Interfaces:** Task execution commands, result parsing, error handling
- **Dependencies:** Process spawning, JSON communication protocols
- **Reuses:** Current SDK integration, communication patterns

### Worker Service
- **Purpose:** High-level worker coordination and queue management
- **Interfaces:** Public worker API, queue interaction, service orchestration
- **Dependencies:** All worker services, BullMQ queue
- **Reuses:** Existing service coordination, queue patterns

## Data Models

### Worker Configuration
```typescript
interface WorkerConfig {
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  maxConcurrentJobs: number;
  jobTimeout: number;
  retryAttempts: number;
  logLevel: string;
}
```

### Job Data Structure
```typescript
interface ClaudeCodeJobData {
  taskId: string;
  userId: string;
  command: string;
  arguments: Record<string, any>;
  workingDirectory: string;
  timeout?: number;
  metadata?: Record<string, any>;
}
```

### Process State Model
```typescript
interface ProcessState {
  processId: string;
  status: 'starting' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  progress: number;
  logs: string[];
  error?: string;
}
```

## Error Handling

### Error Scenarios
1. **Worker Application Startup Failure**
   - **Handling:** Graceful degradation with detailed error logging, configuration validation
   - **User Impact:** Background job processing unavailable, clear error messages in logs

2. **Job Processing Failure**
   - **Handling:** Automatic retry with exponential backoff, error categorization, dead letter queue
   - **User Impact:** Task marked as failed with retry information, detailed error reporting

3. **Python SDK Process Crash**
   - **Handling:** Process restart, state recovery, job re-queuing if possible
   - **User Impact:** Transparent recovery for recoverable failures, clear error reporting for permanent failures

4. **Database Connection Loss**
   - **Handling:** Connection retry with circuit breaker pattern, job state preservation
   - **User Impact:** Temporary processing delay, automatic recovery when connection restored

5. **Redis Queue Unavailability**
   - **Handling:** Connection retry, graceful degradation, process monitoring continuation
   - **User Impact:** Job processing paused, automatic resumption when queue available

## Testing Strategy

### Unit Testing
- **Service Testing**: Mock dependencies for isolated worker service testing
- **Processor Testing**: Job processing logic with mocked external dependencies
- **Configuration Testing**: Environment configuration loading and validation
- **Error Handling Testing**: Exception scenarios and recovery mechanisms

### Integration Testing
- **Queue Integration**: BullMQ job processing with Redis backend
- **Database Integration**: Prisma database operations through shared schemas
- **Process Integration**: Python SDK communication and lifecycle management
- **Event Integration**: Event emission and cross-service communication

### End-to-End Testing
- **Full Job Processing**: Complete task execution from queue to completion
- **Error Recovery**: Failure scenarios and automatic recovery mechanisms
- **Performance Testing**: Concurrent job processing and resource utilization
- **Deployment Testing**: Independent application deployment and connectivity