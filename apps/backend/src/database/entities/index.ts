/**
 * Database Entity Schemas
 * 
 * Zod schemas that exactly mirror Prisma models for type-safe database operations
 * and contract-database synchronization. These schemas ensure SSOT between
 * database models and contract validation.
 */

export * from './user.entity';
export * from './task.entity';
export * from './project.entity';
export * from './user-session.entity';

/**
 * Database entity version for tracking schema evolution
 */
export const DATABASE_ENTITY_VERSION = '1.0.0';

/**
 * Entity metadata for contract registry integration
 */
export const ENTITY_METADATA = {
  version: DATABASE_ENTITY_VERSION,
  description: 'Database entity schemas mirroring Prisma models for SSOT synchronization',
  prismaCompatibility: 'Exactly mirrors Prisma schema.prisma models',
  contractIntegration: 'Registers with ContractRegistry for validation consistency',
};