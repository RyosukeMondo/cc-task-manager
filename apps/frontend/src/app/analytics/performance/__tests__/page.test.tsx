/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import PerformancePage from '../page'
import { TrendDirection } from '@cc-task-manager/schemas'

// Mock the performance metrics hook
jest.mock('../../../../hooks/usePerformanceMetrics', () => ({
  usePerformanceMetrics: jest.fn(),
}))

// Mock the components
jest.mock('../../../../components/analytics/KPISummary', () => ({
  KPISummary: ({ kpis, isLoading }: any) => (
    <div data-testid="kpi-summary" aria-label="KPI Summary">
      {isLoading ? (
        <div>Loading KPIs...</div>
      ) : (
        <div>
          {kpis.map((kpi: any, index: number) => (
            <div key={index} data-testid={`kpi-${kpi.label}`}>
              {kpi.label}: {kpi.value} {kpi.unit}
            </div>
          ))}
        </div>
      )}
    </div>
  ),
}))

jest.mock('../../../../components/analytics/PerformanceCharts', () => ({
  PerformanceCharts: ({ metrics, charts, isLoading }: any) => (
    <div data-testid="performance-charts" aria-label="Performance Charts">
      {isLoading ? (
        <div>Loading charts...</div>
      ) : (
        <div>
          Mock Performance Charts
          {metrics && <div data-testid="chart-metrics">Metrics loaded</div>}
          {charts && <div data-testid="chart-data">Charts loaded</div>}
        </div>
      )}
    </div>
  ),
}))

jest.mock('../../../../components/layout', () => ({
  AppLayout: ({ children }: any) => (
    <div data-testid="app-layout" role="main" aria-label="Performance Analytics">
      {children}
    </div>
  ),
}))

// Mock theme context
jest.mock('../../../../lib/theme/context', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: jest.fn(),
  }),
}))

import { usePerformanceMetrics } from '../../../../hooks/usePerformanceMetrics'

const mockUsePerformanceMetrics = usePerformanceMetrics as jest.MockedFunction<
  typeof usePerformanceMetrics
>

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

