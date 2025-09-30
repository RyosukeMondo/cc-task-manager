import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { TaskPerformanceService } from './middleware/task-performance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TaskOwnershipGuard, BypassOwnership } from './guards/task-ownership.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JWTPayload } from '../schemas/auth.schemas';
import {
  CreateTaskDto,
  UpdateTaskDto,
  TaskQueryDto,
  TaskResponseDto,
  PaginatedTaskResponseDto,
  TaskStatusUpdateDto,
  BulkTaskOperationDto,
  TaskMetricsDto,
  TaskPriority,
  TaskStatus,
  validateCreateTask,
  validateUpdateTask,
  validateTaskQuery,
  validateTaskStatusUpdate,
  validateBulkTaskOperation,
} from '../../../../packages/schemas/src/tasks/task-schemas';

/**
 * Task CRUD API Controller
 *
 * Provides comprehensive REST API endpoints for task management with:
 * - Full CRUD operations (Create, Read, Update, Delete)
 * - Advanced filtering, sorting, and pagination
 * - Bulk operations for efficiency
 * - Real-time status updates
 * - Performance monitoring and analytics
 *
 * Follows SOLID principles:
 * - SRP: Focused solely on HTTP request/response handling
 * - DIP: Depends on TasksService abstraction
 * - ISP: Specific interfaces for each operation type
 *
 * Implements contract-driven design with comprehensive OpenAPI documentation
 * and fail-fast validation using Zod schemas.
 */
