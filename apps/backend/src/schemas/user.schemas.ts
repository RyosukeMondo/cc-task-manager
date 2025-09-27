import { z } from 'zod';

/**
 * User management schemas for backend-specific contract extensions
 * Extends existing contract infrastructure with user-specific validation
 */

/**
 * User role enumeration for access control
 */
export enum UserRole {
  USER = 'user',
  MANAGER = 'manager',
  ADMIN = 'admin',
}

/**
 * User status enumeration for account management
 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

/**
 * User response schema for API responses
 */
export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
  permissions: z.array(z.string()),
  lastLoginAt: z.date().nullable(),
  emailVerifiedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * User creation schema for admin user creation
 */
export const UserCreateSchema = z.object({
  email: z.string().email('Invalid email format'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
  status: z.nativeEnum(UserStatus).default(UserStatus.PENDING),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
           'Password must contain uppercase, lowercase, number, and special character'),
  sendWelcomeEmail: z.boolean().default(true),
});

/**
 * User update schema for user modifications
 */
export const UserUpdateSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long').optional(),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long').optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  permissions: z.array(z.string()).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

/**
 * User list query schema for filtering and pagination
 */
export const UserListQuerySchema = z.object({
  page: z.coerce.number().positive().default(1),
  limit: z.coerce.number().positive().max(100, 'Limit cannot exceed 100').default(20),
  sortBy: z.enum(['firstName', 'lastName', 'email', 'role', 'status', 'createdAt', 'lastLoginAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  search: z.string().max(100, 'Search term too long').optional(),
  emailVerified: z.boolean().optional(),
});

/**
 * User list response schema for paginated results
 */
export const UserListResponseSchema = z.object({
  users: z.array(UserResponseSchema),
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
 * Password change schema for authenticated users
 */
export const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
           'Password must contain uppercase, lowercase, number, and special character'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}).refine(data => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});

/**
 * Email verification schema
 */
export const EmailVerificationSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

/**
 * User permissions schema for CASL integration
 */
export const UserPermissionSchema = z.object({
  action: z.string().min(1, 'Action is required'),
  subject: z.string().min(1, 'Subject is required'),
  conditions: z.record(z.any()).optional(),
  inverted: z.boolean().default(false),
  reason: z.string().optional(),
});

/**
 * User session schema for session management
 */
export const UserSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  deviceId: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().ip().optional(),
  lastActivity: z.date(),
  expiresAt: z.date(),
  isActive: z.boolean(),
  createdAt: z.date(),
});

/**
 * User activity log schema for audit trail
 */
export const UserActivitySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  action: z.string(),
  resource: z.string().optional(),
  resourceId: z.string().optional(),
  details: z.record(z.any()).optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  timestamp: z.date(),
});

/**
 * TypeScript types derived from Zod schemas
 */
export type UserResponse = z.infer<typeof UserResponseSchema>;
export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
export type UserListQuery = z.infer<typeof UserListQuerySchema>;
export type UserListResponse = z.infer<typeof UserListResponseSchema>;
export type PasswordChange = z.infer<typeof PasswordChangeSchema>;
export type EmailVerification = z.infer<typeof EmailVerificationSchema>;
export type UserPermission = z.infer<typeof UserPermissionSchema>;
export type UserSession = z.infer<typeof UserSessionSchema>;
export type UserActivity = z.infer<typeof UserActivitySchema>;