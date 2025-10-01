'use client'

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api/contract-client'
import { useWebSocketEvent } from '@/lib/websocket/hooks'
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
 */
export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (task: TaskCreate) => apiClient.createTask(task as any),
    onMutate: async (newTask) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.lists() })

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData(taskQueryKeys.lists())

      // Optimistically add task to all task list queries with temp ID and PENDING status
      const optimisticTask: Task = {
        id: `temp-${Date.now()}`,
        title: newTask.title,
        description: newTask.description || '',
        status: 'PENDING' as TaskStatus,
        priority: newTask.priority || 'MEDIUM',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Update all task list queries
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.lists() },
        (old: Task[] | undefined) => {
          return old ? [...old, optimisticTask] : [optimisticTask]
        }
      )

      // Return context with previous data for rollback
      return { previousTasks }
    },
    onError: (err, newTask, context) => {
      // Rollback to previous state on error
      if (context?.previousTasks) {
        queryClient.setQueriesData({ queryKey: taskQueryKeys.lists() }, context.previousTasks)
      }
    },
    onSuccess: (newTask) => {
      // Replace optimistic task with real task from server
      queryClient.setQueriesData(
        { queryKey: taskQueryKeys.lists() },
        (old: Task[] | undefined) => {
          return old?.map(task =>
            task.id.startsWith('temp-') ? (newTask as unknown as Task) : task
          ) || []
        }
      )
      // Invalidate queries to ensure consistency
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
 */
export function useTask(
  taskId: string,
  options?: Omit<UseQueryOptions<Task>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: taskQueryKeys.detail(taskId),
    queryFn: async () => {
      // Since the API doesn't have a single task endpoint,
      // we'll get all tasks and filter
      const tasks = await apiClient.getTasks()
      const task = (tasks as unknown as Task[]).find(t => t.id === taskId)
      if (!task) throw new Error(`Task ${taskId} not found`)
      return task
    },
    ...options,
  })
}