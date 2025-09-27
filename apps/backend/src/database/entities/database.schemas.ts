import { z } from 'zod';

/**
 * Database Entity Schemas aligned with Prisma models
 * These schemas ensure contract-database synchronization and provide
 * type-safe validation for database operations
 * 
 * Following SSOT principle by keeping database schemas synchronized
 * with both Prisma models and existing contract schemas
 */

// User Role enumeration matching Prisma schema
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  MODERATOR = 'MODERATOR',
}

// User Status enumeration matching Prisma schema
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

// Task Status enumeration matching Prisma schema
export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

// Task Priority enumeration matching Prisma schema
export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/**
 * Base schema with common entity properties
 */
export const BaseEntitySchema = z.object({
  id: z.string().uuid('ID must be a valid UUID'),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * User entity schema aligned with Prisma User model
 */
export const UserEntitySchema = BaseEntitySchema.extend({
  email: z.string().email('Invalid email address'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must not exceed 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must not exceed 50 characters'),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
  passwordHash: z.string().min(1, 'Password hash is required'),
  lastLoginAt: z.date().nullable(),
});

/**
 * Task entity schema aligned with Prisma Task model
 */
export const TaskEntitySchema = BaseEntitySchema.extend({
  title: z.string().min(1, 'Task title is required').max(200, 'Task title must not exceed 200 characters'),
  description: z.string().max(2000, 'Task description must not exceed 2000 characters').nullable(),
  status: z.nativeEnum(TaskStatus),
  priority: z.nativeEnum(TaskPriority),
  createdById: z.string().uuid('Creator ID must be a valid UUID'),
  assigneeId: z.string().uuid('Assignee ID must be a valid UUID').nullable(),
  projectId: z.string().uuid('Project ID must be a valid UUID').nullable(),
  tags: z.array(z.string().max(50, 'Tag must not exceed 50 characters')).default([]),
  dueDate: z.date().nullable(),
  completedAt: z.date().nullable(),
});

/**
 * Project entity schema aligned with Prisma Project model
 */
export const ProjectEntitySchema = BaseEntitySchema.extend({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name must not exceed 100 characters'),
  description: z.string().max(1000, 'Project description must not exceed 1000 characters').nullable(),
});

/**
 * User session entity schema aligned with Prisma UserSession model
 */
export const UserSessionEntitySchema = BaseEntitySchema.extend({
  userId: z.string().uuid('User ID must be a valid UUID'),
  deviceInfo: z.string().max(500, 'Device info must not exceed 500 characters').nullable(),
  ipAddress: z.string().ip('Invalid IP address').nullable(),
  userAgent: z.string().max(1000, 'User agent must not exceed 1000 characters').nullable(),
  isActive: z.boolean(),
  expiresAt: z.date(),
  lastActivityAt: z.date(),
});

/**
 * Create user input schema for database operations
 */
export const CreateUserInputSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must not exceed 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must not exceed 50 characters'),
  passwordHash: z.string().min(1, 'Password hash is required'),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
});

/**
 * Update user input schema for database operations
 */
export const UpdateUserInputSchema = CreateUserInputSchema.partial().omit({ passwordHash: true }).extend({
  passwordHash: z.string().min(1, 'Password hash is required').optional(),
});

/**
 * Create task input schema for database operations
 */
export const CreateTaskInputSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(200, 'Task title must not exceed 200 characters'),
  description: z.string().max(2000, 'Task description must not exceed 2000 characters').optional(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  createdById: z.string().uuid('Creator ID must be a valid UUID'),
  assigneeId: z.string().uuid('Assignee ID must be a valid UUID').optional(),
  projectId: z.string().uuid('Project ID must be a valid UUID').optional(),
  tags: z.array(z.string().max(50, 'Tag must not exceed 50 characters')).default([]),
  dueDate: z.date().optional(),
});

/**
 * Update task input schema for database operations
 */
export const UpdateTaskInputSchema = CreateTaskInputSchema.partial().extend({
  status: z.nativeEnum(TaskStatus).optional(),
  completedAt: z.date().optional(),
});

/**
 * Create project input schema for database operations
 */
