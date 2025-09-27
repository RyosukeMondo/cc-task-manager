/**
 * Backend Schemas Index
 * 
 * Exports all backend-specific schemas and the schema registry service
 * for use throughout the backend application. These schemas extend the
 * existing ContractRegistry infrastructure to maintain SSOT principle.
 */

// Export all authentication schemas and types
export * from './auth.schemas';

// Export all task management schemas and types
export * from './task.schemas';

// Export all user management schemas and types
export * from './user.schemas';

// Export the schema registry service
export * from './schema-registry';

/**
 * Schema version information
 */
export const BACKEND_SCHEMA_VERSION = '1.0.0';

/**
 * Schema categories for organization
 */
export enum SchemaCategory {
  AUTH = 'auth',
  TASK = 'task',
  USER = 'user',
}

/**
 * Schema metadata for documentation and tooling
 */
export const SCHEMA_METADATA = {
  version: BACKEND_SCHEMA_VERSION,
  description: 'Backend-specific schemas extending the ContractRegistry infrastructure',
  categories: {
    [SchemaCategory.AUTH]: 'Authentication and authorization schemas',
    [SchemaCategory.TASK]: 'Task management and workflow schemas',
    [SchemaCategory.USER]: 'User management and profile schemas',
  },
  contractRegistry: {
    description: 'Integrates with existing ContractRegistry for SSOT validation',
    apiGeneration: 'Supports ApiContractGenerator for OpenAPI documentation',
    versioning: 'Uses existing VersionManager for contract versioning',
  },
};