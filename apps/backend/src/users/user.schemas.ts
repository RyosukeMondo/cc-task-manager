import { z } from 'zod';
import { UserRole, UserStatus, UserBaseSchema } from '../schemas/auth.schemas';

/**
 * User profile update schema
 */
export const UserProfileUpdateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must not exceed 50 characters').optional(),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must not exceed 50 characters').optional(),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
    .optional(),
});

/**
 * User query filter schema
 */
export const UserQueryFilterSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'email', 'username', 'firstName', 'lastName']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * User role update schema (admin only)
 */
export const UserRoleUpdateSchema = z.object({
  role: z.nativeEnum(UserRole),
});

/**
 * User status update schema (admin/moderator only)
 */
export const UserStatusUpdateSchema = z.object({
  status: z.nativeEnum(UserStatus),
  reason: z.string().optional(),
});

/**
 * User list response schema
 */
export const UserListResponseSchema = z.object({
  users: z.array(UserBaseSchema.omit({ lastLoginAt: true })),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    totalPages: z.number(),
  }),
});

/**
 * User statistics schema (admin only)
 */
export const UserStatisticsSchema = z.object({
  totalUsers: z.number(),
  activeUsers: z.number(),
  suspendedUsers: z.number(),
  pendingVerification: z.number(),
  usersByRole: z.object({
    [UserRole.ADMIN]: z.number(),
    [UserRole.MODERATOR]: z.number(),
    [UserRole.USER]: z.number(),
  }),
  recentSignups: z.number(),
  activeToday: z.number(),
});

/**
 * Bulk user action schema
 */
export const BulkUserActionSchema = z.object({
  userIds: z.array(z.string().uuid()),
  action: z.enum(['activate', 'deactivate', 'suspend', 'delete']),
  reason: z.string().optional(),
});

/**
 * User activity schema
 */
export const UserActivitySchema = z.object({
  userId: z.string().uuid(),
  action: z.string(),
  details: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  timestamp: z.date(),
});

/**
 * TypeScript types derived from Zod schemas
 */
export type UserProfileUpdate = z.infer<typeof UserProfileUpdateSchema>;
export type UserQueryFilter = z.infer<typeof UserQueryFilterSchema>;
export type UserRoleUpdate = z.infer<typeof UserRoleUpdateSchema>;
export type UserStatusUpdate = z.infer<typeof UserStatusUpdateSchema>;
export type UserListResponse = z.infer<typeof UserListResponseSchema>;
export type UserStatistics = z.infer<typeof UserStatisticsSchema>;
export type BulkUserAction = z.infer<typeof BulkUserActionSchema>;
export type UserActivity = z.infer<typeof UserActivitySchema>;

/**
 * Validation helper functions
 */
export const validateUserProfileUpdate = (data: unknown): UserProfileUpdate => {
  return UserProfileUpdateSchema.parse(data);
};

export const validateUserQueryFilter = (data: unknown): UserQueryFilter => {
  return UserQueryFilterSchema.parse(data);
};

export const validateUserRoleUpdate = (data: unknown): UserRoleUpdate => {
  return UserRoleUpdateSchema.parse(data);
};

export const validateUserStatusUpdate = (data: unknown): UserStatusUpdate => {
  return UserStatusUpdateSchema.parse(data);
};

export const validateBulkUserAction = (data: unknown): BulkUserAction => {
  return BulkUserActionSchema.parse(data);
};