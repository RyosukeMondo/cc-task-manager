import { z } from 'zod';

/**
 * Database Schema definitions that mirror Prisma models
 * 
 * These schemas ensure type safety and validation for database operations
 * while maintaining synchronization with the Prisma schema.
 * 
 * Each schema follows the SSOT principle by being aligned with:
 * - Prisma model definitions (schema.prisma)
 * - Contract validation infrastructure
 * - Repository pattern abstractions
 */

// =============================================================================
// ENUMS (mirroring Prisma enums)
// =============================================================================

export const UserRoleSchema = z.enum(['ADMIN', 'USER', 'MODERATOR']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const TaskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

// =============================================================================
// BASE SCHEMAS (mirroring Prisma models exactly)
// =============================================================================

/**
 * User Database Schema
 * Mirrors the Prisma User model with all fields and relationships
 */
export const DatabaseUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  username: z.string().min(3).max(50),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: UserRoleSchema.default('USER'),
  status: UserStatusSchema.default('ACTIVE'),
  password: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLoginAt: z.date().nullable(),
});

export type DatabaseUser = z.infer<typeof DatabaseUserSchema>;

/**
 * Task Database Schema
 * Mirrors the Prisma Task model with all fields and relationships
 */
export const DatabaseTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().nullable(),
  status: TaskStatusSchema.default('TODO'),
  priority: TaskPrioritySchema.default('MEDIUM'),
  createdById: z.string().uuid(),
  assigneeId: z.string().uuid().nullable(),
  projectId: z.string().uuid().nullable(),
  tags: z.array(z.string()),
  dueDate: z.date().nullable(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DatabaseTask = z.infer<typeof DatabaseTaskSchema>;

/**
 * Project Database Schema
 * Mirrors the Prisma Project model with all fields
 */
export const DatabaseProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DatabaseProject = z.infer<typeof DatabaseProjectSchema>;

/**
 * UserSession Database Schema
 * Mirrors the Prisma UserSession model with all fields
 */
export const DatabaseUserSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  deviceInfo: z.string().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  expiresAt: z.date(),
  lastActivityAt: z.date(),
});

export type DatabaseUserSession = z.infer<typeof DatabaseUserSessionSchema>;

// =============================================================================
// CREATE SCHEMAS (for repository operations)
// =============================================================================

/**
 * User creation schema (omitting generated fields)
 */
export const CreateDatabaseUserSchema = DatabaseUserSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export type CreateDatabaseUser = z.infer<typeof CreateDatabaseUserSchema>;

/**
 * Task creation schema (omitting generated fields)
 */
export const CreateDatabaseTaskSchema = DatabaseTaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export type CreateDatabaseTask = z.infer<typeof CreateDatabaseTaskSchema>;

/**
 * Project creation schema (omitting generated fields)
 */
export const CreateDatabaseProjectSchema = DatabaseProjectSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateDatabaseProject = z.infer<typeof CreateDatabaseProjectSchema>;

/**
 * UserSession creation schema (omitting generated fields)
 */
export const CreateDatabaseUserSessionSchema = DatabaseUserSessionSchema.omit({
  id: true,
  createdAt: true,
  lastActivityAt: true,
});

export type CreateDatabaseUserSession = z.infer<typeof CreateDatabaseUserSessionSchema>;

// =============================================================================
// UPDATE SCHEMAS (for repository operations)
// =============================================================================

/**
 * User update schema (partial, excluding id and createdAt)
 */
export const UpdateDatabaseUserSchema = DatabaseUserSchema.omit({
  id: true,
  createdAt: true,
}).partial();

export type UpdateDatabaseUser = z.infer<typeof UpdateDatabaseUserSchema>;

/**
 * Task update schema (partial, excluding id and createdAt)
 */
export const UpdateDatabaseTaskSchema = DatabaseTaskSchema.omit({
  id: true,
  createdAt: true,
}).partial();

export type UpdateDatabaseTask = z.infer<typeof UpdateDatabaseTaskSchema>;

/**
 * Project update schema (partial, excluding id and createdAt)
 */
export const UpdateDatabaseProjectSchema = DatabaseProjectSchema.omit({
  id: true,
  createdAt: true,
}).partial();

export type UpdateDatabaseProject = z.infer<typeof UpdateDatabaseProjectSchema>;

/**
 * UserSession update schema (partial, excluding id and createdAt)
 */
export const UpdateDatabaseUserSessionSchema = DatabaseUserSessionSchema.omit({
  id: true,
  createdAt: true,
}).partial();

export type UpdateDatabaseUserSession = z.infer<typeof UpdateDatabaseUserSessionSchema>;

// =============================================================================
// RELATIONSHIP SCHEMAS (for including related data)
// =============================================================================

/**
 * User with relationships schema
 */
export const DatabaseUserWithRelationsSchema = DatabaseUserSchema.extend({
  createdTasks: z.array(DatabaseTaskSchema).optional(),
  assignedTasks: z.array(DatabaseTaskSchema).optional(),
  sessions: z.array(DatabaseUserSessionSchema).optional(),
});

export type DatabaseUserWithRelations = z.infer<typeof DatabaseUserWithRelationsSchema>;

/**
 * Task with relationships schema
 */
