'use client'

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api/contract-client'
import { useWebSocketEvent } from '@/lib/websocket/hooks'
import { useToast } from '@/hooks/use-toast'
import type { Task, TaskFilter, TaskCreate, TaskUpdate, TaskStatus } from '@/types/task'

/**
 * Query key factory for task-related queries
 */
export const taskQueryKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskQueryKeys.all, 'list'] as const,
  list: (filters?: TaskFilter) => [...taskQueryKeys.lists(), filters] as const,
  detail: (id: string) => [...taskQueryKeys.all, 'detail', id] as const,
}

/**
 * Custom hook for fetching and managing task lists with filtering
 * Supports real-time updates via WebSocket integration
 *
 * @param filters - Optional filters to apply to the task list
 * @param options - TanStack Query options for customization
 *
 * Requirements: 1.1, 1.2, 3.1
 */
export function useTasks(
  filters?: TaskFilter,
  options?: Omit<UseQueryOptions<Task[]>, 'queryKey' | 'queryFn'>
) {
  const queryClient = useQueryClient()
  const [localFilters, setLocalFilters] = useState<TaskFilter | undefined>(filters)

  // Fetch tasks with filters
  const query = useQuery({
    queryKey: taskQueryKeys.list(localFilters),
    queryFn: async () => {
      const tasks = await apiClient.getTasks()

      // Apply client-side filtering if filters are provided
      if (!localFilters) return tasks as unknown as Task[]

      return (tasks as unknown as Task[]).filter(task => {
        // Filter by status
        if (localFilters.status && task.status !== localFilters.status) {
          return false
        }

        // Filter by priority
        if (localFilters.priority && task.priority !== localFilters.priority) {
          return false
        }

        // Filter by search term (title or description)
        if (localFilters.searchTerm) {
          const searchLower = localFilters.searchTerm.toLowerCase()
          const matchesTitle = task.title?.toLowerCase().includes(searchLower)
          const matchesDescription = task.description?.toLowerCase().includes(searchLower)
          if (!matchesTitle && !matchesDescription) {
            return false
          }
        }

        // Filter by date range
        if (localFilters.dateRange) {
          const taskDate = new Date(task.createdAt)
          if (localFilters.dateRange.start && taskDate < new Date(localFilters.dateRange.start)) {
            return false
          }
          if (localFilters.dateRange.end && taskDate > new Date(localFilters.dateRange.end)) {
            return false
          }
        }

        return true
      })
    },
    staleTime: 30000, // 30 seconds
    ...options,
  })

  // Real-time updates via WebSocket
  useWebSocketEvent(
    'task:created',
    useCallback((event: { data: Task }) => {
      queryClient.setQueryData<Task[]>(taskQueryKeys.list(localFilters), (old) => {
        return old ? [...old, event.data] : [event.data]
      })
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() })
    }, [queryClient, localFilters])
  )

  useWebSocketEvent(
    'task:updated',
    useCallback((event: { data: Task }) => {
      queryClient.setQueryData<Task[]>(taskQueryKeys.list(localFilters), (old) => {
        return old?.map(task => task.id === event.data.id ? event.data : task) || []
      })
      queryClient.setQueryData(taskQueryKeys.detail(event.data.id), event.data)
    }, [queryClient, localFilters])
  )

  useWebSocketEvent(
    'task:deleted',
    useCallback((event: { data: { taskId: string } }) => {
      queryClient.setQueryData<Task[]>(taskQueryKeys.list(localFilters), (old) => {
        return old?.filter(task => task.id !== event.data.taskId) || []
      })
      queryClient.removeQueries({ queryKey: taskQueryKeys.detail(event.data.taskId) })
    }, [queryClient, localFilters])
  )

  // Update filters
  const setFilters = useCallback((newFilters: TaskFilter | undefined) => {
    setLocalFilters(newFilters)
  }, [])

  // Sync external filter changes
  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  return {
    ...query,
    // Return empty array if API fails (graceful degradation)
    tasks: query.data || [],
    filters: localFilters,
    setFilters,
  }
}

/**
 * Hook for creating a new task with optimistic updates
 * Requirements: 3 (optimistic UI updates)
 */
