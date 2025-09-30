'use client'

import * as React from 'react'
import { useTasks, useUpdateTask, useDeleteTask } from '@/hooks/useTasks'
import { TaskItem } from './TaskItem'
import { Task, TaskStatus, TaskPriority, type TaskFilter } from '@/types/task'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface TaskListProps {
  initialFilters?: TaskFilter
  onTaskEdit?: (taskId: string) => void
  className?: string
}

/**
 * TaskList - Container component for displaying and managing a list of tasks
 *
 * Features:
 * - Fetches tasks using useTasks hook with filtering support
 * - Renders TaskItem components for each task
 * - Handles loading, error, and empty states
 * - Manages task status updates and deletions
 * - Real-time updates via WebSocket integration
 * - Accessible with proper ARIA labels and keyboard navigation
 *
 * Requirements: 1.1, 1.2, 1.3, 3.1, 3.2
 */
export const TaskList = React.memo<TaskListProps>(({
  initialFilters,
  onTaskEdit,
  className,
}) => {
  const { tasks, isLoading, isError, error, filters, setFilters } = useTasks(initialFilters)
  const updateTaskMutation = useUpdateTask()
  const deleteTaskMutation = useDeleteTask()

  // Handle status change
  const handleStatusChange = React.useCallback(
    async (taskId: string, status: TaskStatus) => {
      try {
        await updateTaskMutation.mutateAsync({
          taskId,
          updates: { status },
        })
      } catch (error) {
        console.error('Failed to update task status:', error)
      }
    },
    [updateTaskMutation]
  )

  // Handle task deletion
  const handleDelete = React.useCallback(
    async (taskId: string) => {
      if (!window.confirm('Are you sure you want to delete this task?')) {
        return
      }

      try {
        await deleteTaskMutation.mutateAsync(taskId)
      } catch (error) {
        console.error('Failed to delete task:', error)
      }
    },
    [deleteTaskMutation]
  )

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn('space-y-4', className)}
        role="status"
        aria-label="Loading tasks"
      >
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-1/2" />
                <div className="h-4 bg-muted rounded w-1/4" />
              </div>
            </CardContent>
          </Card>
        ))}
        <span className="sr-only">Loading tasks...</span>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <Alert
        className={cn('border-destructive', className)}
        role="alert"
        aria-live="assertive"
      >
        <div className="font-semibold">Failed to load tasks</div>
        <div className="text-sm text-muted-foreground mt-1">
          {error instanceof Error ? error.message : 'An unexpected error occurred'}
        </div>
      </Alert>
    )
  }

  // Empty state
  if (!tasks || tasks.length === 0) {
    return (
      <Card className={cn('border-dashed', className)} role="status">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-5xl mb-4" aria-hidden="true">
            📋
          </div>
          <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {filters ?
              'Try adjusting your filters to see more tasks.' :
              'Get started by creating your first task.'
            }
          </p>
        </CardContent>
      </Card>
    )
  }

  // Task list
  return (
    <div
      className={cn('space-y-4', className)}
      role="feed"
      aria-label="Task list"
      aria-busy={updateTaskMutation.isPending || deleteTaskMutation.isPending}
    >
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onStatusChange={handleStatusChange}
          onEdit={onTaskEdit}
          onDelete={handleDelete}
        />
      ))}
    </div>
  )
})

TaskList.displayName = 'TaskList'