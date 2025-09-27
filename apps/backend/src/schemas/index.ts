/**
 * Backend schemas index - exports all backend-specific contract schemas
 * Provides centralized access to all backend schema definitions
 */

// Authentication schemas
export * from './auth.schemas';

// Task management schemas
export * from './task.schemas';

// User management schemas
export * from './user.schemas';

// Project management schemas
export * from './project.schemas';

// Schema registry service
export * from './schema-registry.service';