'use client'

import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/contract-client'
import type { PerformanceMetricsDto, AnalyticsFilterDto } from '@cc-task-manager/schemas'

/**
 * Custom hook for fetching performance metrics with optional filtering
 *
 * @param filter - Optional analytics filter for date range
 * @param options - Additional React Query options
 * @returns Query result with performance metrics (completion rate, execution time, throughput)
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = usePerformanceMetrics({
 *   startDate: '2024-01-01T00:00:00Z',
 *   endDate: '2024-01-31T23:59:59Z'
 * })
 * ```
 */
export function usePerformanceMetrics(
  filter?: AnalyticsFilterDto,
  options?: Omit<UseQueryOptions<PerformanceMetricsDto, Error>, 'queryKey' | 'queryFn'>
) {
  const filterKey = filter ? JSON.stringify(filter) : undefined

  return useQuery<PerformanceMetricsDto, Error>({
    queryKey: ['analytics', 'performance', filterKey] as const,
    queryFn: () => apiClient.getPerformanceMetrics(filter),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
    refetchOnWindowFocus: false,
    ...options,
  })
}