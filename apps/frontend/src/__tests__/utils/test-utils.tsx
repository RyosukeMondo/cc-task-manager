/**
 * Custom testing utilities for frontend tests
 * Provides common test setup and helper functions
 */

import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../../lib/theme/context'
import { AuthProvider } from '../../lib/auth/context'

// Mock authentication for testing
const mockAuthContext = {
  user: {
    id: 'test-user-123',
    email: 'test@example.com',
    role: 'user' as const,
    permissions: ['read', 'write'],
  },
  isAuthenticated: true,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
}

// Mock theme context for testing
const mockThemeContext = {
  theme: 'light' as const,
  setTheme: jest.fn(),
  systemPreference: 'light' as const,
  preferences: {
    highContrast: false,
    reducedMotion: false,
  },
}

// Custom render function with providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider value={mockAuthContext}>
          {children}
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
  withAuth?: boolean
  withTheme?: boolean
}

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { queryClient, withAuth = true, withTheme = true, ...renderOptions } = options

  let Wrapper = ({ children }: { children: React.ReactNode }) => <>{children}</>

  if (queryClient || withAuth || withTheme) {
    Wrapper = ({ children }: { children: React.ReactNode }) => {
      const client = queryClient || new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })

      let content = <>{children}</>

      if (withAuth) {
        content = (
          <AuthProvider value={mockAuthContext}>
            {content}
          </AuthProvider>
        )
      }

      if (withTheme) {
        content = (
          <ThemeProvider>
            {content}
          </ThemeProvider>
        )
      }

      return (
        <QueryClientProvider client={client}>
          {content}
        </QueryClientProvider>
      )
    }
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

// Mock data generators
export const mockTaskStatus = (overrides = {}) => ({
  id: 'mock-task-123',
  state: 'running' as const,
  progress: 0.5,
  startTime: new Date('2023-01-01T10:00:00Z'),
  lastActivity: new Date('2023-01-01T10:30:00Z'),
  metadata: {
    correlationId: 'mock-correlation-123',
    tags: ['test', 'mock'],
  },
  ...overrides,
})

export const mockTaskExecutionRequest = (overrides = {}) => ({
  task: 'console.log("mock task")',
  options: {
    timeout: 30000,
    workingDirectory: '/tmp',
  },
  ...overrides,
})

export const mockDashboardData = (overrides = {}) => ({
  taskMetrics: {
    total: 100,
    completed: 75,
    failed: 10,
    running: 10,
    pending: 5,
  },
  performanceMetrics: {
    averageExecutionTime: 2000,
    successRate: 0.9,
    throughput: 50,
    errorRate: 0.1,
  },
  trendData: [
    { timestamp: new Date('2023-01-01'), completed: 20, failed: 2 },
    { timestamp: new Date('2023-01-02'), completed: 25, failed: 1 },
  ],
  systemStatus: {
    activeTasks: 10,
    queueLength: 5,
    workerStatus: 'healthy' as const,
    uptime: 3600,
  },
  isLoading: false,
  error: null,
  refetch: jest.fn(),
  ...overrides,
})

// Accessibility testing helpers
export const mockMediaQuery = (query: string, matches: boolean = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(q => ({
      matches: q === query ? matches : false,
      media: q,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Storage mocking utilities
export const mockLocalStorage = () => {
  const store: { [key: string]: string } = {}

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    }),
  }
}

// WebSocket mocking utilities
export const mockWebSocket = () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  connected: false,
  id: 'mock-socket-id',
})

// Network mocking utilities
export const mockFetchSuccess = (data: any, status = 200) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    headers: new Headers({ 'content-type': 'application/json' }),
  } as Response)
}

export const mockFetchError = (error: string, status = 500) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error }),
  } as Response)
}

export const mockNetworkError = (message = 'Network error') => {
  global.fetch = jest.fn().mockRejectedValue(new Error(message))
}

// Timer utilities for testing async behavior
export const advanceTimers = (ms: number) => {
  jest.advanceTimersByTime(ms)
  return new Promise(resolve => setTimeout(resolve, 0))
}

// Form testing utilities
export const fillForm = async (
  user: any,
  fields: Record<string, string | number>
) => {
  for (const [fieldName, value] of Object.entries(fields)) {
    const field = screen.getByLabelText(new RegExp(fieldName, 'i'))
    await user.clear(field)
    await user.type(field, String(value))
  }
}

// Custom matchers for contract validation
export const expectValidContract = (result: any) => {
  expect(result.success).toBe(true)
  if (!result.success) {
    console.error('Contract validation failed:', result.error.issues)
  }
}

export const expectInvalidContract = (result: any, expectedErrors?: string[]) => {
  expect(result.success).toBe(false)
  if (expectedErrors) {
    const errorMessages = result.error.issues.map((issue: any) => issue.message)
    expectedErrors.forEach(expectedError => {
      expect(errorMessages.some((msg: string) => msg.includes(expectedError))).toBe(true)
    })
  }
}

// Re-export testing library utilities
export * from '@testing-library/react'
export { customRender as render }