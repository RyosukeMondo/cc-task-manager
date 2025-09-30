import { z } from 'zod';
import { TaskStatus as PrismaTaskStatus, TaskPriority as PrismaTaskPriority } from '../../node_modules/.prisma/client';

/**
 * Task priority enumeration
 * Re-exported from Prisma to ensure type compatibility
 */
export const TaskPriority = PrismaTaskPriority;
export type TaskPriority = PrismaTaskPriority;

/**
 * Task status enumeration
 * Re-exported from Prisma to ensure type compatibility
 */
export const TaskStatus = PrismaTaskStatus;
export type TaskStatus = PrismaTaskStatus;

/**
 * Task category enumeration
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

/**
 * Base task schema with common task properties
 */
export const TaskBaseSchema = z.object({
  id: z.string().uuid('Task ID must be a valid UUID'),
  title: z.string().min(1, 'Task title is required').max(200, 'Task title must not exceed 200 characters'),
  description: z.string().max(2000, 'Task description must not exceed 2000 characters').optional(),
  status: z.nativeEnum(TaskStatus),
  priority: z.nativeEnum(TaskPriority),
  category: z.nativeEnum(TaskCategory),
  assigneeId: z.string().uuid('Assignee ID must be a valid UUID').optional(),
  createdById: z.string().uuid('Created by ID must be a valid UUID'),
  projectId: z.string().uuid('Project ID must be a valid UUID').optional(),
  parentTaskId: z.string().uuid('Parent task ID must be a valid UUID').optional(),
  estimatedHours: z.number().positive('Estimated hours must be positive').optional(),
  actualHours: z.number().positive('Actual hours must be positive').optional(),
  dueDate: z.date().optional(),
  startDate: z.date().optional(),
  completedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  tags: z.array(z.string().max(50, 'Tag must not exceed 50 characters')).default([]),
  metadata: z.record(z.any()).optional(),
});

/**
 * Task creation request schema
 */
export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(200, 'Task title must not exceed 200 characters'),
  description: z.string().max(2000, 'Task description must not exceed 2000 characters').optional(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  category: z.nativeEnum(TaskCategory),
  assigneeId: z.string().uuid('Assignee ID must be a valid UUID').optional(),
  projectId: z.string().uuid('Project ID must be a valid UUID').optional(),
  parentTaskId: z.string().uuid('Parent task ID must be a valid UUID').optional(),
  estimatedHours: z.number().positive('Estimated hours must be positive').optional(),
  dueDate: z.date().optional(),
  startDate: z.date().optional(),
  tags: z.array(z.string().max(50, 'Tag must not exceed 50 characters')).default([]),
  metadata: z.record(z.any()).optional(),
});

/**
 * Task update request schema
 */
export const UpdateTaskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(200, 'Task title must not exceed 200 characters').optional(),
  description: z.string().max(2000, 'Task description must not exceed 2000 characters').optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  category: z.nativeEnum(TaskCategory).optional(),
  assigneeId: z.string().uuid('Assignee ID must be a valid UUID').optional(),
  projectId: z.string().uuid('Project ID must be a valid UUID').optional(),
  parentTaskId: z.string().uuid('Parent task ID must be a valid UUID').optional(),
  estimatedHours: z.number().positive('Estimated hours must be positive').optional(),
  actualHours: z.number().positive('Actual hours must be positive').optional(),
  dueDate: z.date().optional(),
  startDate: z.date().optional(),
  tags: z.array(z.string().max(50, 'Tag must not exceed 50 characters')).optional(),
  metadata: z.record(z.any()).optional(),
  progress: z.number().min(0).max(1).optional(),
  errorMessage: z.string().optional(),
});

/**
 * Task query filters schema for searching and filtering tasks
 */
export const TaskQueryFiltersSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  category: z.nativeEnum(TaskCategory).optional(),
  assigneeId: z.string().uuid('Assignee ID must be a valid UUID').optional(),
  createdById: z.string().uuid('Created by ID must be a valid UUID').optional(),
  projectId: z.string().uuid('Project ID must be a valid UUID').optional(),
  parentTaskId: z.string().uuid('Parent task ID must be a valid UUID').optional(),
  dueDateFrom: z.date().optional(),
  dueDateTo: z.date().optional(),
  createdFrom: z.date().optional(),
  createdTo: z.date().optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().max(100, 'Search query must not exceed 100 characters').optional(),
  page: z.number().positive('Page must be positive').default(1),
  limit: z.number().positive('Limit must be positive').max(100, 'Limit must not exceed 100').default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'dueDate', 'priority', 'status', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Task comment schema for task discussions
 */
export const TaskCommentSchema = z.object({
  id: z.string().uuid('Comment ID must be a valid UUID'),
  taskId: z.string().uuid('Task ID must be a valid UUID'),
  authorId: z.string().uuid('Author ID must be a valid UUID'),
  content: z.string().min(1, 'Comment content is required').max(1000, 'Comment content must not exceed 1000 characters'),
  parentCommentId: z.string().uuid('Parent comment ID must be a valid UUID').optional(),
  isEdited: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Create task comment schema
 */
export const CreateTaskCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(1000, 'Comment content must not exceed 1000 characters'),
  parentCommentId: z.string().uuid('Parent comment ID must be a valid UUID').optional(),
});

/**
 * Update task comment schema
 */
export const UpdateTaskCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(1000, 'Comment content must not exceed 1000 characters'),
});

/**
 * Task attachment schema for file uploads
 */
