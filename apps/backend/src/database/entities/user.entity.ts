import { z } from 'zod';

/**
 * User Role Enum Schema - exactly matching Prisma enum
 */
export const UserRoleSchema = z.enum(['ADMIN', 'USER', 'MODERATOR']);

/**
 * User Status Enum Schema - exactly matching Prisma enum
 */
export const UserStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']);

/**
 * User Entity Schema - exactly mirroring Prisma User model
 * 
 * This schema provides type-safe validation for user entities
 * and ensures synchronization between database model and contract validation.
 */
export const UserEntitySchema = z.object({
  id: z.string().uuid('User ID must be a valid UUID'),
  email: z.string().email('Invalid email format'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be at most 30 characters'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must be at most 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be at most 50 characters'),
  role: UserRoleSchema.default('USER'),
  status: UserStatusSchema.default('ACTIVE'),
  password: z.string().min(1, 'Password is required'),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLoginAt: z.date().nullable(),
});

/**
 * User Entity Creation Schema - for creating new users
 * Omits auto-generated fields (id, createdAt, updatedAt)
 */
export const CreateUserEntitySchema = UserEntitySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

/**
 * User Entity Update Schema - for updating existing users
 * Makes most fields optional except required identifiers
 */
export const UpdateUserEntitySchema = UserEntitySchema.partial().omit({
  id: true,
  createdAt: true,
});

/**
 * User Entity Query Schema - for filtering user queries
 */
export const UserEntityQuerySchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: UserRoleSchema.optional(),
  status: UserStatusSchema.optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  lastLoginAfter: z.date().optional(),
  lastLoginBefore: z.date().optional(),
});

/**
 * TypeScript types derived from Zod schemas
 */
export type UserRole = z.infer<typeof UserRoleSchema>;
export type UserStatus = z.infer<typeof UserStatusSchema>;
export type UserEntity = z.infer<typeof UserEntitySchema>;
export type CreateUserEntity = z.infer<typeof CreateUserEntitySchema>;
export type UpdateUserEntity = z.infer<typeof UpdateUserEntitySchema>;
export type UserEntityQuery = z.infer<typeof UserEntityQuerySchema>;

/**
 * Validation helpers for runtime type checking
 */
export const validateUserEntity = (data: unknown): UserEntity => {
  return UserEntitySchema.parse(data);
};

export const validateCreateUserEntity = (data: unknown): CreateUserEntity => {
  return CreateUserEntitySchema.parse(data);
};

export const validateUpdateUserEntity = (data: unknown): UpdateUserEntity => {
  return UpdateUserEntitySchema.parse(data);
};

export const validateUserEntityQuery = (data: unknown): UserEntityQuery => {
  return UserEntityQuerySchema.parse(data);
};