'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/contract-client'
import { usePageVisibility } from './usePageVisibility'

export interface QueueMetrics {
  activeCount: number
  pendingCount: number
  completedCount: number
  failedCount: number
}

export interface QueueJob {
  id: string
  name: string
  status: string
  progress: number
  attemptsMade: number
  attemptsMax: number
  timestamp: Date
  data: any
  failedReason?: string
}

export interface ThroughputDataPoint {
  timestamp: number
  hour: string
  completed: number
  failed: number
}

export interface QueueStatusResponse {
  metrics: QueueMetrics
  jobs: QueueJob[]
  throughput: ThroughputDataPoint[]
}

/**
 * Hook to fetch queue status with smart polling based on page visibility
 *
 * Polling strategy:
 * - 5s interval when page is visible (active tab)
 * - 30s interval when page is inactive (background tab)
 *
 * This reduces unnecessary API calls and server load when the user
 * is not actively viewing the dashboard.
 *
 * @returns Queue data with metrics, jobs, throughput, loading state, error, and refetch function
 */
export function useQueue() {
  const isPageVisible = usePageVisibility()

  // Determine polling interval based on page visibility
  // 5s when visible, 30s when inactive
  const refetchInterval = isPageVisible ? 5000 : 30000

  const query = useQuery<QueueStatusResponse>({
    queryKey: ['queue', 'status'],
    queryFn: async () => {
      const response = await apiClient.getQueueStatus()
      return response
    },
    refetchInterval,
    // Keep fetching even when tab is inactive (just slower)
    refetchIntervalInBackground: true,
    // Stale time should be shorter than refetch interval
    staleTime: 1000,
  })

  return {
    metrics: query.data?.metrics,
    jobs: query.data?.jobs,
    throughput: query.data?.throughput,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