export const TaskAttachmentSchema = z.object({
  id: z.string().uuid('Attachment ID must be a valid UUID'),
  taskId: z.string().uuid('Task ID must be a valid UUID'),
  uploadedById: z.string().uuid('Uploaded by ID must be a valid UUID'),
  fileName: z.string().min(1, 'File name is required').max(255, 'File name must not exceed 255 characters'),
  originalName: z.string().min(1, 'Original name is required').max(255, 'Original name must not exceed 255 characters'),
  mimeType: z.string().min(1, 'MIME type is required'),
  fileSize: z.number().positive('File size must be positive'),
  filePath: z.string().min(1, 'File path is required'),
  createdAt: z.date(),
});

/**
 * Task time log schema for time tracking
 */
export const TaskTimeLogSchema = z.object({
  id: z.string().uuid('Time log ID must be a valid UUID'),
  taskId: z.string().uuid('Task ID must be a valid UUID'),
  userId: z.string().uuid('User ID must be a valid UUID'),
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
  hoursSpent: z.number().positive('Hours spent must be positive'),
  dateLogged: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Create task time log schema
 */
export const CreateTaskTimeLogSchema = z.object({
  description: z.string().max(500, 'Description must not exceed 500 characters').optional(),
  hoursSpent: z.number().positive('Hours spent must be positive'),
  dateLogged: z.date(),
});

/**
 * Task statistics schema for reporting
 */
export const TaskStatisticsSchema = z.object({
  totalTasks: z.number().nonnegative(),
  tasksByStatus: z.record(z.nativeEnum(TaskStatus), z.number().nonnegative()).optional(),
  tasksByPriority: z.record(z.nativeEnum(TaskPriority), z.number().nonnegative()).optional(),
  tasksByCategory: z.record(z.nativeEnum(TaskCategory), z.number().nonnegative()).optional(),
  overdueTasks: z.number().nonnegative().optional(),
  completedThisWeek: z.number().nonnegative().optional(),
  completedThisMonth: z.number().nonnegative().optional(),
  averageCompletionTime: z.number().nonnegative().optional(),
  totalHoursLogged: z.number().nonnegative().optional(),
  completedTasks: z.number().nonnegative().optional(),
  failedTasks: z.number().nonnegative().optional(),
  successRate: z.number().min(0).max(1).optional(),
});

/**
 * Bulk task operation schema
 */
export const BulkTaskOperationSchema = z.object({
  taskIds: z.array(z.string().uuid('Task ID must be a valid UUID')).min(1, 'At least one task ID is required'),
  operation: z.enum(['delete', 'cancel', 'retry', 'updateStatus', 'updatePriority', 'updateAssignee', 'addTags', 'removeTags']),
  data: z.record(z.any()).optional(),
  config: z.object({
    force: z.boolean().default(false)
  }).optional(),
});

/**
 * TypeScript types derived from Zod schemas
 */
export type TaskBase = z.infer<typeof TaskBaseSchema>;
export type CreateTask = z.infer<typeof CreateTaskSchema>;
export type UpdateTask = z.infer<typeof UpdateTaskSchema>;
export type TaskQueryFilters = z.infer<typeof TaskQueryFiltersSchema>;
export type TaskComment = z.infer<typeof TaskCommentSchema>;
export type CreateTaskComment = z.infer<typeof CreateTaskCommentSchema>;
export type UpdateTaskComment = z.infer<typeof UpdateTaskCommentSchema>;
export type TaskAttachment = z.infer<typeof TaskAttachmentSchema>;
export type TaskTimeLog = z.infer<typeof TaskTimeLogSchema>;
export type CreateTaskTimeLog = z.infer<typeof CreateTaskTimeLogSchema>;
export type TaskStatistics = z.infer<typeof TaskStatisticsSchema>;
export type BulkTaskOperation = z.infer<typeof BulkTaskOperationSchema>;

/**
 * Validation helper functions for runtime type checking
 */
export const validateTaskBase = (data: unknown): TaskBase => {
  return TaskBaseSchema.parse(data);
};

export const validateCreateTask = (data: unknown): CreateTask => {
  return CreateTaskSchema.parse(data);
};

export const validateUpdateTask = (data: unknown): UpdateTask => {
  return UpdateTaskSchema.parse(data);
};

export const validateTaskQueryFilters = (data: unknown): TaskQueryFilters => {
  return TaskQueryFiltersSchema.parse(data);
};

export const validateTaskComment = (data: unknown): TaskComment => {
  return TaskCommentSchema.parse(data);
};

export const validateCreateTaskComment = (data: unknown): CreateTaskComment => {
  return CreateTaskCommentSchema.parse(data);
};

export const validateUpdateTaskComment = (data: unknown): UpdateTaskComment => {
  return UpdateTaskCommentSchema.parse(data);
};

export const validateTaskAttachment = (data: unknown): TaskAttachment => {
  return TaskAttachmentSchema.parse(data);
};

export const validateTaskTimeLog = (data: unknown): TaskTimeLog => {
  return TaskTimeLogSchema.parse(data);
};

export const validateCreateTaskTimeLog = (data: unknown): CreateTaskTimeLog => {
  return CreateTaskTimeLogSchema.parse(data);
};

export const validateTaskStatistics = (data: unknown): TaskStatistics => {
  return TaskStatisticsSchema.parse(data);
};

export const validateBulkTaskOperation = (data: unknown): BulkTaskOperation => {
  return BulkTaskOperationSchema.parse(data);
};