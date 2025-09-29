import { z } from 'zod';

/**
 * Task Schema Module - Comprehensive Zod validation schemas for all task CRUD operations
 *
 * Following SOLID principles:
 * - SRP: Each schema has a single, focused validation responsibility
 * - OCP: Schemas are extensible through composition, closed for modification
 * - LSP: All task schemas can be substituted where base schemas are expected
 * - ISP: Specific validation interfaces for different operations
 * - DIP: Schemas depend on abstractions (Zod primitives) not concretions
 *
 * KISS Principle: Simple, focused validation rules that are easy to understand and maintain
 * DRY/SSOT: Single source of truth for all task validation logic across the application
 * Fail-fast: Comprehensive validation that catches errors early in the request pipeline
 * Contract-driven: Schema-first design that generates TypeScript types automatically
 */

// ============================= ENUMERATIONS =============================

/**
 * Task priority enumeration - Interface Segregation Principle applied
 * Separate interface for priority-specific validation
 */
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Task status enumeration - Single Responsibility for status validation
 * Comprehensive lifecycle states for task management
 */
export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
  REVIEW = 'review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Task category enumeration - Single Responsibility for categorization
 * Clear separation of different types of work
 */
export enum TaskCategory {
  DEVELOPMENT = 'development',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
  RESEARCH = 'research',
  BUG_FIX = 'bug_fix',
  FEATURE = 'feature',
  MAINTENANCE = 'maintenance',
  DEPLOYMENT = 'deployment',
  OTHER = 'other',
}

// ============================= BASE SCHEMAS =============================

/**
 * UUID validation schema - DRY principle applied
 * Reusable validation for all UUID fields
 */
export const UuidSchema = z.string().uuid('Must be a valid UUID');

/**
 * Positive number schema - DRY principle applied
 * Reusable validation for all positive numeric fields
 */
export const PositiveNumberSchema = z.number().positive('Must be a positive number');

/**
 * Non-empty string schema - DRY principle applied
 * Reusable validation for required string fields
 */
export const NonEmptyStringSchema = z.string().min(1, 'Cannot be empty');

/**
 * Task title validation schema - Single Responsibility
 * Focused validation for task titles with length constraints
 */
export const TaskTitleSchema = NonEmptyStringSchema.max(200, 'Title must not exceed 200 characters');

/**
 * Task description validation schema - Single Responsibility
 * Focused validation for task descriptions with length constraints
 */
export const TaskDescriptionSchema = z.string().max(2000, 'Description must not exceed 2000 characters').optional();

/**
 * Task tag validation schema - Single Responsibility
 * Focused validation for individual tags
 */
export const TaskTagSchema = z.string().max(50, 'Tag must not exceed 50 characters');

/**
 * Task tags array validation schema - Single Responsibility
 * Focused validation for tag collections
 */
export const TaskTagsSchema = z.array(TaskTagSchema).default([]);

/**
 * Task metadata validation schema - Open/Closed Principle applied
 * Extensible metadata structure without modifying core schema
 */
export const TaskMetadataSchema = z.record(z.any()).optional();

// ============================= CORE ENTITY SCHEMAS =============================

/**
 * Base task entity schema - Single Responsibility for core task structure
 * Complete task representation with all standard fields
 * Serves as SSOT for task entity validation
 */
export const TaskEntitySchema = z.object({
  id: UuidSchema,
  title: TaskTitleSchema,
  description: TaskDescriptionSchema,
  status: z.nativeEnum(TaskStatus),
  priority: z.nativeEnum(TaskPriority),
  category: z.nativeEnum(TaskCategory),
  assigneeId: UuidSchema.optional(),
  createdById: UuidSchema,
  projectId: UuidSchema.optional(),
  parentTaskId: UuidSchema.optional(),
  estimatedHours: PositiveNumberSchema.optional(),
  actualHours: PositiveNumberSchema.optional(),
  dueDate: z.date().optional(),
  startDate: z.date().optional(),
  completedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  tags: TaskTagsSchema,
  metadata: TaskMetadataSchema,
});

