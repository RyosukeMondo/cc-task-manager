import { z } from 'zod';
import { UserRole, UserStatus } from './auth.schemas';

/**
 * User profile preferences schema
 */
export const UserPreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Language must be in format "en" or "en-US"').default('en'),
  timezone: z.string().min(1, 'Timezone is required').default('UTC'),
  dateFormat: z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']).default('MM/DD/YYYY'),
  timeFormat: z.enum(['12h', '24h']).default('12h'),
  emailNotifications: z.boolean().default(true),
  pushNotifications: z.boolean().default(true),
  taskReminders: z.boolean().default(true),
  weeklyReports: z.boolean().default(false),
});

/**
 * User avatar schema
 */
export const UserAvatarSchema = z.object({
  id: z.string().uuid('Avatar ID must be a valid UUID'),
  userId: z.string().uuid('User ID must be a valid UUID'),
  fileName: z.string().min(1, 'File name is required'),
  originalName: z.string().min(1, 'Original name is required'),
  mimeType: z.string().regex(/^image\/(jpeg|png|gif|webp)$/, 'Avatar must be a valid image format'),
  fileSize: z.number().positive('File size must be positive').max(5242880, 'Avatar must not exceed 5MB'),
  filePath: z.string().min(1, 'File path is required'),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Extended user profile schema including preferences and avatar
 */
export const UserProfileSchema = z.object({
  id: z.string().uuid('User ID must be a valid UUID'),
  email: z.string().email('Invalid email address'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must not exceed 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must not exceed 50 characters'),
  displayName: z.string().max(100, 'Display name must not exceed 100 characters').optional(),
  bio: z.string().max(500, 'Bio must not exceed 500 characters').optional(),
  jobTitle: z.string().max(100, 'Job title must not exceed 100 characters').optional(),
  department: z.string().max(100, 'Department must not exceed 100 characters').optional(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
  preferences: UserPreferencesSchema,
  avatar: UserAvatarSchema.optional(),
  isEmailVerified: z.boolean().default(false),
  isPhoneVerified: z.boolean().default(false),
  lastLoginAt: z.date().optional(),
  passwordChangedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * User profile update schema
 */
export const UpdateUserProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must not exceed 50 characters').optional(),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must not exceed 50 characters').optional(),
  displayName: z.string().max(100, 'Display name must not exceed 100 characters').optional(),
  bio: z.string().max(500, 'Bio must not exceed 500 characters').optional(),
  jobTitle: z.string().max(100, 'Job title must not exceed 100 characters').optional(),
  department: z.string().max(100, 'Department must not exceed 100 characters').optional(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
  preferences: UserPreferencesSchema.partial().optional(),
});

/**
 * User query filters schema for searching and filtering users
 */
export const UserQueryFiltersSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  department: z.string().optional(),
  isEmailVerified: z.boolean().optional(),
  isPhoneVerified: z.boolean().optional(),
  createdFrom: z.date().optional(),
  createdTo: z.date().optional(),
  lastLoginFrom: z.date().optional(),
  lastLoginTo: z.date().optional(),
  search: z.string().max(100, 'Search query must not exceed 100 characters').optional(),
  page: z.number().positive('Page must be positive').default(1),
  limit: z.number().positive('Limit must be positive').max(100, 'Limit must not exceed 100').default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'lastLoginAt', 'firstName', 'lastName', 'email']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Admin user creation schema
 */
export const AdminCreateUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must not exceed 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must not exceed 50 characters'),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
  department: z.string().max(100, 'Department must not exceed 100 characters').optional(),
  jobTitle: z.string().max(100, 'Job title must not exceed 100 characters').optional(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
  sendWelcomeEmail: z.boolean().default(true),
  temporaryPassword: z.boolean().default(true),
});

/**
 * Admin user update schema
 */
export const AdminUpdateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must not exceed 50 characters').optional(),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must not exceed 50 characters').optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  department: z.string().max(100, 'Department must not exceed 100 characters').optional(),
  jobTitle: z.string().max(100, 'Job title must not exceed 100 characters').optional(),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional(),
  isEmailVerified: z.boolean().optional(),
  isPhoneVerified: z.boolean().optional(),
});

/**
 * User activity log schema for audit trail
 */
