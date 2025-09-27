/**
 * Configuration Module Index
 * 
 * Exports all configuration schemas, services, and types for centralized
 * environment variable management with Zod validation following SSOT principle.
 */

export * from './config.schema';
export * from './config.service';
export * from './config.module';

/**
 * Configuration version for tracking schema evolution
 */
export const CONFIG_VERSION = '1.0.0';

/**
 * Configuration metadata
 */
export const CONFIG_METADATA = {
  version: CONFIG_VERSION,
  description: 'Centralized configuration management with Zod validation',
  validationStrategy: 'fail-fast',
  ssotCompliance: true,
  securityFeatures: [
    'No hardcoded secrets',
    'Environment-specific overrides',
    'Validation on startup',
    'Type-safe configuration access'
  ],
};