// ============================= CRUD OPERATION SCHEMAS =============================

/**
 * Create Task DTO Schema - Interface Segregation Principle applied
 * Specific validation interface for task creation operations
 * Fail-fast validation for required creation fields
 */
export const CreateTaskSchema = z.object({
  title: TaskTitleSchema,
  description: TaskDescriptionSchema,
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  category: z.nativeEnum(TaskCategory),
  assigneeId: UuidSchema.optional(),
  projectId: UuidSchema.optional(),
  parentTaskId: UuidSchema.optional(),
  estimatedHours: PositiveNumberSchema.optional(),
  dueDate: z.date().optional(),
  startDate: z.date().optional(),
  tags: TaskTagsSchema,
  metadata: TaskMetadataSchema,
});

/**
 * Update Task DTO Schema - Interface Segregation Principle applied
 * Specific validation interface for task update operations
 * All fields optional for partial updates
 */
export const UpdateTaskSchema = z.object({
  title: TaskTitleSchema.optional(),
  description: TaskDescriptionSchema,
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  category: z.nativeEnum(TaskCategory).optional(),
  assigneeId: UuidSchema.optional(),
  projectId: UuidSchema.optional(),
  parentTaskId: UuidSchema.optional(),
  estimatedHours: PositiveNumberSchema.optional(),
  actualHours: PositiveNumberSchema.optional(),
  dueDate: z.date().optional(),
  startDate: z.date().optional(),
  tags: TaskTagsSchema.optional(),
  metadata: TaskMetadataSchema,
});

/**
 * Task Query Parameters Schema - Interface Segregation Principle applied
 * Specific validation interface for task search and filtering operations
 * Comprehensive filtering, sorting, and pagination support
 */
