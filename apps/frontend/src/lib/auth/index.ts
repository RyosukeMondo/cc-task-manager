/**
 * Authentication module exports
 * Provides centralized access to all authentication functionality
 */

// Types and schemas
export * from './types';

// Token storage utilities
export * from './token-storage';

// Permission utilities
export * from './permissions';

// Authentication context and provider
export * from './context';

// Role-based UI components
export * from './components';

// Authentication hooks
export * from './hooks';

// Default exports for convenience
export { AuthProvider, useAuth } from './context';
export { tokenStorage } from './token-storage';
export { createPermissionUtils } from './permissions';