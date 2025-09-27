import { z } from 'zod';

/**
 * Project Entity Schema - exactly mirroring Prisma Project model
 * 
 * This schema provides type-safe validation for project entities
 * and ensures synchronization between database model and contract validation.
 */
export const ProjectEntitySchema = z.object({
  id: z.string().uuid('Project ID must be a valid UUID'),
  name: z.string().min(1, 'Project name is required').max(100, 'Project name must be at most 100 characters'),
  description: z.string().max(1000, 'Project description must be at most 1000 characters').nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Project Entity Creation Schema - for creating new projects
 * Omits auto-generated fields (id, createdAt, updatedAt)
 */
export const CreateProjectEntitySchema = ProjectEntitySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

/**
 * Project Entity Update Schema - for updating existing projects
 * Makes most fields optional except required identifiers
 */
export const UpdateProjectEntitySchema = ProjectEntitySchema.partial().omit({
  id: true,
  createdAt: true,
});

/**
 * Project Entity Query Schema - for filtering project queries
 */
export const ProjectEntityQuerySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().optional(),
  nameContains: z.string().optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  hasDescription: z.boolean().optional(),
});

/**
 * Project Statistics Schema - for project reporting and analytics
 */
export const ProjectStatisticsSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  taskCount: z.number().int().min(0),
  completedTasks: z.number().int().min(0),
  pendingTasks: z.number().int().min(0),
  overdueTasks: z.number().int().min(0),
  teamMembers: z.number().int().min(0),
  completionRate: z.number().min(0).max(100), // percentage
  averageTaskCompletionTime: z.number().min(0).nullable(), // in days
  createdAt: z.date(),
  lastActivity: z.date().nullable(),
});

/**
 * Project with Tasks Schema - includes related task information
 */
export const ProjectWithTasksSchema = ProjectEntitySchema.extend({
  tasks: z.array(z.object({
    id: z.string().uuid(),
    title: z.string(),
    status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    assigneeId: z.string().uuid().nullable(),
    dueDate: z.date().nullable(),
    completedAt: z.date().nullable(),
  })).default([]),
});

/**
 * TypeScript types derived from Zod schemas
 */
export type ProjectEntity = z.infer<typeof ProjectEntitySchema>;
export type CreateProjectEntity = z.infer<typeof CreateProjectEntitySchema>;
export type UpdateProjectEntity = z.infer<typeof UpdateProjectEntitySchema>;
export type ProjectEntityQuery = z.infer<typeof ProjectEntityQuerySchema>;
export type ProjectStatistics = z.infer<typeof ProjectStatisticsSchema>;
export type ProjectWithTasks = z.infer<typeof ProjectWithTasksSchema>;

/**
 * Validation helpers for runtime type checking
 */
export const validateProjectEntity = (data: unknown): ProjectEntity => {
  return ProjectEntitySchema.parse(data);
};

export const validateCreateProjectEntity = (data: unknown): CreateProjectEntity => {
  return CreateProjectEntitySchema.parse(data);
};

export const validateUpdateProjectEntity = (data: unknown): UpdateProjectEntity => {
  return UpdateProjectEntitySchema.parse(data);
};

export const validateProjectEntityQuery = (data: unknown): ProjectEntityQuery => {
  return ProjectEntityQuerySchema.parse(data);
};

export const validateProjectStatistics = (data: unknown): ProjectStatistics => {
  return ProjectStatisticsSchema.parse(data);
};

export const validateProjectWithTasks = (data: unknown): ProjectWithTasks => {
  return ProjectWithTasksSchema.parse(data);
};