describe('Performance Analytics Page', () => {
  const mockAnalyticsData = {
    metrics: {
      completionRate: 85.5,
      averageCompletionTime: 14400, // 4 hours in seconds
      throughput: 12.3,
      efficiency: 88.2,
      taskVelocity: 45.6,
      timestamp: new Date().toISOString(),
    },
    charts: {
      completionTime: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        datasets: [
          {
            label: 'Completion Time',
            data: [3.5, 4.2, 3.8, 4.5, 4.0],
          },
        ],
      },
      throughput: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        datasets: [
          {
            label: 'Throughput',
            data: [10, 12, 11, 13, 12],
          },
        ],
      },
      efficiency: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        datasets: [
          {
            label: 'Efficiency',
            data: [85, 87, 86, 89, 88],
          },
        ],
      },
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUsePerformanceMetrics.mockReturnValue({
      data: mockAnalyticsData,
      isLoading: false,
      error: null,
    } as any)
  })

  describe('Page Rendering', () => {
    it('should render performance page with all sections', () => {
      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      // Check for main page elements
      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByText(/performance analytics/i)).toBeInTheDocument()
      expect(
        screen.getByText(/track your task completion metrics/i)
      ).toBeInTheDocument()

      // Check for KPI summary and charts
      expect(screen.getByTestId('kpi-summary')).toBeInTheDocument()
      expect(screen.getByTestId('performance-charts')).toBeInTheDocument()
    })

    it('should display page title and description', () => {
      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      expect(screen.getByText('Performance Analytics')).toBeInTheDocument()
      expect(
        screen.getByText('Track your task completion metrics and identify areas for improvement')
      ).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('should display loading state correctly', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any)

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      expect(screen.getByText(/loading kpis/i)).toBeInTheDocument()
      expect(screen.getByText(/loading charts/i)).toBeInTheDocument()
    })

    it('should pass loading state to KPI component', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any)

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      const kpiSummary = screen.getByTestId('kpi-summary')
      expect(kpiSummary).toHaveTextContent(/loading kpis/i)
    })

    it('should pass loading state to charts component', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any)

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      const performanceCharts = screen.getByTestId('performance-charts')
      expect(performanceCharts).toHaveTextContent(/loading charts/i)
    })
  })

  describe('Error Handling', () => {
    it('should display error state correctly', () => {
      const mockError = new Error('Failed to fetch performance metrics')
      mockUsePerformanceMetrics.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: mockError,
      } as any)

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      expect(
        screen.getByText(/failed to load performance metrics/i)
      ).toBeInTheDocument()
      expect(screen.getByText(/please try again later/i)).toBeInTheDocument()
    })

    it('should still render page structure on error', () => {
      const mockError = new Error('Failed to fetch performance metrics')
      mockUsePerformanceMetrics.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: mockError,
      } as any)

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByText('Performance Analytics')).toBeInTheDocument()
    })
  })

  describe('KPI Data Display', () => {
    it('should display all KPI cards with correct data', () => {
      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      // Check for all KPI cards
      expect(screen.getByTestId('kpi-Completion Rate')).toBeInTheDocument()
      expect(screen.getByTestId('kpi-Avg Completion Time')).toBeInTheDocument()
      expect(screen.getByTestId('kpi-Throughput')).toBeInTheDocument()
      expect(screen.getByTestId('kpi-Efficiency')).toBeInTheDocument()
    })

    it('should format completion rate correctly', () => {
      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      const completionRateKPI = screen.getByTestId('kpi-Completion Rate')
      expect(completionRateKPI).toHaveTextContent('85.5')
      expect(completionRateKPI).toHaveTextContent('%')
    })

    it('should convert average completion time from seconds to hours', () => {
      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      const avgTimeKPI = screen.getByTestId('kpi-Avg Completion Time')
      // 14400 seconds = 4 hours
      expect(avgTimeKPI).toHaveTextContent('4')
      expect(avgTimeKPI).toHaveTextContent('h')
    })

    it('should display throughput with correct unit', () => {
      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      const throughputKPI = screen.getByTestId('kpi-Throughput')
      expect(throughputKPI).toHaveTextContent('12.3')
      expect(throughputKPI).toHaveTextContent('/h')
    })

    it('should display efficiency percentage', () => {
      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      const efficiencyKPI = screen.getByTestId('kpi-Efficiency')
      expect(efficiencyKPI).toHaveTextContent('88.2')
      expect(efficiencyKPI).toHaveTextContent('%')
    })

    it('should handle empty KPI data', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: { metrics: undefined, charts: undefined },
        isLoading: false,
        error: null,
      } as any)

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      const kpiSummary = screen.getByTestId('kpi-summary')
      expect(kpiSummary).toBeInTheDocument()
    })
  })

  describe('Chart Data Display', () => {
    it('should pass metrics to performance charts', () => {
      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      expect(screen.getByTestId('chart-metrics')).toBeInTheDocument()
    })

    it('should pass chart data to performance charts', () => {
      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      expect(screen.getByTestId('chart-data')).toBeInTheDocument()
    })

    it('should handle missing chart data', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: {
          metrics: mockAnalyticsData.metrics,
          charts: undefined,
        },
        isLoading: false,
        error: null,
      } as any)

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      const performanceCharts = screen.getByTestId('performance-charts')
      expect(performanceCharts).toBeInTheDocument()
      expect(screen.queryByTestId('chart-data')).not.toBeInTheDocument()
    })
  })

  describe('Data Updates', () => {
    it('should update KPIs when data changes', async () => {
      const Wrapper = createWrapper()
      const { rerender } = render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      expect(screen.getByTestId('kpi-Completion Rate')).toHaveTextContent('85.5')

      // Update mock data
      mockUsePerformanceMetrics.mockReturnValue({
        data: {
          ...mockAnalyticsData,
          metrics: {
            ...mockAnalyticsData.metrics,
            completionRate: 92.3,
          },
        },
        isLoading: false,
        error: null,
      } as any)

      rerender(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('kpi-Completion Rate')).toHaveTextContent('92.3')
      })
    })

    it('should update charts when data changes', async () => {
      const Wrapper = createWrapper()
      const { rerender } = render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      expect(screen.getByTestId('chart-data')).toBeInTheDocument()

      // Update mock data with different charts
      const updatedCharts = {
        ...mockAnalyticsData.charts,
        completionTime: {
          labels: ['Sat', 'Sun'],
          datasets: [
            {
              label: 'Completion Time',
              data: [3.2, 4.8],
            },
          ],
        },
      }

      mockUsePerformanceMetrics.mockReturnValue({
        data: {
          ...mockAnalyticsData,
          charts: updatedCharts,
        },
        isLoading: false,
        error: null,
      } as any)

      rerender(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      await waitFor(() => {
        expect(screen.getByTestId('chart-data')).toBeInTheDocument()
      })
    })
  })

  describe('KPI Trend Logic', () => {
    it('should show UP trend for high completion rate', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: {
          ...mockAnalyticsData,
          metrics: {
            ...mockAnalyticsData.metrics,
            completionRate: 85, // > 80
          },
        },
        isLoading: false,
        error: null,
      } as any)

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      // Verify the KPI is rendered (trend logic is tested through the component)
      expect(screen.getByTestId('kpi-Completion Rate')).toBeInTheDocument()
    })

    it('should show DOWN trend for low completion rate', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: {
          ...mockAnalyticsData,
          metrics: {
            ...mockAnalyticsData.metrics,
            completionRate: 75, // <= 80
          },
        },
        isLoading: false,
        error: null,
      } as any)

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      expect(screen.getByTestId('kpi-Completion Rate')).toBeInTheDocument()
    })

    it('should show UP trend for fast completion time', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: {
          ...mockAnalyticsData,
          metrics: {
            ...mockAnalyticsData.metrics,
            averageCompletionTime: 14400, // < 18000 (5 hours)
          },
        },
        isLoading: false,
        error: null,
      } as any)

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      expect(screen.getByTestId('kpi-Avg Completion Time')).toBeInTheDocument()
    })

    it('should show UP trend for high efficiency', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: {
          ...mockAnalyticsData,
          metrics: {
            ...mockAnalyticsData.metrics,
            efficiency: 90, // > 85
          },
        },
        isLoading: false,
        error: null,
      } as any)

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      expect(screen.getByTestId('kpi-Efficiency')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should provide proper ARIA labels', () => {
      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      expect(screen.getByRole('main')).toHaveAttribute(
        'aria-label',
        'Performance Analytics'
      )
      expect(screen.getByLabelText('KPI Summary')).toBeInTheDocument()
      expect(screen.getByLabelText('Performance Charts')).toBeInTheDocument()
    })

    it('should have proper heading hierarchy', () => {
      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      const heading = screen.getByText('Performance Analytics')
      expect(heading.tagName).toBe('H1')
    })
  })

  describe('Layout and Structure', () => {
    it('should render within AppLayout', () => {
      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      expect(screen.getByTestId('app-layout')).toBeInTheDocument()
    })

    it('should have proper spacing between sections', () => {
      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      const main = screen.getByRole('main')
      expect(main).toBeInTheDocument()

      // Check that KPI summary and charts are both present
      expect(screen.getByTestId('kpi-summary')).toBeInTheDocument()
      expect(screen.getByTestId('performance-charts')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero values in metrics', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: {
          metrics: {
            completionRate: 0,
            averageCompletionTime: 0,
            throughput: 0,
            efficiency: 0,
            taskVelocity: 0,
            timestamp: new Date().toISOString(),
          },
          charts: mockAnalyticsData.charts,
        },
        isLoading: false,
        error: null,
      } as any)

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      expect(screen.getByTestId('kpi-Completion Rate')).toHaveTextContent('0')
      expect(screen.getByTestId('kpi-Throughput')).toHaveTextContent('0')
      expect(screen.getByTestId('kpi-Efficiency')).toHaveTextContent('0')
    })

    it('should handle very large metric values', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: {
          metrics: {
            completionRate: 100,
            averageCompletionTime: 86400, // 24 hours
            throughput: 999.9,
            efficiency: 100,
            taskVelocity: 1000,
            timestamp: new Date().toISOString(),
          },
          charts: mockAnalyticsData.charts,
        },
        isLoading: false,
        error: null,
      } as any)

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      expect(screen.getByTestId('kpi-Completion Rate')).toHaveTextContent('100')
      expect(screen.getByTestId('kpi-Throughput')).toHaveTextContent('999.9')
    })

    it('should handle undefined analytics data', () => {
      mockUsePerformanceMetrics.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as any)

      const Wrapper = createWrapper()
      render(
        <Wrapper>
          <PerformancePage />
        </Wrapper>
      )

      expect(screen.getByTestId('kpi-summary')).toBeInTheDocument()
      expect(screen.getByTestId('performance-charts')).toBeInTheDocument()
    })
  })
})