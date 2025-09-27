import { z } from 'zod';

/**
 * Task Status Enum Schema - exactly matching Prisma enum
 */
export const TaskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']);

/**
 * Task Priority Enum Schema - exactly matching Prisma enum
 */
export const TaskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

/**
 * Task Entity Schema - exactly mirroring Prisma Task model
 * 
 * This schema provides type-safe validation for task entities
 * and ensures synchronization between database model and contract validation.
 */
export const TaskEntitySchema = z.object({
  id: z.string().uuid('Task ID must be a valid UUID'),
  title: z.string().min(1, 'Task title is required').max(200, 'Task title must be at most 200 characters'),
  description: z.string().max(2000, 'Task description must be at most 2000 characters').nullable(),
  status: TaskStatusSchema.default('TODO'),
  priority: TaskPrioritySchema.default('MEDIUM'),
  createdById: z.string().uuid('Creator ID must be a valid UUID'),
  assigneeId: z.string().uuid('Assignee ID must be a valid UUID').nullable(),
  projectId: z.string().uuid('Project ID must be a valid UUID').nullable(),
  tags: z.array(z.string().min(1, 'Tag cannot be empty').max(50, 'Tag must be at most 50 characters')).default([]),
  dueDate: z.date().nullable(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Task Entity Creation Schema - for creating new tasks
 * Omits auto-generated fields (id, createdAt, updatedAt, completedAt)
 */
export const CreateTaskEntitySchema = TaskEntitySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
}).extend({
  // Make createdById required for task creation
  createdById: z.string().uuid('Creator ID must be a valid UUID'),
});

/**
 * Task Entity Update Schema - for updating existing tasks
 * Makes most fields optional except required identifiers
 */
export const UpdateTaskEntitySchema = TaskEntitySchema.partial().omit({
  id: true,
  createdAt: true,
  createdById: true, // Creator cannot be changed
});

/**
 * Task Entity Query Schema - for filtering task queries
 */
export const TaskEntityQuerySchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  createdById: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  dueBefore: z.date().optional(),
  dueAfter: z.date().optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  completedAfter: z.date().optional(),
  completedBefore: z.date().optional(),
  isOverdue: z.boolean().optional(),
  isUnassigned: z.boolean().optional(),
});

/**
 * Task Statistics Schema - for task reporting and analytics
 */
export const TaskStatisticsSchema = z.object({
  total: z.number().int().min(0),
  todo: z.number().int().min(0),
  inProgress: z.number().int().min(0),
  inReview: z.number().int().min(0),
  done: z.number().int().min(0),
  cancelled: z.number().int().min(0),
  overdue: z.number().int().min(0),
  byPriority: z.object({
    low: z.number().int().min(0),
    medium: z.number().int().min(0),
    high: z.number().int().min(0),
    urgent: z.number().int().min(0),
  }),
  averageCompletionTime: z.number().min(0).nullable(), // in days
  completionRate: z.number().min(0).max(100), // percentage
});

/**
 * Task Assignment Schema - for task assignment operations
 */
export const TaskAssignmentSchema = z.object({
  taskId: z.string().uuid('Task ID must be a valid UUID'),
  assigneeId: z.string().uuid('Assignee ID must be a valid UUID'),
  assignedBy: z.string().uuid('Assigner ID must be a valid UUID'),
  assignedAt: z.date().default(() => new Date()),
  notes: z.string().max(500, 'Assignment notes must be at most 500 characters').optional(),
});

/**
 * TypeScript types derived from Zod schemas
 */
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;
export type TaskEntity = z.infer<typeof TaskEntitySchema>;
export type CreateTaskEntity = z.infer<typeof CreateTaskEntitySchema>;
export type UpdateTaskEntity = z.infer<typeof UpdateTaskEntitySchema>;
export type TaskEntityQuery = z.infer<typeof TaskEntityQuerySchema>;
export type TaskStatistics = z.infer<typeof TaskStatisticsSchema>;
export type TaskAssignment = z.infer<typeof TaskAssignmentSchema>;

/**
 * Validation helpers for runtime type checking
 */
export const validateTaskEntity = (data: unknown): TaskEntity => {
  return TaskEntitySchema.parse(data);
};

export const validateCreateTaskEntity = (data: unknown): CreateTaskEntity => {
  return CreateTaskEntitySchema.parse(data);
};

export const validateUpdateTaskEntity = (data: unknown): UpdateTaskEntity => {
  return UpdateTaskEntitySchema.parse(data);
};

export const validateTaskEntityQuery = (data: unknown): TaskEntityQuery => {
  return TaskEntityQuerySchema.parse(data);
};

export const validateTaskStatistics = (data: unknown): TaskStatistics => {
  return TaskStatisticsSchema.parse(data);
};

export const validateTaskAssignment = (data: unknown): TaskAssignment => {
  return TaskAssignmentSchema.parse(data);
};