export const CreateProjectInputSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name must not exceed 100 characters'),
  description: z.string().max(1000, 'Project description must not exceed 1000 characters').optional(),
});

/**
 * Update project input schema for database operations
 */
export const UpdateProjectInputSchema = CreateProjectInputSchema.partial();

/**
 * Database query options schemas
 */
export const PaginationSchema = z.object({
  skip: z.number().int().min(0, 'Skip must be a non-negative integer').default(0),
  take: z.number().int().min(1, 'Take must be a positive integer').max(100, 'Take must not exceed 100').default(10),
});

export const SortOrderSchema = z.enum(['asc', 'desc']);

export const UserSortSchema = z.object({
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  email: SortOrderSchema.optional(),
  username: SortOrderSchema.optional(),
  lastName: SortOrderSchema.optional(),
}).optional();

export const TaskSortSchema = z.object({
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  title: SortOrderSchema.optional(),
  status: SortOrderSchema.optional(),
  priority: SortOrderSchema.optional(),
  dueDate: SortOrderSchema.optional(),
}).optional();

export const ProjectSortSchema = z.object({
  createdAt: SortOrderSchema.optional(),
  updatedAt: SortOrderSchema.optional(),
  name: SortOrderSchema.optional(),
}).optional();

/**
 * Database filter schemas for advanced queries
 */
export const UserFilterSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().optional(), // Search in email, username, firstName, lastName
}).optional();

export const TaskFilterSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  createdById: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  dueBefore: z.date().optional(),
  dueAfter: z.date().optional(),
  search: z.string().optional(), // Search in title and description
}).optional();

export const ProjectFilterSchema = z.object({
  name: z.string().optional(),
  search: z.string().optional(), // Search in name and description
}).optional();

/**
 * TypeScript types derived from Zod schemas
 */
export type UserEntity = z.infer<typeof UserEntitySchema>;
export type TaskEntity = z.infer<typeof TaskEntitySchema>;
export type ProjectEntity = z.infer<typeof ProjectEntitySchema>;
export type UserSessionEntity = z.infer<typeof UserSessionEntitySchema>;

export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;

export type Pagination = z.infer<typeof PaginationSchema>;
export type UserSort = z.infer<typeof UserSortSchema>;
export type TaskSort = z.infer<typeof TaskSortSchema>;
export type ProjectSort = z.infer<typeof ProjectSortSchema>;

export type UserFilter = z.infer<typeof UserFilterSchema>;
export type TaskFilter = z.infer<typeof TaskFilterSchema>;
export type ProjectFilter = z.infer<typeof ProjectFilterSchema>;

/**
 * Validation helper functions for runtime type checking
 */
export const validateUserEntity = (data: unknown): UserEntity => {
  return UserEntitySchema.parse(data);
};

export const validateTaskEntity = (data: unknown): TaskEntity => {
  return TaskEntitySchema.parse(data);
};

export const validateProjectEntity = (data: unknown): ProjectEntity => {
  return ProjectEntitySchema.parse(data);
};

export const validateCreateUserInput = (data: unknown): CreateUserInput => {
  return CreateUserInputSchema.parse(data);
};

export const validateUpdateUserInput = (data: unknown): UpdateUserInput => {
  return UpdateUserInputSchema.parse(data);
};

export const validateCreateTaskInput = (data: unknown): CreateTaskInput => {
  return CreateTaskInputSchema.parse(data);
};

export const validateUpdateTaskInput = (data: unknown): UpdateTaskInput => {
  return UpdateTaskInputSchema.parse(data);
};

export const validateCreateProjectInput = (data: unknown): CreateProjectInput => {
  return CreateProjectInputSchema.parse(data);
};

export const validateUpdateProjectInput = (data: unknown): UpdateProjectInput => {
  return UpdateProjectInputSchema.parse(data);
};

export const validatePagination = (data: unknown): Pagination => {
  return PaginationSchema.parse(data);
};

export const validateUserFilter = (data: unknown): UserFilter => {
  return UserFilterSchema.parse(data);
};

export const validateTaskFilter = (data: unknown): TaskFilter => {
  return TaskFilterSchema.parse(data);
};

export const validateProjectFilter = (data: unknown): ProjectFilter => {
  return ProjectFilterSchema.parse(data);
};