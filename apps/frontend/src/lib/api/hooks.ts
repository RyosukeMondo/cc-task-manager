'use client'

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions
} from '@tanstack/react-query'
import { apiClient } from './contract-client'
import type {
  ProcessConfig,
  TaskExecutionRequest,
  WorkerConfig,
  TaskStatus
} from '@cc-task-manager/types'

// Query Keys Factory - following TanStack Query best practices
export const queryKeys = {
  tasks: ['tasks'] as const,
  task: (id: string) => ['tasks', id] as const,
  processes: ['processes'] as const,
  process: (id: string) => ['processes', id] as const,
  workers: ['workers'] as const,
  worker: (id: string) => ['workers', id] as const,
  auth: ['auth'] as const,
  contracts: ['contracts'] as const,
} as const

// Task Management Hooks
export function useTasks(options?: UseQueryOptions<TaskStatus[]>) {
  return useQuery({
    queryKey: queryKeys.tasks,
    queryFn: () => apiClient.getTasks(),
    ...options,
  })
}

export function useCreateTask(
  options?: UseMutationOptions<TaskStatus, Error, TaskExecutionRequest>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (task: TaskExecutionRequest) => apiClient.createTask(task),
    onSuccess: (newTask) => {
      // Optimistically update the tasks list
      queryClient.setQueryData<TaskStatus[]>(queryKeys.tasks, (old) => {
        return old ? [...old, newTask] : [newTask]
      })
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks })
    },
    ...options,
  })
}

export function useUpdateTask(
  options?: UseMutationOptions<TaskStatus, Error, { taskId: string; updates: Partial<TaskStatus> }>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: Partial<TaskStatus> }) =>
      apiClient.updateTask(taskId, updates),
    onSuccess: (updatedTask, { taskId }) => {
      // Update the specific task in cache
      queryClient.setQueryData<TaskStatus[]>(queryKeys.tasks, (old) => {
        return old?.map(task =>
          task.id === taskId ? { ...task, ...updatedTask } : task
        ) || []
      })
      // Update individual task cache if it exists
      queryClient.setQueryData(queryKeys.task(taskId), updatedTask)
    },
    ...options,
  })
}

export function useDeleteTask(
  options?: UseMutationOptions<void, Error, string>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: string) => apiClient.deleteTask(taskId),
    onSuccess: (_, taskId) => {
      // Remove task from tasks list
      queryClient.setQueryData<TaskStatus[]>(queryKeys.tasks, (old) => {
        return old?.filter(task => task.id !== taskId) || []
      })
      // Remove individual task cache
      queryClient.removeQueries({ queryKey: queryKeys.task(taskId) })
    },
    ...options,
  })
}

// Process Management Hooks
export function useProcesses(options?: UseQueryOptions<ProcessConfig[]>) {
  return useQuery({
    queryKey: queryKeys.processes,
    queryFn: () => apiClient.getProcesses(),
    ...options,
  })
}

export function useCreateProcess(
  options?: UseMutationOptions<ProcessConfig, Error, ProcessConfig>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (config: ProcessConfig) => apiClient.createProcess(config),
    onSuccess: (newProcess) => {
      queryClient.setQueryData<ProcessConfig[]>(queryKeys.processes, (old) => {
        return old ? [...old, newProcess] : [newProcess]
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.processes })
    },
    ...options,
  })
}

// Worker Management Hooks
export function useWorkers(options?: UseQueryOptions<WorkerConfig[]>) {
  return useQuery({
    queryKey: queryKeys.workers,
    queryFn: () => apiClient.getWorkers(),
    ...options,
  })
}

export function useCreateWorker(
  options?: UseMutationOptions<WorkerConfig, Error, WorkerConfig>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (config: WorkerConfig) => apiClient.createWorker(config),
    onSuccess: (newWorker) => {
      queryClient.setQueryData<WorkerConfig[]>(queryKeys.workers, (old) => {
        return old ? [...old, newWorker] : [newWorker]
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.workers })
    },
    ...options,
  })
}

// Authentication Hooks
export function useLogin(
  options?: UseMutationOptions<
    { token: string; user: { id: string; username: string; role: string } },
    Error,
    { username: string; password: string }
  >
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (credentials: { username: string; password: string }) =>
      apiClient.login(credentials),
    onSuccess: (response) => {
      // Store auth token
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', response.token)
      }
      // Cache user data
      queryClient.setQueryData(queryKeys.auth, response.user)
    },
    ...options,
  })
}

export function useLogout(
  options?: UseMutationOptions<void, Error, void>
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => apiClient.logout(),
    onSuccess: () => {
      // Clear auth token
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token')
      }
      // Clear all cached data
      queryClient.clear()
    },
    ...options,
  })
}

export function useRefreshToken(
  options?: UseMutationOptions<{ token: string }, Error, void>
) {
  return useMutation({
    mutationFn: () => apiClient.refreshToken(),
    onSuccess: (response) => {
      // Update stored token
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', response.token)
      }
    },
    ...options,
  })
}

// Contract Discovery Hooks
export function useAvailableContracts(options?: UseQueryOptions<string[]>) {
  return useQuery({
    queryKey: queryKeys.contracts,
    queryFn: () => apiClient.getAvailableContracts(),
    ...options,
  })
}

export function useGenerateClientTypes(
  contractName: string,
  version: string,
  options?: UseQueryOptions<string | null>
) {
  return useQuery({
    queryKey: ['contracts', 'types', contractName, version],
    queryFn: () => apiClient.generateClientTypes(contractName, version),
    enabled: !!contractName && !!version,
    ...options,
  })
}

// Real-time integration utilities for WebSocket events
export function useInvalidateOnTaskUpdate() {
  const queryClient = useQueryClient()

  return {
    onTaskCreated: (task: TaskStatus) => {
      queryClient.setQueryData<TaskStatus[]>(queryKeys.tasks, (old) => {
        return old ? [...old, task] : [task]
      })
    },
    onTaskUpdated: (task: TaskStatus) => {
      queryClient.setQueryData<TaskStatus[]>(queryKeys.tasks, (old) => {
        return old?.map(t => t.id === task.id ? task : t) || []
      })
      queryClient.setQueryData(queryKeys.task(task.id), task)
    },
    onTaskDeleted: (taskId: string) => {
      queryClient.setQueryData<TaskStatus[]>(queryKeys.tasks, (old) => {
        return old?.filter(t => t.id !== taskId) || []
      })
      queryClient.removeQueries({ queryKey: queryKeys.task(taskId) })
    },
  }
}