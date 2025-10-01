import { z } from 'zod';

/**
 * Task Priority enumeration for schema validation
 * Defines all supported priority levels for task scheduling and processing
 * Using z.enum() for Prisma compatibility (contract-driven development)
 */
export const TaskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

// Export as const object for runtime usage
export const TaskPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
} as const;

/**
 * Task Status enumeration for schema validation
 * Defines all possible states in the task lifecycle
 * Using z.enum() for Prisma compatibility (contract-driven development)
 */
export const TaskStatusSchema = z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// Export as const object for runtime usage
export const TaskStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
} as const;

/**
 * Task configuration schema for execution parameters
 * Validates all optional configuration settings for task execution
 */
export const TaskConfigSchema = z.object({
  timeout: z.number().int().min(1).max(3600).optional(),
  retryAttempts: z.number().int().min(0).max(5).optional(),
  priority: TaskPrioritySchema.optional()
}).strict();

/**
 * User reference schema for task ownership
 * Minimal user information for task attribution
 */
export const TaskUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  email: z.string().email()
}).strict();

/**
 * Project reference schema for task organization
 * Minimal project information for task categorization
 */
export const TaskProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string()
}).strict();

/**
 * Create task request schema for task creation endpoints
 * Validates all required and optional fields for new task creation
 */
export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
  prompt: z.string().min(1, 'Prompt is required').max(10000, 'Prompt must be 10000 characters or less'),
  config: TaskConfigSchema.optional(),
  projectId: z.string().uuid('Invalid project ID format').optional(),
  tags: z.array(z.string().max(50, 'Tag must be 50 characters or less')).max(10, 'Maximum 10 tags allowed').optional(),
  scheduledAt: z.string().datetime('Invalid datetime format').optional()
}).strict();

/**
 * Update task request schema for task modification endpoints
 * Validates partial updates with same validation rules as creation
 */
export const UpdateTaskSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').max(200, 'Title must be 200 characters or less').optional(),
  description: z.string().max(1000, 'Description must be 1000 characters or less').optional(),
  config: TaskConfigSchema.optional(),
  tags: z.array(z.string().max(50, 'Tag must be 50 characters or less')).max(10, 'Maximum 10 tags allowed').optional(),
  scheduledAt: z.string().datetime('Invalid datetime format').optional()
}).strict();

/**
 * Task query schema for filtering and pagination
 * Supports comprehensive filtering, sorting, and pagination options
 */
export const TaskQuerySchema = z.object({
  page: z.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
  status: z.array(TaskStatusSchema).optional(),
  priority: z.array(TaskPrioritySchema).optional(),
  projectId: z.string().uuid('Invalid project ID format').optional(),
  createdAfter: z.string().datetime('Invalid datetime format').optional(),
  createdBefore: z.string().datetime('Invalid datetime format').optional(),
  search: z.string().max(100, 'Search term must be 100 characters or less').optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'status', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
}).strict();

/**
 * Task response schema for API responses
 * Complete task representation with all metadata and relationships
 */
export const TaskResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  prompt: z.string(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  progress: z.number().min(0).max(1).nullable(),
  config: TaskConfigSchema.nullable(),
  createdBy: TaskUserSchema,
  project: TaskProjectSchema.nullable(),
  tags: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  scheduledAt: z.string().datetime().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  estimatedDuration: z.number().min(0).nullable(),
  actualDuration: z.number().min(0).nullable(),
  errorMessage: z.string().nullable(),
  retryCount: z.number().int().min(0).default(0)
}).strict();

/**
 * Paginated task response schema for list endpoints
 * Includes pagination metadata and task results
 */
export const PaginatedTaskResponseSchema = z.object({
  data: z.array(TaskResponseSchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
    hasNext: z.boolean(),
    hasPrev: z.boolean()
  }).strict()
}).strict();

/**
 * Task status update schema for status change operations
 * Validates status transitions and optional metadata
 */
export const TaskStatusUpdateSchema = z.object({
  status: TaskStatusSchema,
  progress: z.number().min(0).max(1).optional(),
  errorMessage: z.string().optional()
}).strict();