@ApiTags('Task Management')
@Controller('api/v1/tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class TaskController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly performanceService: TaskPerformanceService,
  ) {}

  /**
   * Create a new task
   *
   * Creates a new task with comprehensive validation and automatic
   * assignment to the authenticated user as the creator.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new task',
    description: `Creates a new task with the provided details. The authenticated user will be automatically set as the creator.

    **Business Rules:**
    - Title is required and must be between 1-200 characters
    - Prompt is required and must not exceed 10,000 characters
    - Scheduled time (if provided) must be in the future
    - Tags are limited to 10 maximum with 50 characters each
    - Project ID must exist if provided

    **Performance:** Typically completes in <100ms`,
  })
  @ApiBody({
    type: 'object',
    description: 'Task creation data',
    schema: {
      type: 'object',
      required: ['title', 'prompt'],
      properties: {
        title: {
          type: 'string',
          minLength: 1,
          maxLength: 200,
          description: 'Task title (required)',
          example: 'Implement user authentication system',
        },
        description: {
          type: 'string',
          maxLength: 1000,
          description: 'Optional task description',
          example: 'Create JWT-based authentication with role-based access control',
        },
        prompt: {
          type: 'string',
          minLength: 1,
          maxLength: 10000,
          description: 'Task execution prompt (required)',
          example: 'Implement a secure authentication system using JWT tokens...',
        },
        config: {
          type: 'object',
          description: 'Optional task configuration',
          properties: {
            timeout: {
              type: 'number',
              minimum: 1,
              maximum: 3600,
              description: 'Task timeout in seconds',
              example: 1800,
            },
            retryAttempts: {
              type: 'number',
              minimum: 0,
              maximum: 5,
              description: 'Number of retry attempts',
              example: 3,
            },
            priority: {
              type: 'string',
              enum: Object.values(TaskPriority),
              description: 'Task priority level',
              example: TaskPriority.HIGH,
            },
          },
        },
        projectId: {
          type: 'string',
          format: 'uuid',
          description: 'Optional project association',
          example: '550e8400-e29b-41d4-a716-446655440000',
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
            maxLength: 50,
          },
          maxItems: 10,
          description: 'Task tags for categorization',
          example: ['authentication', 'security', 'backend'],
        },
        scheduledAt: {
          type: 'string',
          format: 'date-time',
          description: 'Optional scheduled execution time (must be future)',
          example: '2024-01-15T10:00:00Z',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Task created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        description: { type: 'string', nullable: true },
        prompt: { type: 'string' },
        status: { type: 'string', enum: Object.values(TaskStatus) },
        priority: { type: 'string', enum: Object.values(TaskPriority) },
        progress: { type: 'number', nullable: true, minimum: 0, maximum: 1 },
        config: { type: 'object', nullable: true },
        createdBy: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
          },
        },
        project: {
          type: 'object',
          nullable: true,
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
          },
        },
        tags: { type: 'array', items: { type: 'string' } },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        scheduledAt: { type: 'string', format: 'date-time', nullable: true },
        startedAt: { type: 'string', format: 'date-time', nullable: true },
        completedAt: { type: 'string', format: 'date-time', nullable: true },
        estimatedDuration: { type: 'number', nullable: true },
        actualDuration: { type: 'number', nullable: true },
        errorMessage: { type: 'string', nullable: true },
        retryCount: { type: 'number', default: 0 },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid task data provided',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['Title is required', 'Prompt must be 10000 characters or less'],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Internal server error' },
      },
    },
  })
  async createTask(
    @Body() createTaskData: unknown,
    @CurrentUser() user: JWTPayload,
  ): Promise<TaskResponseDto> {
    // Fail-fast validation using Zod schema
    const validatedData = validateCreateTask(createTaskData);
    return this.tasksService.createTask(validatedData, user.sub);
  }

  /**
   * Retrieve tasks with advanced filtering and pagination
   *
   * Supports comprehensive filtering by status, priority, project,
   * date ranges, and full-text search with efficient pagination.
   */
  @Get()
  @ApiOperation({
    summary: 'Get tasks with filtering and pagination',
    description: `Retrieves tasks with comprehensive filtering, sorting, and pagination capabilities.

    **Query Features:**
    - Filter by status, priority, project, date ranges
    - Full-text search across title and description
    - Flexible sorting by multiple fields
    - Efficient cursor-based pagination

    **Performance:** <200ms for 95th percentile with proper indexing`,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: 'number',
    description: 'Page number (1-based)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: 'number',
    description: 'Items per page (1-100)',
    example: 20,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: 'array',
    description: 'Filter by task status(es)',
    example: [TaskStatus.PENDING, TaskStatus.RUNNING],
  })
  @ApiQuery({
    name: 'priority',
    required: false,
    type: 'array',
    description: 'Filter by task priority(ies)',
    example: [TaskPriority.HIGH, TaskPriority.URGENT],
  })
  @ApiQuery({
    name: 'projectId',
    required: false,
    type: 'string',
    format: 'uuid',
    description: 'Filter by project ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiQuery({
    name: 'createdAfter',
    required: false,
    type: 'string',
    format: 'date-time',
    description: 'Filter tasks created after this date',
    example: '2024-01-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'createdBefore',
    required: false,
    type: 'string',
    format: 'date-time',
    description: 'Filter tasks created before this date',
    example: '2024-12-31T23:59:59Z',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: 'string',
    description: 'Full-text search query (max 100 chars)',
    example: 'authentication system',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'updatedAt', 'priority', 'status', 'title'],
    description: 'Sort field',
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort order',
    example: 'desc',
  })
  @ApiOkResponse({
    description: 'Tasks retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            // TaskResponseDto schema would be referenced here
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getTasks(
    @Query() queryParams: any,
  ): Promise<PaginatedTaskResponseDto> {
    // Fail-fast validation using Zod schema
    const validatedQuery = validateTaskQuery(queryParams);
    return this.tasksService.getTasks(validatedQuery);
  }

  /**
   * Get a specific task by ID
   *
   * Retrieves detailed information for a single task including
   * all metadata, relationships, and execution history.
   */
  @Get(':id')
  @UseGuards(TaskOwnershipGuard)
  @ApiOperation({
    summary: 'Get task by ID',
    description: `Retrieves a specific task by its unique identifier with complete details.

    **Returns:**
    - Complete task information
    - User and project relationships
    - Execution status and progress
    - Configuration and metadata

    **Performance:** <50ms with proper database indexing`,
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Task unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Task retrieved successfully',
    // TaskResponseDto schema would be referenced here
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Access denied - users can only access tasks they created or are assigned to',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: { type: 'string', example: 'Insufficient permissions: cannot access task. Users can only access tasks they created or are assigned to.' },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Task not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Task not found' },
      },
    },
  })
  async getTask(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TaskResponseDto> {
    return this.tasksService.getTaskById(id);
  }

  /**
   * Update an existing task
   *
   * Performs partial updates to task properties with validation
   * and automatic tracking of modification history.
   */
  @Patch(':id')
  @UseGuards(TaskOwnershipGuard)
  @ApiOperation({
    summary: 'Update task',
    description: `Updates an existing task with the provided changes. Only modified fields need to be included.

    **Business Rules:**
    - Only task creator or assigned users can update
    - Status transitions must follow workflow rules
    - Scheduled time must be in future if updated

    **Performance:** <100ms with optimistic locking`,
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Task unique identifier',
  })
  @ApiBody({
    type: 'object',
    description: 'Task update data (partial)',
    schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          minLength: 1,
          maxLength: 200,
          description: 'Updated task title',
        },
        description: {
          type: 'string',
          maxLength: 1000,
          description: 'Updated task description',
        },
        config: {
          type: 'object',
          description: 'Updated task configuration',
        },
        tags: {
          type: 'array',
          items: { type: 'string', maxLength: 50 },
          maxItems: 10,
          description: 'Updated task tags',
        },
        scheduledAt: {
          type: 'string',
          format: 'date-time',
          description: 'Updated scheduled time (must be future)',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Task updated successfully',
    // TaskResponseDto schema would be referenced here
  })
  @ApiBadRequestResponse({ description: 'Invalid update data' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Task not found' })
  async updateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: unknown,
    @CurrentUser() user: JWTPayload,
  ): Promise<TaskResponseDto> {
    // Fail-fast validation using Zod schema
    const validatedData = validateUpdateTask(updateData);
    return this.tasksService.updateTask(id, validatedData, user.sub);
  }

  /**
   * Delete a task
   *
   * Permanently removes a task and all associated data.
   * This operation cannot be undone.
   */
  @Delete(':id')
  @UseGuards(TaskOwnershipGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete task',
    description: `Permanently deletes a task and all associated data including comments, attachments, and logs.

    **WARNING:** This operation cannot be undone.

    **Authorization:** Only task creator or users with admin privileges can delete tasks.

    **Performance:** <100ms with cascade deletion`,
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Task unique identifier',
  })
  @ApiNoContentResponse({ description: 'Task deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'Task not found' })
  async deleteTask(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JWTPayload,
  ): Promise<void> {
    await this.tasksService.deleteTask(id, user.sub);
  }

  /**
   * Update task status
   *
   * Updates task execution status with optional progress and error information.
   * Typically used by task execution engines and monitoring systems.
   */
  @Patch(':id/status')
  @UseGuards(TaskOwnershipGuard)
  @ApiOperation({
    summary: 'Update task status',
    description: `Updates the execution status of a task with optional progress tracking and error reporting.

    **Status Transitions:**
    - PENDING → RUNNING, CANCELLED
    - RUNNING → COMPLETED, FAILED, CANCELLED
    - COMPLETED → (final state)
    - FAILED → PENDING (for retry)
    - CANCELLED → PENDING (for restart)

    **Performance:** <50ms with status validation`,
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Task unique identifier',
  })
  @ApiBody({
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        enum: Object.values(TaskStatus),
        description: 'New task status',
        example: TaskStatus.COMPLETED,
      },
      progress: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Task completion progress (0.0 to 1.0)',
        example: 0.75,
      },
      errorMessage: {
        type: 'string',
        description: 'Error message if status is FAILED',
        example: 'Timeout exceeded during execution',
      },
    },
  })
  @ApiOkResponse({
    description: 'Task status updated successfully',
    // TaskResponseDto schema would be referenced here
  })
  @ApiBadRequestResponse({ description: 'Invalid status update data' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiNotFoundResponse({ description: 'Task not found' })
  async updateTaskStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() statusUpdate: unknown,
  ): Promise<TaskResponseDto> {
    // Fail-fast validation using Zod schema
    const validatedData = validateTaskStatusUpdate(statusUpdate);
    return this.tasksService.updateTaskStatus(id, validatedData);
  }

  /**
   * Bulk task operations
   *
   * Performs batch operations on multiple tasks for efficiency.
   * Supports delete, cancel, and retry operations.
   */
  @Post('bulk')
  @ApiOperation({
    summary: 'Bulk task operations',
    description: `Performs batch operations on multiple tasks efficiently with transactional consistency.

    **Supported Operations:**
    - delete: Permanently delete tasks
    - cancel: Cancel running tasks
    - retry: Retry failed tasks

    **Limits:** Maximum 100 tasks per operation
    **Performance:** Processes ~10 tasks per second with proper batching`,
  })
  @ApiBody({
    type: 'object',
    required: ['taskIds', 'operation'],
    properties: {
      taskIds: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        minItems: 1,
        maxItems: 100,
        description: 'Array of task IDs to operate on',
        example: ['550e8400-e29b-41d4-a716-446655440000', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
      },
      operation: {
        type: 'string',
        enum: ['delete', 'cancel', 'retry'],
        description: 'Bulk operation to perform',
        example: 'delete',
      },
      config: {
        type: 'object',
        properties: {
          force: {
            type: 'boolean',
            default: false,
            description: 'Force operation even if validation fails',
          },
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Bulk operation completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        processedCount: { type: 'number' },
        failedCount: { type: 'number' },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              taskId: { type: 'string', format: 'uuid' },
              success: { type: 'boolean' },
              error: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid bulk operation data' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async bulkOperation(
    @Body() operationData: unknown,
    @CurrentUser() user: JWTPayload,
  ): Promise<{
    success: boolean;
    processedCount: number;
    failedCount: number;
    results: Array<{ taskId: string; success: boolean; error?: string }>;
  }> {
    // Fail-fast validation using Zod schema
    const validatedData = validateBulkTaskOperation(operationData);
    return this.tasksService.bulkOperation(validatedData, user.sub);
  }

  /**
   * Get task analytics and metrics
   *
   * Provides aggregated statistics and performance metrics
   * for monitoring and reporting purposes.
   */
  @Get('analytics/metrics')
  @ApiOperation({
    summary: 'Get task metrics and analytics',
    description: `Retrieves comprehensive analytics and performance metrics for tasks.

    **Metrics Include:**
    - Task completion statistics
    - Performance benchmarks
    - Success/failure rates
    - Processing time analytics

    **Performance:** Cached for 5 minutes, <100ms response time`,
  })
  @ApiOkResponse({
    description: 'Task metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalTasks: {
          type: 'number',
          description: 'Total number of tasks',
          example: 1250,
        },
        completedTasks: {
          type: 'number',
          description: 'Number of completed tasks',
          example: 980,
        },
        failedTasks: {
          type: 'number',
          description: 'Number of failed tasks',
          example: 45,
        },
        averageDuration: {
          type: 'number',
          nullable: true,
          description: 'Average task completion time in seconds',
          example: 1847.5,
        },
        successRate: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Task success rate (0.0 to 1.0)',
          example: 0.956,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getTaskMetrics(): Promise<TaskMetricsDto> {
    return this.tasksService.getTaskMetrics();
  }

  /**
   * Get performance monitoring data
   *
   * Retrieves comprehensive performance metrics and optimization
   * recommendations for task API endpoints.
   */
  @Get('performance/report')
  @BypassOwnership()
  @ApiOperation({
    summary: 'Get performance monitoring report',
    description: `Retrieves comprehensive performance analytics including:

    **Performance Metrics:**
    - Average response times by endpoint
    - 95th percentile response times
    - Cache hit rates and efficiency
    - Memory usage and optimization suggestions
    - Database query performance analysis

    **Optimization Recommendations:**
    - Query optimization suggestions
    - Caching strategy recommendations
    - Memory usage improvements
    - Connection pool optimization

    **Trend Analysis:**
    - Performance trends over time
    - Memory usage patterns
    - Error rate tracking

    **Performance:** Cached for 1 minute, <50ms response time`,
  })
  @ApiOkResponse({
    description: 'Performance report retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'object',
          properties: {
            averageQueryDuration: { type: 'number', example: 45.2 },
            cacheHitRate: { type: 'number', example: 85.5 },
            memoryUtilization: { type: 'number', example: 67.3 },
            connectionPoolEfficiency: { type: 'number', example: 95.5 },
          },
        },
        optimizationRecommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              totalExecutions: { type: 'number' },
              avgDuration: { type: 'number' },
              recommendations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string' },
                    description: { type: 'string' },
                    priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
                    estimatedImprovement: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        trends: {
          type: 'object',
          properties: {
            queryPerformanceTrend: { type: 'string', enum: ['improving', 'stable', 'degrading'] },
            memoryUsageTrend: { type: 'string', enum: ['improving', 'stable', 'degrading'] },
          },
        },
        lastUpdated: { type: 'number' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async getPerformanceReport() {
    return this.performanceService.getPerformanceReport();
  }
}