export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (task: TaskCreate) => apiClient.createTask(task as any),
    onMutate: async (newTask: TaskCreate) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.lists() })

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>(taskQueryKeys.list())

      // Create optimistic task with temporary ID
      const optimisticTask: Task = {
        id: `temp-${Date.now()}`,
        title: newTask.title,
        description: newTask.description || '',
        status: 'PENDING' as TaskStatus,
        priority: newTask.priority || 'MEDIUM',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Optimistically update all task list queries
      queryClient.setQueriesData<Task[]>(
        { queryKey: taskQueryKeys.lists() },
        (old) => {
          return old ? [...old, optimisticTask] : [optimisticTask]
        }
      )

      // Return context with previous tasks for rollback
      return { previousTasks }
    },
    onError: (_err, _newTask, context) => {
      // Rollback to previous state on error
      if (context?.previousTasks) {
        queryClient.setQueriesData({ queryKey: taskQueryKeys.lists() }, context.previousTasks)
      }
    },
    onSuccess: (newTask) => {
      // Replace optimistic task with real task from server
      queryClient.setQueriesData<Task[]>(
        { queryKey: taskQueryKeys.lists() },
        (old) => {
          if (!old) return [newTask as unknown as Task]
          // Remove temp task and add real task
          return old
            .filter(task => !task.id.startsWith('temp-'))
            .concat(newTask as unknown as Task)
        }
      )
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() })
    },
  })
}

/**
 * Hook for updating an existing task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: TaskUpdate }) =>
      apiClient.updateTask(taskId, updates as any),
    onSuccess: (updatedTask, { taskId }) => {
      // Update specific task in all lists
      queryClient.setQueryData(taskQueryKeys.detail(taskId), updatedTask)
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() })
    },
  })
}

/**
 * Hook for deleting a task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (taskId: string) => apiClient.deleteTask(taskId),
    onSuccess: (_, taskId) => {
      // Remove from all lists
      queryClient.removeQueries({ queryKey: taskQueryKeys.detail(taskId) })
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.lists() })
    },
  })
}

/**
 * Hook for fetching a single task by ID
 * Includes 10-second polling for real-time updates and WebSocket subscriptions
 */
export function useTask(
  taskId: string,
  options?: Omit<UseQueryOptions<Task>, 'queryKey' | 'queryFn'>
) {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const query = useQuery({
    queryKey: taskQueryKeys.detail(taskId),
    queryFn: async () => {
      const task = await apiClient.getTaskById(taskId)
      return task as unknown as Task
    },
    refetchInterval: 10000, // 10s fallback polling for real-time updates
    ...options,
  })

  // WebSocket: Real-time task updates
  useWebSocketEvent(
    'task:updated',
    useCallback((event: any) => {
      const updatedTask = event.data

      // Only update if it's the task we're watching
      if (updatedTask?.id === taskId || updatedTask?.taskId === taskId) {
        // Get previous task state for comparison
        const previousTask = queryClient.getQueryData<Task>(taskQueryKeys.detail(taskId))

        // Update query cache with new task data
        queryClient.setQueryData(taskQueryKeys.detail(taskId), (old: Task | undefined) => {
          if (!old) return updatedTask
          return { ...old, ...updatedTask }
        })

        // Show animations on status changes
        if (previousTask && previousTask.status !== updatedTask.status) {
          // Show confetti animation for COMPLETED status
          if (updatedTask.status === 'COMPLETED') {
            // Trigger confetti effect if available
            if (typeof window !== 'undefined' && (window as any).confetti) {
              (window as any).confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
              })
            }
          }

          // Show toast notification for FAILED status
          if (updatedTask.status === 'FAILED') {
            toast({
              title: 'Task Failed',
              description: updatedTask.errorMessage || 'The task has failed.',
              variant: 'destructive',
            })
          }

          // Show toast notification for other status changes
          if (updatedTask.status === 'RUNNING') {
            toast({
              title: 'Task Started',
              description: 'The task is now running.',
            })
          }

          if (updatedTask.status === 'CANCELLED') {
            toast({
              title: 'Task Cancelled',
              description: 'The task has been cancelled.',
              variant: 'destructive',
            })
          }
        }
      }
    }, [taskId, queryClient, toast])
  )

  // WebSocket: Real-time log updates
  useWebSocketEvent(
    'task:log',
    useCallback((event: any) => {
      const { taskId: logTaskId, log } = event.data

      // Only update if it's the task we're watching
      if (logTaskId === taskId && log) {
        // Append new log entry to task.logs
        queryClient.setQueryData(taskQueryKeys.detail(taskId), (old: Task | undefined) => {
          if (!old) return old

          const logs = old.logs || []
          // Avoid duplicate logs
          const logExists = logs.some((l: any) =>
            l.timestamp === log.timestamp && l.message === log.message
          )

          if (logExists) return old

          return {
            ...old,
            logs: [...logs, log]
          }
        })
      }
    }, [taskId, queryClient])
  )

  return query
}
