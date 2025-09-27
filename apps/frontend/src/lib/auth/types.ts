import { z } from 'zod';

/**
 * JWT payload structure for authentication tokens
 */
export const JWTPayloadSchema = z.object({
  sub: z.string(), // User ID
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'viewer']),
  permissions: z.array(z.string()),
  iat: z.number(),
  exp: z.number(),
});

export type JWTPayload = z.infer<typeof JWTPayloadSchema>;

/**
 * User information derived from JWT token
 */
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'viewer']),
  permissions: z.array(z.string()),
});

export type User = z.infer<typeof UserSchema>;

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
 */
export const LoginCredentialsSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginCredentials = z.infer<typeof LoginCredentialsSchema>;

/**
 * Authentication response from backend
 */
export const AuthResponseSchema = z.object({
  token: z.string(),
  user: UserSchema,
  expiresIn: z.number(),
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