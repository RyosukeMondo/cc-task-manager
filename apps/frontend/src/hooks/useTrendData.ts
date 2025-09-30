'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { useState, useCallback, useMemo } from 'react';
import type {
  AnalyticsTrendResponse,
  AnalyticsFilter,
  TimePeriod,
} from '@/types/analytics';

// Query keys for trend data following TanStack Query best practices
export const trendQueryKeys = {
  trends: ['analytics', 'trends'] as const,
  trendsByPeriod: (period: TimePeriod) =>
    ['analytics', 'trends', period] as const,
  trendsWithFilters: (filters: AnalyticsFilter) =>
    ['analytics', 'trends', filters] as const,
} as const;

interface UseTrendDataOptions {
  initialPeriod?: TimePeriod;
  enabled?: boolean;
  refetchInterval?: number;
}

interface UseTrendDataReturn {
  data: AnalyticsTrendResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  timePeriod: TimePeriod;
  setTimePeriod: (period: TimePeriod) => void;
  filters: AnalyticsFilter;
  updateFilters: (newFilters: Partial<AnalyticsFilter>) => void;
  refetch: () => void;
}

/**
 * Custom hook for fetching and managing trend data
 * Centralizes trend data management with support for time period selection and filtering
 *
 * @param options - Configuration options for the hook
 * @returns Trend data with loading states and control functions
 */
export function useTrendData(
  options: UseTrendDataOptions = {}
): UseTrendDataReturn {
  const {
    initialPeriod = 'day',
    enabled = true,
    refetchInterval,
  } = options;

  // State management
  const [timePeriod, setTimePeriod] = useState<TimePeriod>(initialPeriod);
  const [filters, setFilters] = useState<AnalyticsFilter>({
    groupBy: initialPeriod,
  });

  // Update filters when time period changes
  const updateTimePeriod = useCallback((period: TimePeriod) => {
    setTimePeriod(period);
    setFilters((prev) => ({
      ...prev,
      groupBy: period,
    }));
  }, []);

  // Update filters while preserving existing values
  const updateFilters = useCallback((newFilters: Partial<AnalyticsFilter>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  }, []);

  // Fetch trend data function
  const fetchTrendData = useCallback(
    async (currentFilters: AnalyticsFilter): Promise<AnalyticsTrendResponse> => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      // Build query parameters from filters
      const params = new URLSearchParams();
      if (currentFilters.groupBy) {
        params.append('groupBy', currentFilters.groupBy);
      }
      if (currentFilters.startDate) {
        params.append('startDate', currentFilters.startDate.toISOString());
      }
      if (currentFilters.endDate) {
        params.append('endDate', currentFilters.endDate.toISOString());
      }

      const url = `${baseUrl}/api/analytics/trends?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Add auth token if available
          ...(typeof window !== 'undefined' && localStorage.getItem('auth_token') && {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          }),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch trend data: ${response.statusText}`);
      }

      return response.json();
    },
    []
  );

  // React Query integration with caching
  const queryKey = useMemo(
    () => trendQueryKeys.trendsWithFilters(filters),
    [filters]
  );

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => fetchTrendData(filters),
    enabled,
    // Cache for 5 minutes by default
    staleTime: 5 * 60 * 1000,
    // Keep cached data for 10 minutes
    gcTime: 10 * 60 * 1000,
    refetchInterval,
    // Refetch on window focus for fresh data
    refetchOnWindowFocus: true,
  } as UseQueryOptions<AnalyticsTrendResponse, Error>);

  return {
    data,
    isLoading,
    isError,
    error: error ?? null,
    timePeriod,
    setTimePeriod: updateTimePeriod,
    filters,
    updateFilters,
    refetch,
  };
}