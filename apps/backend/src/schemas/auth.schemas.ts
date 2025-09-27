import { z } from 'zod';

/**
 * Authentication schemas for backend-specific contract extensions
 * Extends existing contract infrastructure with auth-specific validation
 */

/**
 * User registration schema for account creation
 */
export const UserRegistrationSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
           'Password must contain uppercase, lowercase, number, and special character'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
  role: z.enum(['user', 'admin', 'manager']).default('user'),
  acceptedTerms: z.boolean().refine(val => val === true, 'Terms must be accepted'),
});

/**
 * User login schema for authentication
 */
export const UserLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

/**
 * JWT token payload schema for token validation
 */
export const JwtPayloadSchema = z.object({
  sub: z.string(), // User ID
  email: z.string().email(),
  role: z.enum(['user', 'admin', 'manager']),
  firstName: z.string(),
  lastName: z.string(),
  iat: z.number(),
  exp: z.number(),
  permissions: z.array(z.string()).default([]),
});

/**
 * Authentication response schema for login/register responses
 */
export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    role: z.enum(['user', 'admin', 'manager']),
    permissions: z.array(z.string()),
  }),
  expiresIn: z.number(),
});

/**
 * Token refresh schema for refreshing access tokens
 */
export const TokenRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Password reset request schema
 */
export const PasswordResetRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
});

/**
 * Password reset confirmation schema
 */
export const PasswordResetConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
           'Password must contain uppercase, lowercase, number, and special character'),
});

/**
 * User profile update schema
 */
export const UserProfileUpdateSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name too long').optional(),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long').optional(),
  email: z.string().email('Invalid email format').optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

/**
 * TypeScript types derived from Zod schemas
 */
export type UserRegistration = z.infer<typeof UserRegistrationSchema>;
export type UserLogin = z.infer<typeof UserLoginSchema>;
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type TokenRefresh = z.infer<typeof TokenRefreshSchema>;
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;
export type UserProfileUpdate = z.infer<typeof UserProfileUpdateSchema>;