export const DatabaseTaskWithRelationsSchema = DatabaseTaskSchema.extend({
  createdBy: DatabaseUserSchema.optional(),
  assignee: DatabaseUserSchema.optional(),
  project: DatabaseProjectSchema.optional(),
});

export type DatabaseTaskWithRelations = z.infer<typeof DatabaseTaskWithRelationsSchema>;

/**
 * Project with relationships schema
 */
export const DatabaseProjectWithRelationsSchema = DatabaseProjectSchema.extend({
  tasks: z.array(DatabaseTaskSchema).optional(),
});

export type DatabaseProjectWithRelations = z.infer<typeof DatabaseProjectWithRelationsSchema>;

// =============================================================================
// QUERY FILTER SCHEMAS (for repository queries)
// =============================================================================

/**
 * User query filters for database operations
 */
export const DatabaseUserQueryFiltersSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().optional(),
  role: UserRoleSchema.optional(),
  status: UserStatusSchema.optional(),
  search: z.string().optional(), // For searching across name/email/username
}).partial();

export type DatabaseUserQueryFilters = z.infer<typeof DatabaseUserQueryFiltersSchema>;

/**
 * Task query filters for database operations
 */
export const DatabaseTaskQueryFiltersSchema = z.object({
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  createdById: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(), // For searching across title/description
  dueDateFrom: z.date().optional(),
  dueDateTo: z.date().optional(),
}).partial();

export type DatabaseTaskQueryFilters = z.infer<typeof DatabaseTaskQueryFiltersSchema>;

/**
 * Project query filters for database operations
 */
export const DatabaseProjectQueryFiltersSchema = z.object({
  name: z.string().optional(),
  search: z.string().optional(), // For searching across name/description
}).partial();

export type DatabaseProjectQueryFilters = z.infer<typeof DatabaseProjectQueryFiltersSchema>;

// =============================================================================
// PAGINATION SCHEMAS
// =============================================================================

/**
 * Pagination options for database queries
 */
export const DatabasePaginationSchema = z.object({
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
  orderBy: z.record(z.enum(['asc', 'desc'])).optional(),
});

export type DatabasePagination = z.infer<typeof DatabasePaginationSchema>;

/**
 * Paginated result wrapper
 */
export const DatabasePaginatedResultSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().min(0),
    skip: z.number().int().min(0),
    take: z.number().int().min(1),
    hasMore: z.boolean(),
  });

// =============================================================================
// TRANSACTION SCHEMAS
// =============================================================================

/**
 * Transaction context for database operations
 */
export const DatabaseTransactionContextSchema = z.object({
  transactionId: z.string().uuid(),
  startedAt: z.date(),
  operations: z.array(z.string()),
});

export type DatabaseTransactionContext = z.infer<typeof DatabaseTransactionContextSchema>;

// =============================================================================
// HEALTH CHECK SCHEMAS
// =============================================================================

/**
 * Database health check result schema
 */
export const DatabaseHealthCheckSchema = z.object({
  status: z.enum(['healthy', 'unhealthy', 'degraded']),
  timestamp: z.date(),
  connectionCount: z.number().int().min(0).optional(),
  maxConnections: z.number().int().min(0).optional(),
  responseTime: z.number().min(0).optional(), // in milliseconds
  errors: z.array(z.string()).optional(),
});

export type DatabaseHealthCheck = z.infer<typeof DatabaseHealthCheckSchema>;

// =============================================================================
// EXPORT ALL SCHEMAS FOR REGISTRY
// =============================================================================

export const DatabaseSchemas = {
  // Entity schemas
  DatabaseUser: DatabaseUserSchema,
  DatabaseTask: DatabaseTaskSchema,
  DatabaseProject: DatabaseProjectSchema,
  DatabaseUserSession: DatabaseUserSessionSchema,
  
  // Create schemas
  CreateDatabaseUser: CreateDatabaseUserSchema,
  CreateDatabaseTask: CreateDatabaseTaskSchema,
  CreateDatabaseProject: CreateDatabaseProjectSchema,
  CreateDatabaseUserSession: CreateDatabaseUserSessionSchema,
  
  // Update schemas
  UpdateDatabaseUser: UpdateDatabaseUserSchema,
  UpdateDatabaseTask: UpdateDatabaseTaskSchema,
  UpdateDatabaseProject: UpdateDatabaseProjectSchema,
  UpdateDatabaseUserSession: UpdateDatabaseUserSessionSchema,
  
  // Relationship schemas
  DatabaseUserWithRelations: DatabaseUserWithRelationsSchema,
  DatabaseTaskWithRelations: DatabaseTaskWithRelationsSchema,
  DatabaseProjectWithRelations: DatabaseProjectWithRelationsSchema,
  
  // Query filter schemas
  DatabaseUserQueryFilters: DatabaseUserQueryFiltersSchema,
  DatabaseTaskQueryFilters: DatabaseTaskQueryFiltersSchema,
  DatabaseProjectQueryFilters: DatabaseProjectQueryFiltersSchema,
  
  // Utility schemas
  DatabasePagination: DatabasePaginationSchema,
  DatabaseTransactionContext: DatabaseTransactionContextSchema,
  DatabaseHealthCheck: DatabaseHealthCheckSchema,
  
  // Enum schemas
  UserRole: UserRoleSchema,
  UserStatus: UserStatusSchema,
  TaskStatus: TaskStatusSchema,
  TaskPriority: TaskPrioritySchema,
} as const;