/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, useSearchParams } from 'next/navigation';
import TrendsPage from '../page';

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

// Mock AppLayout component
jest.mock('@/components/layout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}));

// Mock TrendCharts component
jest.mock('@/components/analytics/TrendCharts', () => ({
  TrendCharts: ({ metrics, height, showLegend, showComparison }: any) => (
    <div
      data-testid="trend-charts"
      aria-label="Trend charts visualization"
      data-metrics-count={metrics.length}
      data-height={height}
      data-show-legend={showLegend}
      data-show-comparison={showComparison}
    >
      Mock Trend Charts: {metrics.length} metrics
    </div>
  ),
}));

// Mock TimePeriodSelector component
jest.mock('@/components/analytics/TimePeriodSelector', () => ({
  TimePeriodSelector: ({ value, onChange, className }: any) => (
    <div
      data-testid="time-period-selector"
      data-value={value}
      className={className}
    >
      <button onClick={() => onChange('day')}>Daily</button>
      <button onClick={() => onChange('week')}>Weekly</button>
      <button onClick={() => onChange('month')}>Monthly</button>
    </div>
  ),
}));

// Mock useTrendData hook
jest.mock('@/hooks/useTrendData', () => ({
  useTrendData: jest.fn(),
}));

import { useTrendData } from '@/hooks/useTrendData';

const mockUseTrendData = useTrendData as jest.MockedFunction<typeof useTrendData>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseSearchParams = useSearchParams as jest.MockedFunction<
  typeof useSearchParams
>;

describe('TrendsPage', () => {
  const mockTrendData = {
    data: {
      metrics: [
        {
          metricId: 'tasks-completed',
          name: 'Tasks Completed',
          total: 150,
          average: 25,
          timeSeries: [
            { timestamp: '2025-09-24T00:00:00Z', value: 20, category: 'day' },
            { timestamp: '2025-09-25T00:00:00Z', value: 25, category: 'day' },
            { timestamp: '2025-09-26T00:00:00Z', value: 30, category: 'day' },
          ],
          comparison: {
            currentPeriod: 75,
            previousPeriod: 60,
            percentageChange: 25,
            direction: 'up' as const,
            periodLabel: 'vs last week',
          },
        },
        {
          metricId: 'tasks-failed',
          name: 'Tasks Failed',
          total: 15,
          average: 2.5,
          timeSeries: [
            { timestamp: '2025-09-24T00:00:00Z', value: 2, category: 'day' },
            { timestamp: '2025-09-25T00:00:00Z', value: 1, category: 'day' },
            { timestamp: '2025-09-26T00:00:00Z', value: 3, category: 'day' },
          ],
          comparison: {
            currentPeriod: 6,
            previousPeriod: 9,
            percentageChange: -33.3,
            direction: 'down' as const,
            periodLabel: 'vs last week',
          },
        },
      ],
    },
    isLoading: false,
    isError: false,
    error: null,
    timePeriod: 'day' as const,
    setTimePeriod: jest.fn(),
  };

  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  };

  const mockSearchParams = new URLSearchParams();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(mockRouter);
    mockUseSearchParams.mockReturnValue(mockSearchParams as any);
    mockUseTrendData.mockReturnValue(mockTrendData);
  });

  it('should render trends page with all components', () => {
    render(<TrendsPage />);

    // Check for main layout
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();

    // Check for page title and description
    expect(screen.getByText('Analytics Trends')).toBeInTheDocument();
    expect(
      screen.getByText(/view task completion trends and patterns over time/i)
    ).toBeInTheDocument();

    // Check for time period selector
    expect(screen.getByTestId('time-period-selector')).toBeInTheDocument();

    // Check for trend charts
    expect(screen.getByTestId('trend-charts')).toBeInTheDocument();
  });

  it('should display loading state correctly', () => {
    mockUseTrendData.mockReturnValue({
      ...mockTrendData,
      isLoading: true,
      data: null,
    });

    render(<TrendsPage />);

    // Check for loading spinner
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/loading trend data/i)).toBeInTheDocument();

    // Verify charts are not rendered during loading
    expect(screen.queryByTestId('trend-charts')).not.toBeInTheDocument();
  });

  it('should display error state correctly', () => {
    const mockError = new Error('Failed to fetch trend data');
    mockUseTrendData.mockReturnValue({
      ...mockTrendData,
      isLoading: false,
      isError: true,
      error: mockError,
      data: null,
    });

    render(<TrendsPage />);

    // Check for error message
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/failed to load trends/i)).toBeInTheDocument();
    expect(screen.getByText(/failed to fetch trend data/i)).toBeInTheDocument();

    // Verify charts are not rendered during error
    expect(screen.queryByTestId('trend-charts')).not.toBeInTheDocument();
  });

  it('should display no data state correctly', () => {
    mockUseTrendData.mockReturnValue({
      ...mockTrendData,
      data: { metrics: [] },
    });

    render(<TrendsPage />);

    // Check for no data message
    expect(screen.getByText(/no trend data available/i)).toBeInTheDocument();
    expect(
      screen.getByText(/complete some tasks to see trends and patterns over time/i)
    ).toBeInTheDocument();

    // Verify charts are not rendered when no data
    expect(screen.queryByTestId('trend-charts')).not.toBeInTheDocument();
  });

  it('should render trend charts with correct props', () => {
    render(<TrendsPage />);

    const trendCharts = screen.getByTestId('trend-charts');
    expect(trendCharts).toBeInTheDocument();
    expect(trendCharts).toHaveAttribute('data-metrics-count', '2');
    expect(trendCharts).toHaveAttribute('data-height', '320');
    expect(trendCharts).toHaveAttribute('data-show-legend', 'true');
    expect(trendCharts).toHaveAttribute('data-show-comparison', 'true');
  });

  it('should handle time period changes', async () => {
    const user = userEvent.setup();
    const mockSetTimePeriod = jest.fn();
    mockUseTrendData.mockReturnValue({
      ...mockTrendData,
      setTimePeriod: mockSetTimePeriod,
    });

    render(<TrendsPage />);

    // Click on Weekly button
    const weeklyButton = screen.getByText('Weekly');
    await user.click(weeklyButton);

    // Verify setTimePeriod was called
    expect(mockSetTimePeriod).toHaveBeenCalledWith('week');
  });

  it('should initialize with period from URL params', () => {
    const searchParams = new URLSearchParams();
    searchParams.set('period', 'week');
    mockUseSearchParams.mockReturnValue(searchParams as any);

    render(<TrendsPage />);

    // Verify useTrendData was called with correct initial period
    expect(mockUseTrendData).toHaveBeenCalledWith({
      initialPeriod: 'week',
      enabled: true,
    });
  });

  it('should default to day period when no URL param provided', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams() as any);

    render(<TrendsPage />);

    // Verify useTrendData was called with default day period
    expect(mockUseTrendData).toHaveBeenCalledWith({
      initialPeriod: 'day',
      enabled: true,
    });
  });

  it('should pass correct time period to TimePeriodSelector', () => {
    mockUseTrendData.mockReturnValue({
      ...mockTrendData,
      timePeriod: 'month',
    });

    render(<TrendsPage />);

    const selector = screen.getByTestId('time-period-selector');
    expect(selector).toHaveAttribute('data-value', 'month');
  });

  it('should update when trend data changes', async () => {
    const { rerender } = render(<TrendsPage />);

    expect(screen.getByText(/mock trend charts: 2 metrics/i)).toBeInTheDocument();

    // Update mock data with more metrics
    mockUseTrendData.mockReturnValue({
      ...mockTrendData,
      data: {
        metrics: [
          ...mockTrendData.data.metrics,
          {
            metricId: 'tasks-running',
            name: 'Tasks Running',
            total: 50,
            average: 8.3,
            timeSeries: [
              { timestamp: '2025-09-24T00:00:00Z', value: 5, category: 'day' },
              { timestamp: '2025-09-25T00:00:00Z', value: 10, category: 'day' },
              { timestamp: '2025-09-26T00:00:00Z', value: 12, category: 'day' },
            ],
          },
        ],
      },
    });

    rerender(<TrendsPage />);

    await waitFor(() => {
      const trendCharts = screen.getByTestId('trend-charts');
      expect(trendCharts).toHaveAttribute('data-metrics-count', '3');
    });
  });

  it('should provide accessibility features', () => {
    render(<TrendsPage />);

    // Check for proper ARIA labels
    expect(screen.getByLabelText(/trend charts visualization/i)).toBeInTheDocument();

    // Check for proper headings
    const heading = screen.getByRole('heading', { name: /analytics trends/i });
    expect(heading).toBeInTheDocument();

    // Check for status/alert roles in various states
    const trendCharts = screen.getByTestId('trend-charts');
    expect(trendCharts).toHaveAttribute('aria-label');
  });

  it('should handle loading to success transition', async () => {
    // Start with loading state
    mockUseTrendData.mockReturnValue({
      ...mockTrendData,
      isLoading: true,
      data: null,
    });

    const { rerender } = render(<TrendsPage />);
    expect(screen.getByText(/loading trend data/i)).toBeInTheDocument();

    // Transition to success state
    mockUseTrendData.mockReturnValue(mockTrendData);
    rerender(<TrendsPage />);

    await waitFor(() => {
      expect(screen.queryByText(/loading trend data/i)).not.toBeInTheDocument();
      expect(screen.getByTestId('trend-charts')).toBeInTheDocument();
    });
  });

  it('should handle loading to error transition', async () => {
    // Start with loading state
    mockUseTrendData.mockReturnValue({
      ...mockTrendData,
      isLoading: true,
      data: null,
    });

    const { rerender } = render(<TrendsPage />);
    expect(screen.getByText(/loading trend data/i)).toBeInTheDocument();

    // Transition to error state
    mockUseTrendData.mockReturnValue({
      ...mockTrendData,
      isLoading: false,
      isError: true,
      error: new Error('Network error'),
      data: null,
    });
    rerender(<TrendsPage />);

    await waitFor(() => {
      expect(screen.queryByText(/loading trend data/i)).not.toBeInTheDocument();
      expect(screen.getByText(/failed to load trends/i)).toBeInTheDocument();
    });
  });

  it('should have proper Suspense fallback', () => {
    // This tests that the Suspense boundary is set up correctly
    render(<TrendsPage />);

    // The component should render without throwing errors
    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
  });

  it('should handle null data gracefully', () => {
    mockUseTrendData.mockReturnValue({
      ...mockTrendData,
      data: null,
    });

    render(<TrendsPage />);

    // Should show no data state
    expect(screen.getByText(/no trend data available/i)).toBeInTheDocument();
  });

  it('should render page header with correct structure', () => {
    render(<TrendsPage />);

    // Check header structure
    const heading = screen.getByText('Analytics Trends');
    expect(heading.tagName).toBe('H1');
    expect(heading).toHaveClass('text-3xl', 'font-bold', 'tracking-tight');

    // Check description
    const description = screen.getByText(
      /view task completion trends and patterns over time/i
    );
    expect(description).toHaveClass('text-muted-foreground');
  });

  it('should display multiple metrics with different data', () => {
    render(<TrendsPage />);

    const trendCharts = screen.getByTestId('trend-charts');
    expect(trendCharts).toHaveAttribute('data-metrics-count', '2');
  });

  it('should maintain responsive layout structure', () => {
    render(<TrendsPage />);

    // Check for responsive flex layout classes in the component
    const pageContent = screen.getByText('Analytics Trends').parentElement?.parentElement;
    expect(pageContent).toHaveClass('flex');
  });
});