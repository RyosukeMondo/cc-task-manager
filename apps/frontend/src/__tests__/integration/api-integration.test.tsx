/**
 * @jest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { ReactNode } from 'react'
import { useTaskExecution, useTaskStatus, useSystemMetrics } from '../../lib/api/hooks'
import { validateTaskExecutionRequest, validateTaskStatus } from '@cc-task-manager/schemas'
import { TaskState } from '@cc-task-manager/schemas'
import type { TaskExecutionRequest, TaskStatus } from '@cc-task-manager/types'

// Mock fetch globally
global.fetch = jest.fn()

const mockFetch = fetch as jest.MockedFunction<typeof fetch>

// Test wrapper for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
  })

  describe('Task Execution API', () => {
    it('should execute task with contract validation', async () => {
      const taskRequest: TaskExecutionRequest = {
        task: 'console.log("Integration test")',
        options: {
          timeout: 15000,
          workingDirectory: '/tmp/test'
        }
      }

      const mockResponse: TaskStatus = {
        id: 'task-integration-123',
        state: TaskState.RUNNING,
        progress: 0,
        startTime: new Date(),
        lastActivity: new Date(),
        metadata: {
          correlationId: 'integration-test-corr',
          tags: ['integration', 'test']
        }
      }

      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers({ 'content-type': 'application/json' }),
      } as Response)

      const wrapper = createWrapper()
      const { result } = renderHook(() => useTaskExecution(), { wrapper })

      // Execute task
      const executeResult = await result.current.mutateAsync(taskRequest)

      // Verify request validation occurred
      expect(validateTaskExecutionRequest(taskRequest).success).toBe(true)

      // Verify API call
      expect(mockFetch).toHaveBeenCalledWith('/api/tasks/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': expect.any(String)
        },
        body: JSON.stringify(taskRequest)
      })

      // Verify response validation
      expect(validateTaskStatus(executeResult).success).toBe(true)
      expect(executeResult.id).toBe('task-integration-123')
      expect(executeResult.state).toBe(TaskState.RUNNING)
    })

    it('should handle API validation errors', async () => {
      const invalidRequest = {
        task: '', // Invalid: empty task
        options: {
          timeout: -1000, // Invalid: negative timeout
        }
      }

      // Validate request locally first
      const validationResult = validateTaskExecutionRequest(invalidRequest as any)
      expect(validationResult.success).toBe(false)

      // Mock API validation error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Validation failed',
          details: validationResult.success ? [] : validationResult.error.issues
        }),
      } as Response)

      const wrapper = createWrapper()
      const { result } = renderHook(() => useTaskExecution(), { wrapper })

      // Should throw validation error
      await expect(result.current.mutateAsync(invalidRequest as any))
        .rejects.toThrow('Validation failed')
    })

    it('should handle network errors with retry logic', async () => {
      const taskRequest: TaskExecutionRequest = {
        task: 'test network retry',
        options: { timeout: 30000 }
      }

      // Mock network failure
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'retry-test-task',
            state: TaskState.COMPLETED,
            progress: 1.0,
            startTime: new Date(),
            lastActivity: new Date(),
          }),
        } as Response)

      const queryClient = new QueryClient({
        defaultOptions: {
          mutations: {
            retry: 2, // Enable retries for this test
            retryDelay: 100,
          },
        },
      })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useTaskExecution(), { wrapper })

      // Should eventually succeed after retries
      const executeResult = await result.current.mutateAsync(taskRequest)
      expect(executeResult.id).toBe('retry-test-task')
      expect(mockFetch).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
    })
  })

  describe('Task Status API', () => {
    it('should fetch and validate task status', async () => {
      const taskId = 'status-test-task'
      const mockStatus: TaskStatus = {
        id: taskId,
        state: TaskState.COMPLETED,
        progress: 1.0,
        startTime: new Date('2023-01-01T10:00:00Z'),
        lastActivity: new Date('2023-01-01T10:05:00Z'),
        metadata: {
          correlationId: 'status-test-corr',
          tags: ['status', 'test']
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus,
      } as Response)

      const wrapper = createWrapper()
      const { result } = renderHook(() => useTaskStatus(taskId), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      // Verify response validation
      expect(validateTaskStatus(result.current.data!).success).toBe(true)
      expect(result.current.data?.id).toBe(taskId)
      expect(result.current.data?.state).toBe(TaskState.COMPLETED)
      expect(result.current.data?.progress).toBe(1.0)
    })

    it('should handle polling for running tasks', async () => {
      jest.useFakeTimers()

      const taskId = 'polling-test-task'
      const mockStatuses = [
        {
          id: taskId,
          state: TaskState.RUNNING,
          progress: 0.3,
          startTime: new Date(),
          lastActivity: new Date(),
        },
        {
          id: taskId,
          state: TaskState.RUNNING,
          progress: 0.7,
          startTime: new Date(),
          lastActivity: new Date(),
        },
        {
          id: taskId,
          state: TaskState.COMPLETED,
          progress: 1.0,
          startTime: new Date(),
          lastActivity: new Date(),
        },
      ]

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStatuses[0],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStatuses[1],
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockStatuses[2],
        } as Response)

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            refetchInterval: (data: any) => {
              return data?.state === TaskState.RUNNING ? 1000 : false
            },
          },
        },
      })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useTaskStatus(taskId), { wrapper })

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
      expect(result.current.data?.progress).toBe(0.3)

      // Advance timer for first poll
      jest.advanceTimersByTime(1000)
      await waitFor(() => {
        expect(result.current.data?.progress).toBe(0.7)
      })

      // Advance timer for second poll
      jest.advanceTimersByTime(1000)
      await waitFor(() => {
        expect(result.current.data?.progress).toBe(1.0)
        expect(result.current.data?.state).toBe(TaskState.COMPLETED)
      })

      // Should stop polling when task is completed
      jest.advanceTimersByTime(2000)
      expect(mockFetch).toHaveBeenCalledTimes(3)

      jest.useRealTimers()
    })

    it('should handle 404 errors for non-existent tasks', async () => {
      const taskId = 'non-existent-task'

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Task not found' }),
      } as Response)

      const wrapper = createWrapper()
      const { result } = renderHook(() => useTaskStatus(taskId), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toBeDefined()
    })
  })

  describe('System Metrics API', () => {
    it('should fetch and validate system metrics', async () => {
      const mockMetrics = {
        activeTasks: 5,
        queueLength: 12,
        workerStatus: 'healthy' as const,
        uptime: 7200,
        averageExecutionTime: 1500,
        successRate: 0.95,
        errorRate: 0.05,
        throughput: 25.5,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetrics,
      } as Response)

      const wrapper = createWrapper()
      const { result } = renderHook(() => useSystemMetrics(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.activeTasks).toBe(5)
      expect(result.current.data?.workerStatus).toBe('healthy')
      expect(result.current.data?.successRate).toBe(0.95)
    })

    it('should cache metrics appropriately', async () => {
      const mockMetrics = {
        activeTasks: 3,
        queueLength: 8,
        workerStatus: 'healthy' as const,
        uptime: 3600,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetrics,
      } as Response)

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000, // 30 seconds
            cacheTime: 60000, // 1 minute
          },
        },
      })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )

      // First hook instance
      const { result: result1 } = renderHook(() => useSystemMetrics(), { wrapper })

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true)
      })

      // Second hook instance should use cached data
      const { result: result2 } = renderHook(() => useSystemMetrics(), { wrapper })

      // Should not make another API call
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(result2.current.data).toEqual(mockMetrics)
    })
  })

  describe('Authentication Integration', () => {
    it('should include JWT token in API requests', async () => {
      const mockToken = 'mock-jwt-token'

      // Mock localStorage for token storage
      const mockLocalStorage = {
        getItem: jest.fn().mockReturnValue(mockToken),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      })

      const taskRequest: TaskExecutionRequest = {
        task: 'auth test',
        options: { timeout: 30000 }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'auth-test-task',
          state: TaskState.PENDING,
          progress: 0,
          startTime: new Date(),
          lastActivity: new Date(),
        }),
      } as Response)

      const wrapper = createWrapper()
      const { result } = renderHook(() => useTaskExecution(), { wrapper })

      await result.current.mutateAsync(taskRequest)

      expect(mockFetch).toHaveBeenCalledWith('/api/tasks/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`
        },
        body: JSON.stringify(taskRequest)
      })
    })

    it('should handle 401 unauthorized responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as Response)

      const wrapper = createWrapper()
      const { result } = renderHook(() => useTaskStatus('test-task'), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      // Should trigger authentication flow
      expect(result.current.error).toBeDefined()
    })
  })

  describe('Offline Support', () => {
    it('should handle offline scenarios gracefully', async () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })

      const taskRequest: TaskExecutionRequest = {
        task: 'offline test',
        options: { timeout: 30000 }
      }

      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network unavailable'))

      const wrapper = createWrapper()
      const { result } = renderHook(() => useTaskExecution(), { wrapper })

      await expect(result.current.mutateAsync(taskRequest))
        .rejects.toThrow('Network unavailable')

      // Verify the error is handled appropriately
      expect(result.current.isError).toBe(true)
    })

    it('should sync data when coming back online', async () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })

      const wrapper = createWrapper()
      const { result } = renderHook(() => useTaskStatus('offline-sync-task'), { wrapper })

      // Should not make API call when offline
      expect(mockFetch).not.toHaveBeenCalled()

      // Go back online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
      })

      // Mock successful response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'offline-sync-task',
          state: TaskState.COMPLETED,
          progress: 1.0,
          startTime: new Date(),
          lastActivity: new Date(),
        }),
      } as Response)

      // Trigger online event
      window.dispatchEvent(new Event('online'))

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockFetch).toHaveBeenCalled()
    })
  })
})