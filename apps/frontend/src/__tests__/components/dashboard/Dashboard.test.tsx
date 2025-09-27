/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Dashboard } from '../../../components/dashboard/Dashboard'

// Mock the dashboard data hook
jest.mock('../../../components/dashboard/hooks/useDashboardData', () => ({
  useDashboardData: jest.fn(),
}))

// Mock chart components
jest.mock('../../../components/dashboard/charts/TaskTrendChart', () => ({
  TaskTrendChart: ({ data }: any) => (
    <div data-testid="task-trend-chart" aria-label="Task trend over time">
      Mock Task Trend Chart: {data.length} data points
    </div>
  ),
}))

jest.mock('../../../components/dashboard/charts/PerformanceChart', () => ({
  PerformanceChart: ({ metrics }: any) => (
    <div data-testid="performance-chart" aria-label="Performance metrics">
      Mock Performance Chart: {metrics.successRate * 100}% success rate
    </div>
  ),
}))

jest.mock('../../../components/dashboard/charts/TaskStatusChart', () => ({
  TaskStatusChart: ({ data }: any) => (
    <div data-testid="task-status-chart" aria-label="Task status distribution">
      Mock Task Status Chart: {data.completed} completed tasks
    </div>
  ),
}))

// Mock theme context
jest.mock('../../../lib/theme/context', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: jest.fn(),
  }),
}))

import { useDashboardData } from '../../../components/dashboard/hooks/useDashboardData'

