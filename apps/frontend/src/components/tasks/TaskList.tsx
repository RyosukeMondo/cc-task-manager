'use client'

import * as React from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTasks, useUpdateTask, useDeleteTask } from '@/hooks/useTasks'
import { TaskItem } from './TaskItem'
import { Task, TaskStatus, TaskPriority, type TaskFilter } from '@/types/task'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

export type SortField = 'createdAt' | 'updatedAt' | 'priority' | 'title'
export type SortOrder = 'asc' | 'desc'

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
 * - Filter controls with URL synchronization
 * - Sorting by multiple criteria (date, priority, title)
 *
 * Requirements: 1.1, 1.2, 1.3, 3.1, 3.2, 3.3
 */
export const TaskList = React.memo<TaskListProps>(({
  initialFilters,
  onTaskEdit,
  className,
}) => {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize filters from URL params or initial filters
  const [localFilters, setLocalFilters] = React.useState<TaskFilter>(() => {
    const status = searchParams.get('status') as TaskStatus | null
    const priority = searchParams.get('priority') as TaskPriority | null
    const search = searchParams.get('search')

    return {
      status: status ? [status] : initialFilters?.status,
      priority: priority ? [priority] : initialFilters?.priority,
      search: search || initialFilters?.search,
    }
  })

  // Initialize sort state from URL params or defaults
  const [sortField, setSortField] = React.useState<SortField>(() => {
    const sortBy = searchParams.get('sortBy') as SortField | null
    return sortBy && ['createdAt', 'updatedAt', 'priority', 'title'].includes(sortBy)
      ? sortBy
      : 'createdAt'
  })

  const [sortOrder, setSortOrder] = React.useState<SortOrder>(() => {
    const order = searchParams.get('sortOrder') as SortOrder | null
    return order === 'asc' || order === 'desc' ? order : 'desc'
  })

  const { tasks, isLoading, isError, error, filters, setFilters } = useTasks(localFilters)
  const updateTaskMutation = useUpdateTask()
  const deleteTaskMutation = useDeleteTask()

  // Sync filters and sort with URL
  const updateUrlParams = React.useCallback((newFilters: TaskFilter, newSortField?: SortField, newSortOrder?: SortOrder) => {
    const params = new URLSearchParams()

    if (newFilters.status && newFilters.status.length > 0) {
      params.set('status', newFilters.status[0])
    }
    if (newFilters.priority && newFilters.priority.length > 0) {
      params.set('priority', newFilters.priority[0])
    }
    if (newFilters.search) {
      params.set('search', newFilters.search)
    }

    // Add sort parameters
    const currentSortField = newSortField ?? sortField
    const currentSortOrder = newSortOrder ?? sortOrder
    params.set('sortBy', currentSortField)
    params.set('sortOrder', currentSortOrder)

    const queryString = params.toString()
    const url = queryString ? `?${queryString}` : window.location.pathname
    router.push(url, { scroll: false })
  }, [router, sortField, sortOrder])

  // Handle filter changes
  const handleFilterChange = React.useCallback((key: keyof TaskFilter, value: any) => {
    const newFilters = { ...localFilters }

    if (key === 'status' || key === 'priority') {
      newFilters[key] = value ? [value] : undefined
    } else if (key === 'search') {
      newFilters[key] = value || undefined
    }

    setLocalFilters(newFilters)
    setFilters(newFilters)
    updateUrlParams(newFilters)
  }, [localFilters, setFilters, updateUrlParams])

  // Clear all filters
  const handleClearFilters = React.useCallback(() => {
    const emptyFilters: TaskFilter = {}
    setLocalFilters(emptyFilters)
    setFilters(emptyFilters)
    router.push(window.location.pathname, { scroll: false })
  }, [setFilters, router])

  // Check if any filters are active
  const hasActiveFilters = React.useMemo(() => {
    return !!(localFilters.status?.length || localFilters.priority?.length || localFilters.search)
  }, [localFilters])

  // Handle sort changes
  const handleSortChange = React.useCallback((field: SortField) => {
    const newOrder = field === sortField && sortOrder === 'desc' ? 'asc' : 'desc'
    setSortField(field)
    setSortOrder(newOrder)
    updateUrlParams(localFilters, field, newOrder)
  }, [sortField, sortOrder, localFilters, updateUrlParams])

  // Sort tasks based on current sort field and order
  const sortedTasks = React.useMemo(() => {
    if (!tasks || tasks.length === 0) return tasks

    const sorted = [...tasks].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'priority': {
          const priorityOrder = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
          break
        }
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          break
        default:
          comparison = 0
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [tasks, sortField, sortOrder])

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

  // Get sort icon based on current sort state
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1" />
    }
    return sortOrder === 'asc'
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />
  }

  // Filter controls component
  const FilterControls = () => (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-end gap-4 flex-wrap">
            {/* Search input */}
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search-input" className="text-sm font-medium">
                Search
              </Label>
              <Input
                id="search-input"
                type="text"
                placeholder="Search tasks by title or description..."
                value={localFilters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="mt-1.5"
                aria-label="Search tasks"
              />
            </div>

            {/* Status filter */}
            <div className="w-[180px]">
              <Label htmlFor="status-filter" className="text-sm font-medium">
                Status
              </Label>
              <Select
                value={localFilters.status?.[0] || 'all'}
                onValueChange={(value) => handleFilterChange('status', value === 'all' ? null : value)}
              >
                <SelectTrigger id="status-filter" className="mt-1.5" aria-label="Filter by status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value={TaskStatus.PENDING}>Pending</SelectItem>
                  <SelectItem value={TaskStatus.RUNNING}>Running</SelectItem>
                  <SelectItem value={TaskStatus.COMPLETED}>Completed</SelectItem>
                  <SelectItem value={TaskStatus.FAILED}>Failed</SelectItem>
                  <SelectItem value={TaskStatus.CANCELLED}>Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Priority filter */}
            <div className="w-[180px]">
              <Label htmlFor="priority-filter" className="text-sm font-medium">
                Priority
              </Label>
              <Select
                value={localFilters.priority?.[0] || 'all'}
                onValueChange={(value) => handleFilterChange('priority', value === 'all' ? null : value)}
              >
                <SelectTrigger id="priority-filter" className="mt-1.5" aria-label="Filter by priority">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value={TaskPriority.LOW}>Low</SelectItem>
                  <SelectItem value={TaskPriority.MEDIUM}>Medium</SelectItem>
                  <SelectItem value={TaskPriority.HIGH}>High</SelectItem>
                  <SelectItem value={TaskPriority.URGENT}>Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear filters button */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="mb-0.5"
                aria-label="Clear all filters"
              >
                Clear Filters
              </Button>
            )}
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium">Sort by:</Label>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={sortField === 'createdAt' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('createdAt')}
                className="flex items-center"
                aria-label={`Sort by created date ${sortField === 'createdAt' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : ''}`}
              >
                Created Date
                {getSortIcon('createdAt')}
              </Button>
              <Button
                variant={sortField === 'updatedAt' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('updatedAt')}
                className="flex items-center"
                aria-label={`Sort by updated date ${sortField === 'updatedAt' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : ''}`}
              >
                Updated Date
                {getSortIcon('updatedAt')}
              </Button>
              <Button
                variant={sortField === 'priority' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('priority')}
                className="flex items-center"
                aria-label={`Sort by priority ${sortField === 'priority' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : ''}`}
              >
                Priority
                {getSortIcon('priority')}
              </Button>
              <Button
                variant={sortField === 'title' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('title')}
                className="flex items-center"
                aria-label={`Sort by title ${sortField === 'title' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : ''}`}
              >
                Title
                {getSortIcon('title')}
              </Button>
            </div>
          </div>

          {/* Active filter indicators */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Active filters:</span>
              {localFilters.status?.[0] && (
                <span className="px-2 py-0.5 bg-secondary rounded-md">
                  Status: {localFilters.status[0]}
                </span>
              )}
              {localFilters.priority?.[0] && (
                <span className="px-2 py-0.5 bg-secondary rounded-md">
                  Priority: {localFilters.priority[0]}
                </span>
              )}
              {localFilters.search && (
                <span className="px-2 py-0.5 bg-secondary rounded-md">
                  Search: &quot;{localFilters.search}&quot;
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )

  // Loading state
  if (isLoading) {
    return (
      <div className={className}>
        <FilterControls />
        <div
          className="space-y-4"
          role="status"
          aria-label="Loading tasks"
        >
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
              </CardContent>
            </Card>
          ))}
          <span className="sr-only">Loading tasks...</span>
        </div>
      </div>
    )
  }

  // Error state with better UX
  if (isError) {
    const isNetworkError = error instanceof Error &&
      (error.message.includes('connect') ||
       error.message.includes('Network') ||
       error.message.includes('Failed to fetch'));

    return (
      <div className={className}>
        <FilterControls />
        <Alert
          className={isNetworkError ? "border-amber-200 bg-amber-50" : "border-destructive"}
          role="alert"
          aria-live="assertive"
        >
          <div className={`font-semibold ${isNetworkError ? "text-amber-900" : ""}`}>
            {isNetworkError ? 'Unable to connect to server' : 'Failed to load tasks'}
          </div>
          <div className={`text-sm mt-1 ${isNetworkError ? "text-amber-700" : "text-muted-foreground"}`}>
            {isNetworkError
              ? 'The task list is currently unavailable. Please check your connection or try again later.'
              : (error instanceof Error ? error.message : 'An unexpected error occurred')
            }
          </div>
        </Alert>
      </div>
    )
  }

  // Empty state
  if (!tasks || tasks.length === 0) {
    return (
      <div className={className}>
        <FilterControls />
        <Card className="border-dashed" role="status">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-5xl mb-4" aria-hidden="true">
              📋
            </div>
            <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {hasActiveFilters ?
                'Try adjusting your filters to see more tasks.' :
                'Get started by creating your first task.'
              }
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Task list
  return (
    <div className={className}>
      <FilterControls />
      <div
        className="space-y-4"
        role="feed"
        aria-label="Task list"
        aria-busy={updateTaskMutation.isPending || deleteTaskMutation.isPending}
      >
        {sortedTasks?.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onStatusChange={handleStatusChange}
            onEdit={onTaskEdit}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  )
})

TaskList.displayName = 'TaskList'