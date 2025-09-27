import { z } from 'zod';

/**
 * Project management schemas for backend-specific contract extensions
 * Extends existing contract infrastructure with project-specific validation
 */

/**
 * Project status enumeration for project lifecycle management
 */
export enum ProjectStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * Project visibility levels for access control
 */
export enum ProjectVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  INTERNAL = 'internal',
}

/**
 * Project creation schema for new project validation
 */
export const ProjectCreateSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.PLANNING),
  visibility: z.nativeEnum(ProjectVisibility).default(ProjectVisibility.PRIVATE),
  ownerId: z.string().uuid('Invalid owner ID'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  budget: z.number().positive('Budget must be positive').optional(),
  tags: z.array(z.string().min(1).max(20)).max(10, 'Too many tags').default([]),
}).refine(data => {
  if (data.startDate && data.endDate) {
    return data.endDate > data.startDate;
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['endDate'],
});

/**
 * Project update schema for project modifications
 */
export const ProjectUpdateSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  visibility: z.nativeEnum(ProjectVisibility).optional(),
  ownerId: z.string().uuid('Invalid owner ID').optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  budget: z.number().positive('Budget must be positive').nullable().optional(),
  tags: z.array(z.string().min(1).max(20)).max(10, 'Too many tags').optional(),
}).refine(data => {
  if (data.startDate && data.endDate) {
    return data.endDate > data.startDate;
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['endDate'],
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

/**
 * Project response schema for API responses
 */
export const ProjectResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.nativeEnum(ProjectStatus),
  visibility: z.nativeEnum(ProjectVisibility),
  ownerId: z.string().uuid(),
  owner: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
  }),
  startDate: z.date().nullable(),
  endDate: z.date().nullable(),
  budget: z.number().nullable(),
  tags: z.array(z.string()),
  taskCount: z.number().default(0),
  completedTaskCount: z.number().default(0),
  memberCount: z.number().default(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Project list query schema for filtering and pagination
 */
export const ProjectListQuerySchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100, 'Limit cannot exceed 100').default(20),
  sortBy: z.enum(['name', 'status', 'startDate', 'endDate', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.nativeEnum(ProjectStatus).optional(),
  visibility: z.nativeEnum(ProjectVisibility).optional(),
  ownerId: z.string().uuid().optional(),
  search: z.string().max(100, 'Search term too long').optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Project list response schema for paginated results
 */
export const ProjectListResponseSchema = z.object({
  projects: z.array(ProjectResponseSchema),
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
 * Project member role enumeration
 */
export enum ProjectMemberRole {
  VIEWER = 'viewer',
  CONTRIBUTOR = 'contributor',
  MANAGER = 'manager',
  ADMIN = 'admin',
}

/**
 * Project member schema for team management
 */
export const ProjectMemberSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  user: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
  }),
  role: z.nativeEnum(ProjectMemberRole),
  joinedAt: z.date(),
  invitedBy: z.string().uuid(),
  invitedByUser: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
  }),
});

/**
 * Project member invitation schema
 */
export const ProjectMemberInviteSchema = z.object({
  email: z.string().email('Invalid email format'),
  role: z.nativeEnum(ProjectMemberRole).default(ProjectMemberRole.CONTRIBUTOR),
  message: z.string().max(500, 'Message too long').optional(),
});

/**
 * Project member role update schema
 */
export const ProjectMemberUpdateSchema = z.object({
  role: z.nativeEnum(ProjectMemberRole),
});

/**
 * Project milestone schema for project planning
 */
export const ProjectMilestoneSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  dueDate: z.date(),
  completed: z.boolean().default(false),
  completedAt: z.date().nullable(),
  order: z.number().int().positive(),
  createdById: z.string().uuid(),
  createdBy: z.object({
    id: z.string().uuid(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Project milestone creation schema
 */
export const ProjectMilestoneCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  dueDate: z.coerce.date().min(new Date(), 'Due date must be in the future'),
  order: z.number().int().positive().optional(),
});

/**
 * Project milestone update schema
 */
export const ProjectMilestoneUpdateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  dueDate: z.coerce.date().optional(),
  completed: z.boolean().optional(),
  order: z.number().int().positive().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

/**
 * TypeScript types derived from Zod schemas
 */
export type ProjectCreate = z.infer<typeof ProjectCreateSchema>;
export type ProjectUpdate = z.infer<typeof ProjectUpdateSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type ProjectListQuery = z.infer<typeof ProjectListQuerySchema>;
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;
export type ProjectMember = z.infer<typeof ProjectMemberSchema>;
export type ProjectMemberInvite = z.infer<typeof ProjectMemberInviteSchema>;
export type ProjectMemberUpdate = z.infer<typeof ProjectMemberUpdateSchema>;
export type ProjectMilestone = z.infer<typeof ProjectMilestoneSchema>;
export type ProjectMilestoneCreate = z.infer<typeof ProjectMilestoneCreateSchema>;
export type ProjectMilestoneUpdate = z.infer<typeof ProjectMilestoneUpdateSchema>;