const mockUseDashboardData = useDashboardData as jest.MockedFunction<typeof useDashboardData>

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('Dashboard Component', () => {
  const mockDashboardData = {
    taskMetrics: {
      total: 150,
      completed: 120,
      failed: 15,
      running: 10,
      pending: 5,
    },
    performanceMetrics: {
      averageExecutionTime: 2500,
      successRate: 0.9,
      throughput: 45.8,
      errorRate: 0.1,
    },
    trendData: [
      { timestamp: new Date('2023-01-01'), completed: 20, failed: 2 },
      { timestamp: new Date('2023-01-02'), completed: 25, failed: 1 },
      { timestamp: new Date('2023-01-03'), completed: 30, failed: 3 },
    ],
    systemStatus: {
      activeTasks: 10,
      queueLength: 5,
      workerStatus: 'healthy' as const,
      uptime: 86400,
    },
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseDashboardData.mockReturnValue(mockDashboardData)
  })

  it('should render dashboard with all sections', () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <Dashboard />
      </Wrapper>
    )

    // Check for main dashboard elements
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByText(/dashboard/i)).toBeInTheDocument()

    // Check for metrics sections
    expect(screen.getByText('150')).toBeInTheDocument() // Total tasks
    expect(screen.getByText('120')).toBeInTheDocument() // Completed tasks
    expect(screen.getByText('90%')).toBeInTheDocument() // Success rate

    // Check for charts
    expect(screen.getByTestId('task-trend-chart')).toBeInTheDocument()
    expect(screen.getByTestId('performance-chart')).toBeInTheDocument()
    expect(screen.getByTestId('task-status-chart')).toBeInTheDocument()
  })

  it('should display loading state correctly', () => {
    mockUseDashboardData.mockReturnValue({
      ...mockDashboardData,
      isLoading: true,
    })

    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <Dashboard />
      </Wrapper>
    )

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('should display error state correctly', () => {
    const mockError = new Error('Failed to fetch dashboard data')
    mockUseDashboardData.mockReturnValue({
      ...mockDashboardData,
      isLoading: false,
      error: mockError,
    })

    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <Dashboard />
      </Wrapper>
    )

    expect(screen.getByText(/error/i)).toBeInTheDocument()
    expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument()
  })

  it('should handle refresh functionality', async () => {
    const user = userEvent.setup()
    const mockRefetch = jest.fn()
    mockUseDashboardData.mockReturnValue({
      ...mockDashboardData,
      refetch: mockRefetch,
    })

    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <Dashboard />
      </Wrapper>
    )

    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    await user.click(refreshButton)

    expect(mockRefetch).toHaveBeenCalled()
  })

  it('should format metrics correctly', () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <Dashboard />
      </Wrapper>
    )

    // Check metric formatting
    expect(screen.getByText('2.5s')).toBeInTheDocument() // Average execution time
    expect(screen.getByText('45.8/min')).toBeInTheDocument() // Throughput
    expect(screen.getByText('90%')).toBeInTheDocument() // Success rate
  })

  it('should display system status correctly', () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <Dashboard />
      </Wrapper>
    )

    expect(screen.getByText('10')).toBeInTheDocument() // Active tasks
    expect(screen.getByText('5')).toBeInTheDocument() // Queue length
    expect(screen.getByText(/healthy/i)).toBeInTheDocument() // Worker status
    expect(screen.getByText(/1 day/i)).toBeInTheDocument() // Uptime (86400 seconds = 1 day)
  })

  it('should handle different worker statuses', () => {
    mockUseDashboardData.mockReturnValue({
      ...mockDashboardData,
      systemStatus: {
        ...mockDashboardData.systemStatus,
        workerStatus: 'degraded' as const,
      },
    })

    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <Dashboard />
      </Wrapper>
    )

    expect(screen.getByText(/degraded/i)).toBeInTheDocument()
  })

  it('should be responsive and maintain layout', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    })

    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <Dashboard />
      </Wrapper>
    )

    // Dashboard should still render all components
    expect(screen.getByTestId('task-trend-chart')).toBeInTheDocument()
    expect(screen.getByTestId('performance-chart')).toBeInTheDocument()
    expect(screen.getByTestId('task-status-chart')).toBeInTheDocument()
  })

  it('should provide accessibility features', () => {
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <Dashboard />
      </Wrapper>
    )

    // Check for proper ARIA labels
    expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Dashboard')

    // Check for chart accessibility
    expect(screen.getByLabelText(/task trend over time/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/performance metrics/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/task status distribution/i)).toBeInTheDocument()

    // Check for proper headings
    const headings = screen.getAllByRole('heading')
    expect(headings.length).toBeGreaterThan(0)
  })

  it('should update when data changes', async () => {
    const Wrapper = createWrapper()
    const { rerender } = render(
      <Wrapper>
        <Dashboard />
      </Wrapper>
    )

    expect(screen.getByText('150')).toBeInTheDocument() // Initial total

    // Update mock data
    mockUseDashboardData.mockReturnValue({
      ...mockDashboardData,
      taskMetrics: {
        ...mockDashboardData.taskMetrics,
        total: 175,
        completed: 140,
      },
    })

    rerender(
      <Wrapper>
        <Dashboard />
      </Wrapper>
    )

    await waitFor(() => {
      expect(screen.getByText('175')).toBeInTheDocument() // Updated total
      expect(screen.getByText('140')).toBeInTheDocument() // Updated completed
    })
  })

  it('should handle real-time updates', async () => {
    jest.useFakeTimers()

    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <Dashboard />
      </Wrapper>
    )

    // Simulate real-time update
    mockUseDashboardData.mockReturnValue({
      ...mockDashboardData,
      taskMetrics: {
        ...mockDashboardData.taskMetrics,
        running: 12, // Increased running tasks
      },
    })

    // Advance timers to trigger update
    jest.advanceTimersByTime(5000)

    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument()
    })

    jest.useRealTimers()
  })

  it('should filter data by time range', async () => {
    const user = userEvent.setup()
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <Dashboard />
      </Wrapper>
    )

    // Check for time range selector
    const timeRangeSelect = screen.getByRole('combobox', { name: /time range/i })
    expect(timeRangeSelect).toBeInTheDocument()

    // Change time range
    await user.selectOptions(timeRangeSelect, '7d')

    // Should trigger data refetch with new range
    expect(mockDashboardData.refetch).toHaveBeenCalledWith({
      timeRange: '7d'
    })
  })

  it('should export dashboard data', async () => {
    const user = userEvent.setup()
    const Wrapper = createWrapper()
    render(
      <Wrapper>
        <Dashboard />
      </Wrapper>
    )

    const exportButton = screen.getByRole('button', { name: /export/i })
    await user.click(exportButton)

    // Should trigger export functionality
    // This would test actual export implementation
  })
})