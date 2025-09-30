import { z } from 'zod';
import {
  LoginRequestSchema,
  AuthResponseSchema as BackendAuthResponseSchema,
  UserBaseSchema,
  JWTPayloadSchema as BackendJWTPayloadSchema,
  UserRegistrationSchema,
  UserRole,
} from '@cc-task-manager/schemas';

/**
 * Re-export shared schemas from backend for consistent contract enforcement
 * These are the SINGLE SOURCE OF TRUTH for auth types
 */
export { LoginRequestSchema, UserRegistrationSchema, UserBaseSchema };

/**
 * JWT payload structure for authentication tokens
 * Using backend schema as source of truth
 */
export const JWTPayloadSchema = BackendJWTPayloadSchema;
export type JWTPayload = z.infer<typeof JWTPayloadSchema>;

/**
 * User information derived from backend schema
 * Using backend UserBaseSchema as source of truth
 * Note: Simplified for frontend use - omits timestamp fields
 */
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.nativeEnum(UserRole),
});

export type User = z.infer<typeof UserSchema>;

// Re-export UserRole enum for convenience
export { UserRole };

/**
 * Authentication state interface
 */
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Login credentials interface
 * IMPORTANT: Backend expects 'identifier' field, not 'email'
 * Use LoginRequestSchema for validation, this is for UI convenience
 */
export interface LoginCredentials {
  email: string;  // Frontend uses email for UX
  password: string;
}

/**
 * Authentication response from backend
 * Mapped to match backend contract with accessToken -> token alias
 */
export const AuthResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
  expiresIn: z.number().optional(),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/**
 * Role-based permission interface
 */
export interface Permission {
  action: string;
  resource: string;
}

/**
 * Role definitions with hierarchical permissions
 */
export const ROLES = {
  admin: {
    name: 'admin',
    permissions: ['*'], // All permissions
  },
  user: {
    name: 'user',
    permissions: [
      'tasks:read',
      'tasks:create',
      'tasks:update',
      'tasks:delete',
      'dashboard:read',
      'profile:update',
    ],
  },
  viewer: {
    name: 'viewer',
    permissions: [
      'tasks:read',
      'dashboard:read',
      'profile:read',
    ],
  },
} as const;

export type Role = keyof typeof ROLES;