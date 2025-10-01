import { z } from 'zod';

/**
 * API Task Priority enumeration for REST API operations
 */
export enum ApiTaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/**
 * API Task Status enumeration for REST API operations
 * Aligned with Prisma ApiTaskStatus enum (Option B: Kanban workflow)
 */
export enum ApiTaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

/**
 * Create task schema for POST /api/tasks endpoint
 * Validates task creation with title, description, and priority
 */
export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be at most 200 characters'),
  description: z
    .string()
    .max(2000, 'Description must be at most 2000 characters')
    .optional(),
  priority: z.nativeEnum(ApiTaskPriority).default(ApiTaskPriority.MEDIUM),
});

/**
 * Update task schema for PATCH /api/tasks/:id endpoint
 * All fields optional for partial updates
 */
export const updateTaskSchema = z.object({
  status: z.nativeEnum(ApiTaskStatus).optional(),
  priority: z.nativeEnum(ApiTaskPriority).optional(),
  errorMessage: z.string().optional(),
});

/**
 * Task filter schema for GET /api/tasks endpoint
 * Supports filtering by status (single or array), priority (single or array) with pagination
 */
export const taskFilterSchema = z.object({
  status: z.union([
    z.nativeEnum(ApiTaskStatus),
    z.array(z.nativeEnum(ApiTaskStatus))
  ]).optional(),
  priority: z.union([
    z.nativeEnum(ApiTaskPriority),
    z.array(z.nativeEnum(ApiTaskPriority))
  ]).optional(),
  limit: z
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .optional()
    .default(20),
  offset: z.number().int().min(0, 'Offset must be at least 0').optional().default(0),
});

/**
 * TypeScript types inferred from Zod schemas
 * Single source of truth for validation and type safety
 */
export type CreateApiTaskDto = z.infer<typeof createTaskSchema>;
export type UpdateApiTaskDto = z.infer<typeof updateTaskSchema>;
export type ApiTaskFilterDto = z.infer<typeof taskFilterSchema>;

/**
 * Task response type matching Prisma ApiTask model
 */
export interface ApiTaskDto {
  id: string;
  title: string;
  description: string | null;
  status: ApiTaskStatus;
  priority: ApiTaskPriority;
  userId: string;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  errorMessage: string | null;
  logs: unknown[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Paginated task list response
 */
export interface PaginatedTasksDto {
  data: ApiTaskDto[];
  total: number;
  limit: number;
  offset: number;
}
