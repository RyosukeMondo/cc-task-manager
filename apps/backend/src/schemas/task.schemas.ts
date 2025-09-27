import { z } from 'zod';

/**
 * Task management schemas for backend-specific contract extensions
 * Extends existing contract infrastructure with task-specific validation
 */

/**
 * Task priority levels for task categorization
 */
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Task status values for state management
 */
export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

/**
 * Task creation schema for new task validation
 */
export const TaskCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  assigneeId: z.string().uuid('Invalid assignee ID').optional(),
  projectId: z.string().uuid('Invalid project ID').optional(),
  dueDate: z.coerce.date().min(new Date(), 'Due date must be in the future').optional(),
  tags: z.array(z.string().min(1).max(20)).max(10, 'Too many tags').default([]),
  estimatedHours: z.number().positive('Estimated hours must be positive').max(1000, 'Estimated hours too large').optional(),
});

/**
 * Task update schema for task modifications
 */
export const TaskUpdateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  assigneeId: z.string().uuid('Invalid assignee ID').nullable().optional(),
  projectId: z.string().uuid('Invalid project ID').nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  tags: z.array(z.string().min(1).max(20)).max(10, 'Too many tags').optional(),
  estimatedHours: z.number().positive('Estimated hours must be positive').max(1000, 'Estimated hours too large').nullable().optional(),
  actualHours: z.number().positive('Actual hours must be positive').max(1000, 'Actual hours too large').nullable().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

/**
 * Task response schema for API responses
 */
export const TaskResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  priority: z.nativeEnum(TaskPriority),
  status: z.nativeEnum(TaskStatus),
  assigneeId: z.string().uuid().nullable(),
  assignee: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
  }).nullable(),
  projectId: z.string().uuid().nullable(),
  project: z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().nullable(),
  }).nullable(),
  createdById: z.string().uuid(),
  createdBy: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
  }),
  dueDate: z.date().nullable(),
  tags: z.array(z.string()),
  estimatedHours: z.number().nullable(),
  actualHours: z.number().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Task list query schema for filtering and pagination
 */
export const TaskListQuerySchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100, 'Limit cannot exceed 100').default(20),
  sortBy: z.enum(['title', 'priority', 'status', 'dueDate', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assigneeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  search: z.string().max(100, 'Search term too long').optional(),
  tags: z.array(z.string()).optional(),
  dueBefore: z.coerce.date().optional(),
  dueAfter: z.coerce.date().optional(),
});

/**
 * Task list response schema for paginated results
 */
export const TaskListResponseSchema = z.object({
  tasks: z.array(TaskResponseSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
});

/**
 * Task comment schema for task comments
 */
export const TaskCommentSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  content: z.string().min(1, 'Comment content is required').max(1000, 'Comment too long'),
  authorId: z.string().uuid(),
  author: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Task comment creation schema
 */
export const TaskCommentCreateSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(1000, 'Comment too long'),
});

/**
 * Task time tracking schema
 */
export const TaskTimeEntrySchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  userId: z.string().uuid(),
  user: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
  }),
  description: z.string().max(500, 'Description too long').optional(),
  hours: z.number().positive('Hours must be positive').max(24, 'Cannot log more than 24 hours'),
  date: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Task time entry creation schema
 */
export const TaskTimeEntryCreateSchema = z.object({
  description: z.string().max(500, 'Description too long').optional(),
  hours: z.number().positive('Hours must be positive').max(24, 'Cannot log more than 24 hours'),
  date: z.coerce.date().default(() => new Date()),
});

/**
 * TypeScript types derived from Zod schemas
 */
export type TaskCreate = z.infer<typeof TaskCreateSchema>;
export type TaskUpdate = z.infer<typeof TaskUpdateSchema>;
export type TaskResponse = z.infer<typeof TaskResponseSchema>;
export type TaskListQuery = z.infer<typeof TaskListQuerySchema>;
export type TaskListResponse = z.infer<typeof TaskListResponseSchema>;
export type TaskComment = z.infer<typeof TaskCommentSchema>;
export type TaskCommentCreate = z.infer<typeof TaskCommentCreateSchema>;
export type TaskTimeEntry = z.infer<typeof TaskTimeEntrySchema>;
export type TaskTimeEntryCreate = z.infer<typeof TaskTimeEntryCreateSchema>;