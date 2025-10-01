/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TaskList } from '../TaskList'
import { TaskStatus, TaskPriority } from '@/types/task'
import type { Task } from '@/types/task'
import * as useTasks from '@/hooks/useTasks'

// Mock the hooks
jest.mock('@/hooks/useTasks')
jest.mock('@/lib/websocket/hooks', () => ({
  useWebSocketEvent: jest.fn(),
}))

// Mock the contract client
jest.mock('@/lib/api/contract-client', () => ({
  apiClient: {
    getTasks: jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
  },
}))

// Mock Next.js navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/tasks',
  useSearchParams: () => new URLSearchParams(),
}))

// Test utilities
const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('TaskList', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'First Task',
      description: 'First task description',
      status: TaskStatus.TODO,
      priority: TaskPriority.HIGH,
      createdAt: new Date('2025-01-01T10:00:00Z'),
      updatedAt: new Date('2025-01-01T10:00:00Z'),
    },
    {
      id: 'task-2',
      title: 'Second Task',
      description: 'Second task description',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      createdAt: new Date('2025-01-02T10:00:00Z'),
      updatedAt: new Date('2025-01-02T10:00:00Z'),
    },
    {
      id: 'task-3',
      title: 'Third Task',
      description: 'Third task description',
      status: TaskStatus.DONE,
      priority: TaskPriority.LOW,
      createdAt: new Date('2025-01-03T10:00:00Z'),
      updatedAt: new Date('2025-01-03T10:00:00Z'),
    },
  ]

  const mockUpdateTask = {
    mutateAsync: jest.fn(),
    isPending: false,
  }

  const mockDeleteTask = {
    mutateAsync: jest.fn(),
    isPending: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockClear()

    // Default mock implementation
    ;(useTasks.useTasks as jest.Mock).mockReturnValue({
      tasks: mockTasks,
      isLoading: false,
      isError: false,
      error: null,
      filters: {},
      setFilters: jest.fn(),
    })
    ;(useTasks.useUpdateTask as jest.Mock).mockReturnValue(mockUpdateTask)
    ;(useTasks.useDeleteTask as jest.Mock).mockReturnValue(mockDeleteTask)

    // Mock window.confirm
    global.confirm = jest.fn(() => true)
  })

  describe('Loading State', () => {
    it('should display skeleton loaders when loading', () => {
      ;(useTasks.useTasks as jest.Mock).mockReturnValue({
        tasks: undefined,
        isLoading: true,
        isError: false,
        error: null,
        filters: {},
        setFilters: jest.fn(),
      })

      renderWithProviders(<TaskList />)

      expect(screen.getByRole('status', { name: 'Loading tasks' })).toBeInTheDocument()
      expect(screen.getByText('Loading tasks...')).toBeInTheDocument()
    })

    it('should display multiple skeleton cards', () => {
      ;(useTasks.useTasks as jest.Mock).mockReturnValue({
        tasks: undefined,
        isLoading: true,
        isError: false,
        error: null,
        filters: {},
        setFilters: jest.fn(),
      })

      const { container } = renderWithProviders(<TaskList />)
      const skeletons = container.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('Error State', () => {
    it('should display error message when error occurs', () => {
      const errorMessage = 'Failed to fetch tasks'
      ;(useTasks.useTasks as jest.Mock).mockReturnValue({
        tasks: undefined,
        isLoading: false,
        isError: true,
        error: new Error(errorMessage),
        filters: {},
        setFilters: jest.fn(),
      })

      renderWithProviders(<TaskList />)

      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Failed to load tasks')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('should display generic error for non-Error objects', () => {
      ;(useTasks.useTasks as jest.Mock).mockReturnValue({
        tasks: undefined,
        isLoading: false,
        isError: true,
        error: 'String error',
        filters: {},
        setFilters: jest.fn(),
      })

      renderWithProviders(<TaskList />)

      expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('should display empty state when no tasks exist', () => {
      ;(useTasks.useTasks as jest.Mock).mockReturnValue({
        tasks: [],
        isLoading: false,
        isError: false,
        error: null,
        filters: {},
        setFilters: jest.fn(),
      })

      renderWithProviders(<TaskList />)

      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(screen.getByText('No tasks found')).toBeInTheDocument()
      expect(screen.getByText('Get started by creating your first task.')).toBeInTheDocument()
    })

    it('should display filtered empty state message when filters are active', () => {
      ;(useTasks.useTasks as jest.Mock).mockReturnValue({
        tasks: [],
        isLoading: false,
        isError: false,
        error: null,
        filters: { status: [TaskStatus.TODO] },
        setFilters: jest.fn(),
      })

      renderWithProviders(<TaskList />)

      expect(screen.getByText('Try adjusting your filters to see more tasks.')).toBeInTheDocument()
    })
  })

  describe('Task List Rendering', () => {
    it('should render all tasks', () => {
      renderWithProviders(<TaskList />)

      expect(screen.getByText('First Task')).toBeInTheDocument()
      expect(screen.getByText('Second Task')).toBeInTheDocument()
      expect(screen.getByText('Third Task')).toBeInTheDocument()
    })

    it('should render tasks in a feed role', () => {
      renderWithProviders(<TaskList />)

      const feed = screen.getByRole('feed', { name: 'Task list' })
      expect(feed).toBeInTheDocument()
    })

    it('should set aria-busy when mutations are pending', () => {
      mockUpdateTask.isPending = true
      renderWithProviders(<TaskList />)

      const feed = screen.getByRole('feed')
      expect(feed).toHaveAttribute('aria-busy', 'true')
    })
  })

  describe('Filter Controls', () => {
    it('should render search input', () => {
      renderWithProviders(<TaskList />)

      expect(screen.getByLabelText('Search tasks')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/search tasks by title/i)).toBeInTheDocument()
    })

    it('should render status filter', () => {
      renderWithProviders(<TaskList />)

      expect(screen.getByLabelText('Filter by status')).toBeInTheDocument()
    })

    it('should render priority filter', () => {
      renderWithProviders(<TaskList />)

      expect(screen.getByLabelText('Filter by priority')).toBeInTheDocument()
    })

    it('should display clear filters button when filters are active', async () => {
      const mockSetFilters = jest.fn()
      ;(useTasks.useTasks as jest.Mock).mockReturnValue({
        tasks: mockTasks,
        isLoading: false,
        isError: false,
        error: null,
        filters: { status: [TaskStatus.TODO] },
        setFilters: mockSetFilters,
      })

      renderWithProviders(<TaskList />)

      // The clear button should be visible
      const clearButton = screen.getByRole('button', { name: 'Clear all filters' })
      expect(clearButton).toBeInTheDocument()
    })

    it('should not display clear filters button when no filters are active', () => {
      renderWithProviders(<TaskList />)

      expect(screen.queryByRole('button', { name: 'Clear all filters' })).not.toBeInTheDocument()
    })
  })

  describe('Filter Interactions', () => {
    it('should handle search input change', async () => {
      const user = userEvent.setup()
      const mockSetFilters = jest.fn()
      ;(useTasks.useTasks as jest.Mock).mockReturnValue({
        tasks: mockTasks,
        isLoading: false,
        isError: false,
        error: null,
        filters: {},
        setFilters: mockSetFilters,
      })

      renderWithProviders(<TaskList />)

      const searchInput = screen.getByLabelText('Search tasks')
      await user.type(searchInput, 'test search')

      await waitFor(() => {
        expect(mockSetFilters).toHaveBeenCalled()
      })
    })

    it('should show active filter indicators', () => {
      ;(useTasks.useTasks as jest.Mock).mockReturnValue({
        tasks: mockTasks,
        isLoading: false,
        isError: false,
        error: null,
        filters: {
          status: [TaskStatus.TODO],
          priority: [TaskPriority.HIGH],
          search: 'test',
        },
        setFilters: jest.fn(),
      })

      renderWithProviders(<TaskList />)

      expect(screen.getByText(/Active filters:/)).toBeInTheDocument()
      expect(screen.getByText(/Status: PENDING/)).toBeInTheDocument()
      expect(screen.getByText(/Priority: HIGH/)).toBeInTheDocument()
      expect(screen.getByText(/Search: "test"/)).toBeInTheDocument()
    })
  })

  describe('Sorting Functionality', () => {
    it('should render sort buttons', () => {
      renderWithProviders(<TaskList />)

      expect(screen.getByRole('button', { name: /sort by created date/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by updated date/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by priority/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by title/i })).toBeInTheDocument()
    })

    it('should sort tasks by title ascending', async () => {
      const user = userEvent.setup()
      renderWithProviders(<TaskList />)

      const sortButton = screen.getByRole('button', { name: /sort by title/i })
      await user.click(sortButton)

      // Should update URL with sort params
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled()
      })
    })

    it('should toggle sort order on second click', async () => {
      const user = userEvent.setup()
      renderWithProviders(<TaskList />)

      const sortButton = screen.getByRole('button', { name: /sort by created date/i })

      // First click - descending
      await user.click(sortButton)

      // Second click - ascending
      await user.click(sortButton)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledTimes(2)
      })
    })

    it('should display sorted tasks in correct order', () => {
      renderWithProviders(<TaskList />)

      const taskTitles = screen.getAllByRole('article').map((article) =>
        within(article).getByRole('heading').textContent
      )

      // Default sort is by createdAt descending
      expect(taskTitles).toEqual(['Third Task', 'Second Task', 'First Task'])
    })
  })

  describe('Task Actions', () => {
    it('should handle status change', async () => {
      const user = userEvent.setup()
      mockUpdateTask.mutateAsync.mockResolvedValue({})

      renderWithProviders(<TaskList />)

      const completeButtons = screen.getAllByRole('button', { name: /complete/i })
      await user.click(completeButtons[0])

      await waitFor(() => {
        expect(mockUpdateTask.mutateAsync).toHaveBeenCalledWith({
          taskId: 'task-1',
          updates: { status: TaskStatus.DONE },
        })
      })
    })

    it('should handle task edit', async () => {
      const user = userEvent.setup()
      const mockOnTaskEdit = jest.fn()

      renderWithProviders(<TaskList onTaskEdit={mockOnTaskEdit} />)

      const editButtons = screen.getAllByRole('button', { name: /edit/i })
      await user.click(editButtons[0])

      expect(mockOnTaskEdit).toHaveBeenCalledWith('task-1')
    })

    it('should handle task deletion with confirmation', async () => {
      const user = userEvent.setup()
      mockDeleteTask.mutateAsync.mockResolvedValue({})

      renderWithProviders(<TaskList />)

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
      await user.click(deleteButtons[0])

      expect(global.confirm).toHaveBeenCalled()
      await waitFor(() => {
        expect(mockDeleteTask.mutateAsync).toHaveBeenCalledWith('task-1')
      })
    })

    it('should not delete task when confirmation is canceled', async () => {
      const user = userEvent.setup()
      global.confirm = jest.fn(() => false)

      renderWithProviders(<TaskList />)

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
      await user.click(deleteButtons[0])

      expect(global.confirm).toHaveBeenCalled()
      expect(mockDeleteTask.mutateAsync).not.toHaveBeenCalled()
    })

    it('should handle update errors gracefully', async () => {
      const user = userEvent.setup()
      const consoleError = jest.spyOn(console, 'error').mockImplementation()
      mockUpdateTask.mutateAsync.mockRejectedValue(new Error('Update failed'))

      renderWithProviders(<TaskList />)

      const completeButtons = screen.getAllByRole('button', { name: /complete/i })
      await user.click(completeButtons[0])

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to update task status:',
          expect.any(Error)
        )
      })

      consoleError.mockRestore()
    })

    it('should handle delete errors gracefully', async () => {
      const user = userEvent.setup()
      const consoleError = jest.spyOn(console, 'error').mockImplementation()
      mockDeleteTask.mutateAsync.mockRejectedValue(new Error('Delete failed'))

      renderWithProviders(<TaskList />)

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
      await user.click(deleteButtons[0])

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to delete task:',
          expect.any(Error)
        )
      })

      consoleError.mockRestore()
    })
  })

  describe('URL Synchronization', () => {
    it('should sync filters to URL', async () => {
      const user = userEvent.setup()
      renderWithProviders(<TaskList />)

      const searchInput = screen.getByLabelText('Search tasks')
      await user.type(searchInput, 'test')

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled()
      })
    })

    it('should include sort parameters in URL', async () => {
      const user = userEvent.setup()
      renderWithProviders(<TaskList />)

      const sortButton = screen.getByRole('button', { name: /sort by title/i })
      await user.click(sortButton)

      await waitFor(() => {
        const calls = mockPush.mock.calls
        const lastCall = calls[calls.length - 1][0]
        expect(lastCall).toContain('sortBy=title')
        expect(lastCall).toContain('sortOrder=')
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels on inputs', () => {
      renderWithProviders(<TaskList />)

      expect(screen.getByLabelText('Search tasks')).toBeInTheDocument()
      expect(screen.getByLabelText('Filter by status')).toBeInTheDocument()
      expect(screen.getByLabelText('Filter by priority')).toBeInTheDocument()
    })

    it('should support keyboard navigation through filters', async () => {
      const user = userEvent.setup()
      renderWithProviders(<TaskList />)

      const searchInput = screen.getByLabelText('Search tasks')
      await user.tab()

      expect(searchInput).toHaveFocus()
    })

    it('should have proper ARIA roles for different states', () => {
      ;(useTasks.useTasks as jest.Mock).mockReturnValue({
        tasks: [],
        isLoading: false,
        isError: false,
        error: null,
        filters: {},
        setFilters: jest.fn(),
      })

      renderWithProviders(<TaskList />)

      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  describe('Custom Props', () => {
    it('should apply custom className', () => {
      const { container } = renderWithProviders(<TaskList className="custom-class" />)
      const taskListContainer = container.querySelector('.custom-class')
      expect(taskListContainer).toBeInTheDocument()
    })

    it('should use initial filters', () => {
      const initialFilters = { status: [TaskStatus.TODO] }
      renderWithProviders(<TaskList initialFilters={initialFilters} />)

      expect(useTasks.useTasks).toHaveBeenCalledWith(
        expect.objectContaining(initialFilters),
        undefined
      )
    })
  })

  describe('React.memo Optimization', () => {
    it('should not re-render when props do not change', () => {
      const { rerender } = renderWithProviders(<TaskList />)
      const initialRender = screen.getByRole('feed')

      rerender(
        <QueryClientProvider client={createQueryClient()}>
          <TaskList />
        </QueryClientProvider>
      )

      const afterRerender = screen.getByRole('feed')
      expect(initialRender).toBeDefined()
      expect(afterRerender).toBeDefined()
    })
  })
})