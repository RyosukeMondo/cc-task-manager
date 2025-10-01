import { z } from 'zod';

/**
 * Shared Authentication Schemas
 * Single Source of Truth for auth-related contracts between frontend and backend
 *
 * This file ensures type safety and validation consistency across the application.
 */

/**
 * User role enumeration for authorization control
 * Matches Prisma schema enum values
 * Using z.enum() for Prisma compatibility (contract-driven development)
 */
export const UserRoleSchema = z.enum(['ADMIN', 'USER', 'MODERATOR']);
export type UserRole = z.infer<typeof UserRoleSchema>;

// Export as const object for runtime usage
export const UserRole = {
  ADMIN: 'ADMIN',
  USER: 'USER',
  MODERATOR: 'MODERATOR',
} as const;

/**
 * User account status enumeration
 * Matches Prisma schema enum values
 * Using z.enum() for Prisma compatibility (contract-driven development)
 */
export const UserStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']);
export type UserStatus = z.infer<typeof UserStatusSchema>;

// Export as const object for runtime usage
export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
} as const;

/**
 * User base schema with common user properties
 */
export const UserBaseSchema = z.object({
  id: z.string().uuid('User ID must be a valid UUID'),
  email: z.string().email('Invalid email address'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must not exceed 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must not exceed 50 characters'),
  role: UserRoleSchema,
  status: UserStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLoginAt: z.date().optional(),
});

/**
 * User registration request schema
 */
export const UserRegistrationSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
    ),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must not exceed 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must not exceed 50 characters'),
});

/**
 * User login request schema
 * IMPORTANT: Backend expects 'identifier' field (email or username), not separate 'email' field
 */
export const LoginRequestSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

/**
 * JWT payload schema for token validation
 */
export const JWTPayloadSchema = z.object({
  sub: z.string().uuid('Subject must be a valid UUID'),
  email: z.string().email('Invalid email address'),
  username: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: UserRoleSchema,
  permissions: z.array(z.string()).optional(),
  iat: z.number(),
  exp: z.number(),
  sessionId: z.string().uuid('Session ID must be a valid UUID').optional(),
});

/**
 * Authentication response schema
 */
export const AuthResponseSchema = z.object({
  accessToken: z.string().min(1, 'Access token is required'),
  refreshToken: z.string().min(1, 'Refresh token is required'),
  expiresIn: z.number().positive('Expires in must be positive'),
  tokenType: z.string().default('Bearer'),
  user: UserBaseSchema.omit({ lastLoginAt: true }),
});

/**
 * Token refresh request schema
 */
export const TokenRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Password change request schema
 */
export const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'New password must not exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
    ),
});

/**
 * Password reset request schema
 */
export const PasswordResetRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * Password reset confirmation schema
 */
export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters')
    .max(128, 'New password must not exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
    ),
});

/**
 * User session schema for session management
 */
export const UserSessionSchema = z.object({
  id: z.string().uuid('Session ID must be a valid UUID'),
  userId: z.string().uuid('User ID must be a valid UUID'),
  deviceInfo: z.string().max(500, 'Device info must not exceed 500 characters').optional(),
  ipAddress: z.string().ip('Invalid IP address').optional(),
  userAgent: z.string().max(1000, 'User agent must not exceed 1000 characters').optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  expiresAt: z.date(),
  lastActivityAt: z.date(),
});

/**
 * Permission schema for CASL authorization
 */
export const PermissionSchema = z.object({
  action: z.string().min(1, 'Action is required'),
  subject: z.string().min(1, 'Subject is required'),
  conditions: z.record(z.any()).optional(),
  fields: z.array(z.string()).optional(),
});

/**
 * Role permissions schema
 */
export const RolePermissionsSchema = z.object({
  role: UserRoleSchema,
  permissions: z.array(PermissionSchema),
});

/**
 * TypeScript types derived from Zod schemas
 */
export type UserBase = z.infer<typeof UserBaseSchema>;
export type UserRegistration = z.infer<typeof UserRegistrationSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type JWTPayload = z.infer<typeof JWTPayloadSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type TokenRefresh = z.infer<typeof TokenRefreshSchema>;
export type PasswordChange = z.infer<typeof PasswordChangeSchema>;
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;
export type UserSession = z.infer<typeof UserSessionSchema>;
export type Permission = z.infer<typeof PermissionSchema>;
export type RolePermissions = z.infer<typeof RolePermissionsSchema>;

/**
 * Validation helper functions for runtime type checking
 */
export const validateUserBase = (data: unknown): UserBase => {
  return UserBaseSchema.parse(data);
};

export const validateUserRegistration = (data: unknown): UserRegistration => {
  return UserRegistrationSchema.parse(data);
};

export const validateLoginRequest = (data: unknown): LoginRequest => {
  return LoginRequestSchema.parse(data);
};

export const validateJWTPayload = (data: unknown): JWTPayload => {
  return JWTPayloadSchema.parse(data);
};

export const validateAuthResponse = (data: unknown): AuthResponse => {
  return AuthResponseSchema.parse(data);
};

export const validateTokenRefresh = (data: unknown): TokenRefresh => {
  return TokenRefreshSchema.parse(data);
};

export const validatePasswordChange = (data: unknown): PasswordChange => {
  return PasswordChangeSchema.parse(data);
};

export const validatePasswordResetRequest = (data: unknown): PasswordResetRequest => {
  return PasswordResetRequestSchema.parse(data);
};

export const validatePasswordResetConfirm = (data: unknown): PasswordResetConfirm => {
  return PasswordResetConfirmSchema.parse(data);
};

export const validateUserSession = (data: unknown): UserSession => {
  return UserSessionSchema.parse(data);
};

export const validatePermission = (data: unknown): Permission => {
  return PermissionSchema.parse(data);
};

export const validateRolePermissions = (data: unknown): RolePermissions => {
  return RolePermissionsSchema.parse(data);
};

/**
 * Aliased exports for backend compatibility
 * These provide alternative names for schemas to maintain backward compatibility
 */
export const loginSchema = LoginRequestSchema;
export const registerSchema = UserRegistrationSchema;