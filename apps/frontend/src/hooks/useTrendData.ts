'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/contract-client';
import type {
  AnalyticsResponse,
  AnalyticsFilter,
  TimeSeriesData,
  GroupByOption,
} from '@cc-task-manager/schemas';

/**
 * Query key factory for trend data
 * Ensures proper cache invalidation and deduplication
 */
export const trendQueryKeys = {
  all: ['trends'] as const,
  filtered: (filter: AnalyticsFilter) => ['trends', filter] as const,
  timeSeries: (filter: AnalyticsFilter) => ['trends', 'timeSeries', filter] as const,
} as const;

/**
 * Custom hook for fetching and managing trend analytics data
 *
 * Provides time-series data with support for different time period groupings (day/week/month)
 * and automatic caching through React Query.
 *
 * @param filter - Analytics filter parameters including date range and groupBy period
 * @param options - Additional React Query options for customization
 * @returns Query result with trend data, loading state, and error handling
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useTrendData({
 *   dateRange: {
 *     startDate: '2025-09-01T00:00:00Z',
 *     endDate: '2025-09-30T23:59:59Z'
 *   },
 *   groupBy: GroupByOption.DAY
 * });
 * ```
 */
export function useTrendData(
  filter: AnalyticsFilter,
  options?: Omit<UseQueryOptions<AnalyticsResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: trendQueryKeys.filtered(filter),
    queryFn: async () => {
      // Call analytics API endpoint with filter parameters
      const response = await apiClient.request<AnalyticsResponse>(
        'POST',
        '/api/analytics/trends',
        filter
      );
      return response;
    },
    // Cache for 5 minutes by default
    staleTime: 5 * 60 * 1000,
    // Keep unused data in cache for 10 minutes
    gcTime: 10 * 60 * 1000,
    // Refetch on window focus for fresh data
    refetchOnWindowFocus: true,
    // Retry failed requests up to 2 times
    retry: 2,
    ...options,
  });
}

/**
 * Hook specifically for fetching time series trend data
 *
 * Optimized for retrieving just the time-series portion of analytics data
 * for trend visualization charts.
 *
 * @param filter - Analytics filter parameters
 * @param options - Additional React Query options
 * @returns Query result containing array of time series data points
 */
export function useTrendTimeSeries(
  filter: AnalyticsFilter,
  options?: Omit<UseQueryOptions<TimeSeriesData[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: trendQueryKeys.timeSeries(filter),
    queryFn: async () => {
      const response = await apiClient.request<AnalyticsResponse>(
        'POST',
        '/api/analytics/trends',
        filter
      );
      return response.timeSeries;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
    ...options,
  });
}

/**
 * Hook for comparing trends across different time periods
 *
 * Fetches trend data for multiple time periods simultaneously to enable
 * period-over-period comparison analysis.
 *
 * @param currentFilter - Filter for the current period
 * @param previousFilter - Filter for the comparison period
 * @returns Object containing queries for both current and previous periods
 */
export function useTrendComparison(
  currentFilter: AnalyticsFilter,
  previousFilter: AnalyticsFilter
) {
  const currentQuery = useTrendData(currentFilter);
  const previousQuery = useTrendData(previousFilter);

  return {
    current: currentQuery,
    previous: previousQuery,
    isLoading: currentQuery.isLoading || previousQuery.isLoading,
    isError: currentQuery.isError || previousQuery.isError,
    error: currentQuery.error || previousQuery.error,
  };
}