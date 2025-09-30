'use client'

import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/contract-client'
import type { AnalyticsResponse, AnalyticsFilter } from '@cc-task-manager/schemas'

/**
 * Custom hook for fetching performance metrics with optional filtering
 *
 * @param filter - Optional analytics filter for date range and grouping
 * @param options - Additional React Query options
 * @returns Query result with analytics response including metrics, charts, and KPIs
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = usePerformanceMetrics({
 *   dateRange: {
 *     startDate: '2024-01-01T00:00:00Z',
 *     endDate: '2024-01-31T23:59:59Z'
 *   },
 *   groupBy: 'day'
 * })
 * ```
 */
export function usePerformanceMetrics(
  filter?: AnalyticsFilter,
  options?: Omit<UseQueryOptions<AnalyticsResponse, Error>, 'queryKey' | 'queryFn'>
) {
  const filterKey = filter ? JSON.stringify(filter) : undefined

  return useQuery<AnalyticsResponse, Error>({
    queryKey: ['analytics', 'performance', filterKey] as const,
    queryFn: () => apiClient.getPerformanceMetrics(filter),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
    ...options,
  })
}