/**
 * Bulk task operation schema for batch operations
 * Supports bulk updates, deletions, and status changes
 */
export const BulkTaskOperationSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1, 'At least one task ID required').max(100, 'Maximum 100 tasks per operation'),
  operation: z.enum(['delete', 'cancel', 'retry']),
  config: z.object({
    force: z.boolean().default(false)
  }).optional()
}).strict();

/**
 * Task metrics schema for analytics and monitoring
 * Aggregated statistics for task performance tracking
 */
export const TaskMetricsSchema = z.object({
  totalTasks: z.number().int().min(0),
  completedTasks: z.number().int().min(0),
  failedTasks: z.number().int().min(0),
  averageDuration: z.number().min(0).nullable(),
  successRate: z.number().min(0).max(1)
}).strict();

// Type exports for TypeScript usage
export type CreateTaskDto = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskDto = z.infer<typeof UpdateTaskSchema>;
export type TaskQueryDto = z.infer<typeof TaskQuerySchema>;
export type TaskResponseDto = z.infer<typeof TaskResponseSchema>;
export type PaginatedTaskResponseDto = z.infer<typeof PaginatedTaskResponseSchema>;
export type TaskStatusUpdateDto = z.infer<typeof TaskStatusUpdateSchema>;
export type BulkTaskOperationDto = z.infer<typeof BulkTaskOperationSchema>;
export type TaskMetricsDto = z.infer<typeof TaskMetricsSchema>;

/**
 * Validation helper functions for runtime type checking
 * Provides fail-fast validation with detailed error messages
 */
export const validateCreateTask = (data: unknown) => {
  return CreateTaskSchema.parse(data);
};

export const validateUpdateTask = (data: unknown) => {
  return UpdateTaskSchema.parse(data);
};

export const validateTaskQuery = (data: unknown) => {
  return TaskQuerySchema.parse(data);
};

export const validateTaskResponse = (data: unknown) => {
  return TaskResponseSchema.parse(data);
};

export const validateTaskStatusUpdate = (data: unknown) => {
  return TaskStatusUpdateSchema.parse(data);
};

export const validateBulkTaskOperation = (data: unknown) => {
  return BulkTaskOperationSchema.parse(data);
};

/**
 * Safe parsing functions that return results instead of throwing
 * Useful for optional validation scenarios
 */
export const safeParseCreateTask = (data: unknown) => {
  return CreateTaskSchema.safeParse(data);
};

export const safeParseUpdateTask = (data: unknown) => {
  return UpdateTaskSchema.safeParse(data);
};

export const safeParseTaskQuery = (data: unknown) => {
  return TaskQuerySchema.safeParse(data);
};

/**
 * Schema refinements for business logic validation
 * Additional validation rules beyond basic type checking
 */
export const CreateTaskSchemaWithBusinessRules = CreateTaskSchema.refine(
  (data) => {
    // If scheduledAt is provided, it must be in the future
    if (data.scheduledAt) {
      const scheduledDate = new Date(data.scheduledAt);
      return scheduledDate > new Date();
    }
    return true;
  },
  {
    message: 'Scheduled time must be in the future',
    path: ['scheduledAt']
  }
);

export const UpdateTaskSchemaWithBusinessRules = UpdateTaskSchema.refine(
  (data) => {
    // Similar future date validation for updates
    if (data.scheduledAt) {
      const scheduledDate = new Date(data.scheduledAt);
      return scheduledDate > new Date();
    }
    return true;
  },
  {
    message: 'Scheduled time must be in the future',
    path: ['scheduledAt']
  }
);

/**
 * Aliased exports for backend API compatibility
 * These provide alternative names for schemas to maintain consistency with API naming conventions
 */
export { CreateTaskDto as CreateApiTaskDto };
export { UpdateTaskDto as UpdateApiTaskDto };
export { TaskQueryDto as ApiTaskFilterDto };
export { TaskResponseDto as ApiTaskDto };
export { PaginatedTaskResponseDto as PaginatedTasksDto };