import { z } from 'zod';

/**
 * User Session Entity Schema - exactly mirroring Prisma UserSession model
 * 
 * This schema provides type-safe validation for user session entities
 * and ensures synchronization between database model and contract validation.
 */
export const UserSessionEntitySchema = z.object({
  id: z.string().uuid('Session ID must be a valid UUID'),
  userId: z.string().uuid('User ID must be a valid UUID'),
  deviceInfo: z.string().max(500, 'Device info must be at most 500 characters').nullable(),
  ipAddress: z.string().ip('Invalid IP address format').nullable(),
  userAgent: z.string().max(1000, 'User agent must be at most 1000 characters').nullable(),
  isActive: z.boolean().default(true),
  createdAt: z.date(),
  expiresAt: z.date(),
  lastActivityAt: z.date(),
});

/**
 * User Session Entity Creation Schema - for creating new sessions
 * Omits auto-generated fields (id, createdAt)
 */
export const CreateUserSessionEntitySchema = UserSessionEntitySchema.omit({
  id: true,
  createdAt: true,
}).extend({
  // Ensure required fields for session creation
  userId: z.string().uuid('User ID must be a valid UUID'),
  expiresAt: z.date().refine(
    (date) => date > new Date(),
    'Expiration date must be in the future'
  ),
  lastActivityAt: z.date().default(() => new Date()),
});

/**
 * User Session Entity Update Schema - for updating existing sessions
 * Makes most fields optional except required identifiers
 */
export const UpdateUserSessionEntitySchema = UserSessionEntitySchema.partial().omit({
  id: true,
  userId: true, // User cannot be changed for a session
  createdAt: true,
});

/**
 * User Session Entity Query Schema - for filtering session queries
 */
export const UserSessionEntityQuerySchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
  ipAddress: z.string().ip().optional(),
  deviceInfo: z.string().optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  expiresAfter: z.date().optional(),
  expiresBefore: z.date().optional(),
  lastActivityAfter: z.date().optional(),
  lastActivityBefore: z.date().optional(),
  isExpired: z.boolean().optional(),
});

/**
 * Session Statistics Schema - for session analytics
 */
export const SessionStatisticsSchema = z.object({
  totalSessions: z.number().int().min(0),
  activeSessions: z.number().int().min(0),
  expiredSessions: z.number().int().min(0),
  uniqueUsers: z.number().int().min(0),
  averageSessionDuration: z.number().min(0).nullable(), // in minutes
  topDevices: z.array(z.object({
    deviceInfo: z.string(),
    count: z.number().int().min(0),
  })).default([]),
  topIpAddresses: z.array(z.object({
    ipAddress: z.string(),
    count: z.number().int().min(0),
  })).default([]),
  sessionsByDay: z.array(z.object({
    date: z.date(),
    count: z.number().int().min(0),
  })).default([]),
});

/**
 * Session Activity Schema - for tracking session events
 */
export const SessionActivitySchema = z.object({
  sessionId: z.string().uuid('Session ID must be a valid UUID'),
  activity: z.enum(['login', 'logout', 'refresh', 'expire', 'revoke']),
  timestamp: z.date().default(() => new Date()),
  ipAddress: z.string().ip().nullable(),
  userAgent: z.string().max(1000).nullable(),
  details: z.record(z.any()).optional(), // Additional activity metadata
});

/**
 * User Session with User Schema - includes related user information
 */
export const UserSessionWithUserSchema = UserSessionEntitySchema.extend({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    username: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    role: z.enum(['ADMIN', 'USER', 'MODERATOR']),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']),
  }),
});

/**
 * TypeScript types derived from Zod schemas
 */
export type UserSessionEntity = z.infer<typeof UserSessionEntitySchema>;
export type CreateUserSessionEntity = z.infer<typeof CreateUserSessionEntitySchema>;
export type UpdateUserSessionEntity = z.infer<typeof UpdateUserSessionEntitySchema>;
export type UserSessionEntityQuery = z.infer<typeof UserSessionEntityQuerySchema>;
export type SessionStatistics = z.infer<typeof SessionStatisticsSchema>;
export type SessionActivity = z.infer<typeof SessionActivitySchema>;
export type UserSessionWithUser = z.infer<typeof UserSessionWithUserSchema>;

/**
 * Validation helpers for runtime type checking
 */
export const validateUserSessionEntity = (data: unknown): UserSessionEntity => {
  return UserSessionEntitySchema.parse(data);
};

export const validateCreateUserSessionEntity = (data: unknown): CreateUserSessionEntity => {
  return CreateUserSessionEntitySchema.parse(data);
};

export const validateUpdateUserSessionEntity = (data: unknown): UpdateUserSessionEntity => {
  return UpdateUserSessionEntitySchema.parse(data);
};

export const validateUserSessionEntityQuery = (data: unknown): UserSessionEntityQuery => {
  return UserSessionEntityQuerySchema.parse(data);
};

export const validateSessionStatistics = (data: unknown): SessionStatistics => {
  return SessionStatisticsSchema.parse(data);
};

export const validateSessionActivity = (data: unknown): SessionActivity => {
  return SessionActivitySchema.parse(data);
};

export const validateUserSessionWithUser = (data: unknown): UserSessionWithUser => {
  return UserSessionWithUserSchema.parse(data);
};