/**
 * State Management Entry Point
 *
 * This module provides a complete state management solution following the Dependency Inversion Principle.
 * It clearly separates client state (Zustand) from server state (TanStack Query) management.
 *
 * Architecture:
 * - Client State: Zustand for UI, authentication, and application state
 * - Server State: TanStack Query for API data caching and synchronization
 * - Type Safety: Leverages @cc-task-manager/types for consistent type definitions
 * - Persistence: Selective state persistence with localStorage integration
 */

// Client State Management (Zustand)
export {
  useClientStore,
  useUIStore,
  useAuthStore,
  useTaskStore,
  useProcessStore,
  useUIActions,
  useAuthActions,
  useTaskActions,
  useProcessActions,
} from './client-store';

// Server State Management (TanStack Query)
export {
  // Query hooks
  useTasks,
  useProcesses,
  useWorkers,
  useAvailableContracts,
  useGenerateClientTypes,

  // Mutation hooks
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useCreateProcess,
  useCreateWorker,
  useLogin,
  useLogout,
  useRefreshToken,

  // Real-time integration
  useInvalidateOnTaskUpdate,

  // Query key factory
  queryKeys,
} from '../lib/api/hooks';

// Provider Components
export { ReactQueryProvider } from '../lib/api/providers';

// State Interfaces (following DIP)
export type {
  IMainStore,
  IUIState,
  IAuthState,
  ITaskState,
  IProcessState,
  IUIActions,
  IAuthActions,
  ITaskActions,
  IProcessActions,
  IStoreActions,
  User,
  UserPreferences,
  Notification,
  NotificationAction,
  TaskFilters,
  SystemMetrics,
} from './interfaces';

// Server State Configuration
export {
  cacheStrategies,
  taskCacheConfig,
  createTaskQueryOptions,
  createProcessQueryOptions,
  createWorkerQueryOptions,
  createTaskMutationOptions,
  createProcessMutationOptions,
  invalidationStrategies,
  backgroundSyncConfig,
  isCacheStrategy,
  isTaskState,
} from './server-state-config';

// Server State Configuration Types
export type {
  ICacheConfiguration,
} from './server-state-config';

// Re-export package types for convenience
export type {
  TaskState,
  TaskStatus,
  ProcessConfig,
  WorkerConfig,
  ClaudeCodeOptions,
} from '@cc-task-manager/types';