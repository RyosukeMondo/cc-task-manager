/**
 * Server State Configuration
 *
 * Centralized configuration for TanStack Query caching strategies,
 * following best practices for server state management with type safety
 * from @cc-task-manager/types.
 *
 * This configuration implements the Dependency Inversion Principle by
 * defining abstract caching policies that can be customized per data type.
 */

import type { UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import type {
  TaskStatus,
  ProcessConfig,
  WorkerConfig,
} from '@cc-task-manager/types';
import { TaskState } from '@cc-task-manager/types';

/**
 * Cache configuration interface following DIP
 */
export interface ICacheConfiguration<TData = unknown> {
  staleTime: number;
  cacheTime: number;
  refetchInterval?: number;
  retryCount: number;
  enabled: boolean;
}

/**
 * Predefined cache strategies for different data types
 */
export const cacheStrategies = {
  // Real-time data - frequently changing task statuses
  realtime: {
    staleTime: 30 * 1000, // 30 seconds
    cacheTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 30 * 1000, // Poll every 30 seconds
    retryCount: 3,
    enabled: true,
  } as ICacheConfiguration,

  // Semi-static data - process configurations
  semiStatic: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retryCount: 2,
    enabled: true,
  } as ICacheConfiguration,

  // Static data - user preferences, contracts
  static: {
    staleTime: 15 * 60 * 1000, // 15 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    retryCount: 1,
    enabled: true,
  } as ICacheConfiguration,

  // Background data - system metrics, analytics
  background: {
    staleTime: 60 * 1000, // 1 minute
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Poll every minute
    retryCount: 2,
    enabled: true,
  } as ICacheConfiguration,
} as const;

/**
 * Type-specific cache configurations using TaskState enum and package types
 */
export const taskCacheConfig = {
  // Active tasks require real-time updates
  [TaskState.PENDING]: cacheStrategies.realtime,
  [TaskState.RUNNING]: cacheStrategies.realtime,
  [TaskState.ACTIVE]: cacheStrategies.realtime,
  [TaskState.IDLE]: cacheStrategies.semiStatic,
  [TaskState.COMPLETED]: cacheStrategies.static,
  [TaskState.FAILED]: cacheStrategies.semiStatic,
  [TaskState.CANCELLED]: cacheStrategies.static,
} as const;

/**
 * Query option factories with proper type integration
 */
export const createTaskQueryOptions = (
  taskState?: TaskState
): Partial<UseQueryOptions<TaskStatus[]>> => {
  const config = taskState ? taskCacheConfig[taskState] : cacheStrategies.realtime;

  return {
    staleTime: config.staleTime,
    gcTime: config.cacheTime, // Updated property name for TanStack Query v5
    refetchInterval: config.refetchInterval,
    retry: config.retryCount,
    enabled: config.enabled,
    // Optimistic updates for task status changes
    placeholderData: (previousData) => previousData,
    // Custom error handling for task-specific scenarios
    throwOnError: (error: any) => {
      // Don't throw on expected task state transitions
      return !error?.message?.includes('task_state_transition');
    },
  };
};

export const createProcessQueryOptions = (): Partial<UseQueryOptions<ProcessConfig[]>> => ({
  ...cacheStrategies.semiStatic,
  gcTime: cacheStrategies.semiStatic.cacheTime,
  // Process configs change less frequently
  placeholderData: (previousData) => previousData,
  // Keep previous data during background updates
  notifyOnChangeProps: ['data', 'error', 'isLoading'],
});

export const createWorkerQueryOptions = (): Partial<UseQueryOptions<WorkerConfig[]>> => ({
  ...cacheStrategies.background,
  gcTime: cacheStrategies.background.cacheTime,
  // Worker status requires background monitoring
  placeholderData: (previousData) => previousData,
  // Network mode for offline resilience
  networkMode: 'offlineFirst',
});

/**
 * Mutation option factories with optimistic updates
 */
export const createTaskMutationOptions = <TVariables = unknown>(): Partial<
  UseMutationOptions<TaskStatus, Error, TVariables>
> => ({
  // Retry failed mutations once
  retry: 1,
  retryDelay: 2000,
  // Network mode for offline support
  networkMode: 'offlineFirst',
  // Global error handling
  onError: (error, variables, context) => {
    console.error('Task mutation failed:', {
      error: error.message,
      variables,
      context,
    });
  },
});

export const createProcessMutationOptions = <TVariables = unknown>(): Partial<
  UseMutationOptions<ProcessConfig, Error, TVariables>
> => ({
  retry: 2, // Process operations can be retried more aggressively
  retryDelay: 1000,
  networkMode: 'offlineFirst',
  onError: (error, variables, context) => {
    console.error('Process mutation failed:', {
      error: error.message,
      variables,
      context,
    });
  },
});

/**
 * Cache invalidation strategies
 */
export const invalidationStrategies = {
  // Invalidate all task-related queries
  tasks: {
    queryKey: ['tasks'],
    exact: false,
  },
  // Invalidate specific task
  task: (taskId: string) => ({
    queryKey: ['tasks', taskId],
    exact: true,
  }),
  // Invalidate process data
  processes: {
    queryKey: ['processes'],
    exact: false,
  },
  // Invalidate worker data
  workers: {
    queryKey: ['workers'],
    exact: false,
  },
  // Invalidate all data (for logout)
  all: {
    queryKey: [],
    exact: false,
  },
} as const;

/**
 * Background sync configuration for offline support
 */
export const backgroundSyncConfig = {
  // Sync interval when online
  onlineInterval: 30 * 1000, // 30 seconds
  // Sync interval when offline (reduced frequency)
  offlineInterval: 5 * 60 * 1000, // 5 minutes
  // Maximum age of cached data before requiring sync
  maxCacheAge: 15 * 60 * 1000, // 15 minutes
  // Queries to sync in background
  syncQueries: ['tasks', 'processes', 'workers'] as const,
} as const;

/**
 * Type guards for cache strategy validation
 */
export const isCacheStrategy = (strategy: unknown): strategy is keyof typeof cacheStrategies => {
  return typeof strategy === 'string' && strategy in cacheStrategies;
};

export const isTaskState = (state: unknown): state is TaskState => {
  return typeof state === 'string' && Object.values(TaskState).includes(state as TaskState);
};