export const UserActivityLogSchema = z.object({
  id: z.string().uuid('Activity ID must be a valid UUID'),
  userId: z.string().uuid('User ID must be a valid UUID'),
  action: z.string().min(1, 'Action is required').max(100, 'Action must not exceed 100 characters'),
  resource: z.string().max(100, 'Resource must not exceed 100 characters').optional(),
  resourceId: z.string().optional(),
  details: z.record(z.any()).optional(),
  ipAddress: z.string().ip('Invalid IP address').optional(),
  userAgent: z.string().max(1000, 'User agent must not exceed 1000 characters').optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
});

/**
 * User invitation schema
 */
export const UserInvitationSchema = z.object({
  id: z.string().uuid('Invitation ID must be a valid UUID'),
  email: z.string().email('Invalid email address'),
  role: z.nativeEnum(UserRole),
  invitedById: z.string().uuid('Invited by ID must be a valid UUID'),
  token: z.string().min(1, 'Token is required'),
  isUsed: z.boolean().default(false),
  expiresAt: z.date(),
  usedAt: z.date().optional(),
  createdAt: z.date(),
});

/**
 * Create user invitation schema
 */
export const CreateUserInvitationSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.nativeEnum(UserRole),
  expiresInDays: z.number().positive('Expires in days must be positive').max(30, 'Expiration cannot exceed 30 days').default(7),
  message: z.string().max(500, 'Message must not exceed 500 characters').optional(),
});

/**
 * Accept user invitation schema
 */
export const AcceptUserInvitationSchema = z.object({
  token: z.string().min(1, 'Token is required'),
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
 * User statistics schema for admin dashboard
 */
export const UserStatisticsSchema = z.object({
  totalUsers: z.number().nonnegative(),
  activeUsers: z.number().nonnegative(),
  newUsersThisWeek: z.number().nonnegative(),
  newUsersThisMonth: z.number().nonnegative(),
  usersByRole: z.record(z.nativeEnum(UserRole), z.number().nonnegative()),
  usersByStatus: z.record(z.nativeEnum(UserStatus), z.number().nonnegative()),
  usersByDepartment: z.record(z.string(), z.number().nonnegative()),
  averageSessionDuration: z.number().nonnegative().optional(),
  lastLoginActivity: z.record(z.string(), z.number().nonnegative()),
});

/**
 * TypeScript types derived from Zod schemas
 */
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
export type UserAvatar = z.infer<typeof UserAvatarSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UpdateUserProfile = z.infer<typeof UpdateUserProfileSchema>;
export type UserQueryFilters = z.infer<typeof UserQueryFiltersSchema>;
export type AdminCreateUser = z.infer<typeof AdminCreateUserSchema>;
export type AdminUpdateUser = z.infer<typeof AdminUpdateUserSchema>;
export type UserActivityLog = z.infer<typeof UserActivityLogSchema>;
export type UserInvitation = z.infer<typeof UserInvitationSchema>;
export type CreateUserInvitation = z.infer<typeof CreateUserInvitationSchema>;
export type AcceptUserInvitation = z.infer<typeof AcceptUserInvitationSchema>;
export type UserStatistics = z.infer<typeof UserStatisticsSchema>;

/**
 * Validation helper functions for runtime type checking
 */
export const validateUserPreferences = (data: unknown): UserPreferences => {
  return UserPreferencesSchema.parse(data);
};

export const validateUserAvatar = (data: unknown): UserAvatar => {
  return UserAvatarSchema.parse(data);
};

export const validateUserProfile = (data: unknown): UserProfile => {
  return UserProfileSchema.parse(data);
};

export const validateUpdateUserProfile = (data: unknown): UpdateUserProfile => {
  return UpdateUserProfileSchema.parse(data);
};

export const validateUserQueryFilters = (data: unknown): UserQueryFilters => {
  return UserQueryFiltersSchema.parse(data);
};

export const validateAdminCreateUser = (data: unknown): AdminCreateUser => {
  return AdminCreateUserSchema.parse(data);
};

export const validateAdminUpdateUser = (data: unknown): AdminUpdateUser => {
  return AdminUpdateUserSchema.parse(data);
};

export const validateUserActivityLog = (data: unknown): UserActivityLog => {
  return UserActivityLogSchema.parse(data);
};

export const validateUserInvitation = (data: unknown): UserInvitation => {
  return UserInvitationSchema.parse(data);
};

export const validateCreateUserInvitation = (data: unknown): CreateUserInvitation => {
  return CreateUserInvitationSchema.parse(data);
};

export const validateAcceptUserInvitation = (data: unknown): AcceptUserInvitation => {
  return AcceptUserInvitationSchema.parse(data);
};

export const validateUserStatistics = (data: unknown): UserStatistics => {
  return UserStatisticsSchema.parse(data);
};