export const TaskQuerySchema = z.object({
  // Filtering parameters
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  category: z.nativeEnum(TaskCategory).optional(),
  assigneeId: UuidSchema.optional(),
  createdById: UuidSchema.optional(),
  projectId: UuidSchema.optional(),
  parentTaskId: UuidSchema.optional(),

  // Date range filtering
  dueDateFrom: z.date().optional(),
  dueDateTo: z.date().optional(),
  createdFrom: z.date().optional(),
  createdTo: z.date().optional(),

  // Tag and text search
  tags: z.array(z.string()).optional(),
  search: z.string().max(100, 'Search query must not exceed 100 characters').optional(),

  // Pagination parameters
  page: z.number().positive('Page must be positive').default(1),
  limit: z.number().positive('Limit must be positive').max(100, 'Limit must not exceed 100').default(20),

  // Sorting parameters
  sortBy: z.enum(['createdAt', 'updatedAt', 'dueDate', 'priority', 'status', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Task Response DTO Schema - Interface Segregation Principle applied
 * Specific validation interface for task API responses
 * Extends entity schema with additional computed fields
 */
export const TaskResponseSchema = TaskEntitySchema.extend({
  // Computed fields for response enrichment
  isOverdue: z.boolean().optional(),
  completionPercentage: z.number().min(0).max(100).optional(),
  timeSpent: z.number().nonnegative().optional(),
  subtaskCount: z.number().nonnegative().optional(),
  commentCount: z.number().nonnegative().optional(),
  attachmentCount: z.number().nonnegative().optional(),
});

// ============================= SUPPORTING ENTITY SCHEMAS =============================

/**
 * Task Comment Schema - Single Responsibility for comment validation
 * Focused validation for task discussion features
 */
export const TaskCommentSchema = z.object({
  id: UuidSchema,
  taskId: UuidSchema,
  authorId: UuidSchema,
  content: NonEmptyStringSchema.max(1000, 'Comment content must not exceed 1000 characters'),
  parentCommentId: UuidSchema.optional(),
  isEdited: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Create Task Comment DTO Schema - Interface Segregation Principle applied
 * Specific validation for comment creation
 */
export const CreateTaskCommentSchema = z.object({
  content: NonEmptyStringSchema.max(1000, 'Comment content must not exceed 1000 characters'),
  parentCommentId: UuidSchema.optional(),
});

/**
 * Update Task Comment DTO Schema - Interface Segregation Principle applied
 * Specific validation for comment updates
 */
export const UpdateTaskCommentSchema = z.object({
  content: NonEmptyStringSchema.max(1000, 'Comment content must not exceed 1000 characters'),
});

/**
 * Task Attachment Schema - Single Responsibility for attachment validation
 * Focused validation for file attachment features
 */
export const TaskAttachmentSchema = z.object({
  id: UuidSchema,
  taskId: UuidSchema,
  uploadedById: UuidSchema,
  fileName: NonEmptyStringSchema.max(255, 'File name must not exceed 255 characters'),
  originalName: NonEmptyStringSchema.max(255, 'Original name must not exceed 255 characters'),
  mimeType: NonEmptyStringSchema,
  fileSize: PositiveNumberSchema,
  filePath: NonEmptyStringSchema,
  createdAt: z.date(),
});

/**
 * Task Time Log Schema - Single Responsibility for time tracking validation
 * Focused validation for time logging features
 */
export const TaskTimeLogSchema = z.object({
  id: UuidSchema,
  taskId: UuidSchema,
  userId: UuidSchema,
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
  hoursSpent: PositiveNumberSchema,
  dateLogged: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Create Task Time Log DTO Schema - Interface Segregation Principle applied
 * Specific validation for time log creation
 */
export const CreateTaskTimeLogSchema = z.object({
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
  hoursSpent: PositiveNumberSchema,
  dateLogged: z.date(),
});

// ============================= BULK OPERATION SCHEMAS =============================

/**
 * Bulk Task Operation Schema - Single Responsibility for bulk operations
 * Focused validation for batch task operations
 */
export const BulkTaskOperationSchema = z.object({
  taskIds: z.array(UuidSchema).min(1, 'At least one task ID is required'),
  operation: z.enum(['delete', 'updateStatus', 'updatePriority', 'updateAssignee', 'addTags', 'removeTags']),
  data: z.record(z.any()).optional(),
});

// ============================= STATISTICS AND REPORTING SCHEMAS =============================

/**
 * Task Statistics Schema - Single Responsibility for reporting validation
 * Focused validation for task analytics and reporting
 */
export const TaskStatisticsSchema = z.object({
  totalTasks: z.number().nonnegative(),
  tasksByStatus: z.record(z.nativeEnum(TaskStatus), z.number().nonnegative()),
  tasksByPriority: z.record(z.nativeEnum(TaskPriority), z.number().nonnegative()),
  tasksByCategory: z.record(z.nativeEnum(TaskCategory), z.number().nonnegative()),
  overdueTasks: z.number().nonnegative(),
  completedThisWeek: z.number().nonnegative(),
  completedThisMonth: z.number().nonnegative(),
  averageCompletionTime: z.number().nonnegative().optional(),
  totalHoursLogged: z.number().nonnegative().optional(),
});

// ============================= CONFIGURATION SCHEMAS =============================

/**
 * Task Configuration Schema - Single Responsibility for task settings
 * Focused validation for task-related configuration
 */
export const TaskConfigurationSchema = z.object({
  defaultPriority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  defaultCategory: z.nativeEnum(TaskCategory).default(TaskCategory.OTHER),
  autoAssignCreator: z.boolean().default(false),
  requireEstimation: z.boolean().default(false),
  enableTimeTracking: z.boolean().default(true),
  enableComments: z.boolean().default(true),
  enableAttachments: z.boolean().default(true),
  maxAttachmentSize: PositiveNumberSchema.default(10485760), // 10MB
  allowedAttachmentTypes: z.array(z.string()).default(['image/*', 'application/pdf', 'text/*']),
});

// ============================= TYPESCRIPT TYPE EXPORTS =============================

/**
 * TypeScript types derived from Zod schemas - Contract-driven type generation
 * Automatic type safety across the application
 */
export type TaskEntity = z.infer<typeof TaskEntitySchema>;
export type CreateTaskDto = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskDto = z.infer<typeof UpdateTaskSchema>;
export type TaskQueryDto = z.infer<typeof TaskQuerySchema>;
export type TaskResponseDto = z.infer<typeof TaskResponseSchema>;
export type TaskComment = z.infer<typeof TaskCommentSchema>;
export type CreateTaskCommentDto = z.infer<typeof CreateTaskCommentSchema>;
export type UpdateTaskCommentDto = z.infer<typeof UpdateTaskCommentSchema>;
export type TaskAttachment = z.infer<typeof TaskAttachmentSchema>;
export type TaskTimeLog = z.infer<typeof TaskTimeLogSchema>;
export type CreateTaskTimeLogDto = z.infer<typeof CreateTaskTimeLogSchema>;
export type BulkTaskOperationDto = z.infer<typeof BulkTaskOperationSchema>;
export type TaskStatistics = z.infer<typeof TaskStatisticsSchema>;
export type TaskConfiguration = z.infer<typeof TaskConfigurationSchema>;

// ============================= VALIDATION HELPER FUNCTIONS =============================

/**
 * Fail-fast validation functions - Dependency Inversion Principle applied
 * High-level validation functions depend on Zod abstractions, not implementation details
 * Immediate error throwing for invalid data
 */

export const validateTaskEntity = (data: unknown): TaskEntity => {
  return TaskEntitySchema.parse(data);
};

export const validateCreateTask = (data: unknown): CreateTaskDto => {
  return CreateTaskSchema.parse(data);
};

export const validateUpdateTask = (data: unknown): UpdateTaskDto => {
  return UpdateTaskSchema.parse(data);
};

export const validateTaskQuery = (data: unknown): TaskQueryDto => {
  return TaskQuerySchema.parse(data);
};

export const validateTaskResponse = (data: unknown): TaskResponseDto => {
  return TaskResponseSchema.parse(data);
};

export const validateTaskComment = (data: unknown): TaskComment => {
  return TaskCommentSchema.parse(data);
};

export const validateCreateTaskComment = (data: unknown): CreateTaskCommentDto => {
  return CreateTaskCommentSchema.parse(data);
};

export const validateUpdateTaskComment = (data: unknown): UpdateTaskCommentDto => {
  return UpdateTaskCommentSchema.parse(data);
};

export const validateTaskAttachment = (data: unknown): TaskAttachment => {
  return TaskAttachmentSchema.parse(data);
};

export const validateTaskTimeLog = (data: unknown): TaskTimeLog => {
  return TaskTimeLogSchema.parse(data);
};

export const validateCreateTaskTimeLog = (data: unknown): CreateTaskTimeLogDto => {
  return CreateTaskTimeLogSchema.parse(data);
};

export const validateBulkTaskOperation = (data: unknown): BulkTaskOperationDto => {
  return BulkTaskOperationSchema.parse(data);
};

export const validateTaskStatistics = (data: unknown): TaskStatistics => {
  return TaskStatisticsSchema.parse(data);
};

export const validateTaskConfiguration = (data: unknown): TaskConfiguration => {
  return TaskConfigurationSchema.parse(data);
};

// ============================= SAFE VALIDATION FUNCTIONS =============================

/**
 * Safe validation functions that return results instead of throwing
 * Non-throwing alternatives for scenarios where errors should be handled gracefully
 */

export const safeValidateCreateTask = (data: unknown): { success: true; data: CreateTaskDto } | { success: false; error: z.ZodError } => {
  const result = CreateTaskSchema.safeParse(data);
  return result.success ? { success: true, data: result.data } : { success: false, error: result.error };
};

export const safeValidateUpdateTask = (data: unknown): { success: true; data: UpdateTaskDto } | { success: false; error: z.ZodError } => {
  const result = UpdateTaskSchema.safeParse(data);
  return result.success ? { success: true, data: result.data } : { success: false, error: result.error };
};

export const safeValidateTaskQuery = (data: unknown): { success: true; data: TaskQueryDto } | { success: false; error: z.ZodError } => {
  const result = TaskQuerySchema.safeParse(data);
  return result.success ? { success: true, data: result.data } : { success: false, error: result.error };
};

// ============================= SCHEMA COMPOSITION UTILITIES =============================

/**
 * Schema composition utilities following Open/Closed Principle
 * Allow extending schemas without modifying existing ones
 */

/**
 * Create a task schema with additional fields
 * Allows extending base task schema for specific use cases
 */
export const createExtendedTaskSchema = <T extends z.ZodRawShape>(extensions: T) => {
  return TaskEntitySchema.extend(extensions);
};

/**
 * Create a filtered task query schema
 * Allows creating specialized query schemas for specific endpoints
 */
export const createFilteredQuerySchema = (allowedFields: (keyof TaskQueryDto)[]) => {
  const filteredShape = Object.fromEntries(
    allowedFields.map(field => [field, TaskQuerySchema.shape[field as keyof typeof TaskQuerySchema.shape]])
  ) as any;
  return z.object(filteredShape);
};

/**
 * Partial schema creator for update operations
 * Generic utility for creating partial schemas from any base schema
 */
export const createPartialSchema = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) => {
  return schema.partial();
};

// ============================= EXPORT ALL SCHEMAS =============================

/**
 * Centralized export object for all task-related schemas
 * Single point of access following SSOT principle
 */
export const TaskSchemas = {
  // Core entities
  TaskEntity: TaskEntitySchema,
  CreateTask: CreateTaskSchema,
  UpdateTask: UpdateTaskSchema,
  TaskQuery: TaskQuerySchema,
  TaskResponse: TaskResponseSchema,

  // Supporting entities
  TaskComment: TaskCommentSchema,
  CreateTaskComment: CreateTaskCommentSchema,
  UpdateTaskComment: UpdateTaskCommentSchema,
  TaskAttachment: TaskAttachmentSchema,
  TaskTimeLog: TaskTimeLogSchema,
  CreateTaskTimeLog: CreateTaskTimeLogSchema,

  // Operations
  BulkTaskOperation: BulkTaskOperationSchema,
  TaskStatistics: TaskStatisticsSchema,
  TaskConfiguration: TaskConfigurationSchema,

  // Validation functions
  validate: {
    taskEntity: validateTaskEntity,
    createTask: validateCreateTask,
    updateTask: validateUpdateTask,
    taskQuery: validateTaskQuery,
    taskResponse: validateTaskResponse,
    taskComment: validateTaskComment,
    createTaskComment: validateCreateTaskComment,
    updateTaskComment: validateUpdateTaskComment,
    taskAttachment: validateTaskAttachment,
    taskTimeLog: validateTaskTimeLog,
    createTaskTimeLog: validateCreateTaskTimeLog,
    bulkTaskOperation: validateBulkTaskOperation,
    taskStatistics: validateTaskStatistics,
    taskConfiguration: validateTaskConfiguration,
  },

  // Safe validation functions
  safeValidate: {
    createTask: safeValidateCreateTask,
    updateTask: safeValidateUpdateTask,
    taskQuery: safeValidateTaskQuery,
  },

  // Utilities
  utils: {
    createExtendedTaskSchema,
    createFilteredQuerySchema,
    createPartialSchema,
  },
} as const;

export default TaskSchemas;