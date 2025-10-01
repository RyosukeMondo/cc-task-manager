'use client'

import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api/contract-client'

/**
 * System metrics response from backend
 */
export interface SystemMetricsResponse {
  system: {
    cpu: {
      usage: number
      cores: number
    }
    memory: {
      total: number
      free: number
      used: number
      usagePercent: number
    }
    disk: {
      total: number
      free: number
      used: number
      usagePercent: number
    }
  }
  api: {
    averageResponseTime: number
    p95ResponseTime: number
    requestsPerSecond: number
    endpointBreakdown: Array<{
      path: string
      count: number
      avgTime: number
    }>
  }
  database: {
    activeConnections: number
    idleConnections: number
    poolSize: number
    queueDepth: number
  }
  websocket: {
    connectedClients: number
    messagesPerSecond: number
    averageLatency: number
  }
  timestamp: Date
}

/**
 * Historical data point for time-series charts
 */
export interface MetricDataPoint {
  timestamp: number
  value: number
}

/**
 * Metrics history for time-series visualization
 */
export interface MetricsHistory {
  cpu: MetricDataPoint[]
  memory: MetricDataPoint[]
}

/**
 * Hook return type
 */
export interface UseSystemMetricsResult {
  metrics: SystemMetricsResponse | undefined
  history: MetricsHistory
  isLoading: boolean
  error: Error | null
  lastUpdated: Date | null
}

const MAX_HISTORY_POINTS = 720 // 1 hour at 5s intervals
const POLL_INTERVAL_ACTIVE = 5000 // 5 seconds when page is visible
const POLL_INTERVAL_INACTIVE = 60000 // 60 seconds when page is inactive

/**
 * Custom hook for fetching system metrics with polling and historical data retention
 *
 * Features:
 * - Auto-polling every 5 seconds when page is visible
 * - Reduced polling (60s) when page is inactive
 * - Maintains sliding window history (last 1 hour = 720 data points)
 * - Returns current metrics and time-series history for charts
 *
 * @param options - Additional React Query options
 * @returns Query result with metrics, history, loading state, and error
 *
 * @example
 * ```tsx
 * const { metrics, history, isLoading, error, lastUpdated } = useSystemMetrics()
 *
 * if (isLoading) return <div>Loading...</div>
 * if (error) return <div>Error: {error.message}</div>
 *
 * return (
 *   <div>
 *     <p>CPU Usage: {metrics.system.cpu.usage}%</p>
 *     <MetricsChart data={history.cpu} title="CPU History" />
 *   </div>
 * )
 * ```
 */
export function useSystemMetrics(
  options?: Omit<UseQueryOptions<SystemMetricsResponse, Error>, 'queryKey' | 'queryFn'>
) {
  const [history, setHistory] = useState<MetricsHistory>({
    cpu: [],
    memory: [],
  })
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Determine polling interval based on page visibility
  const [refetchInterval, setRefetchInterval] = useState(POLL_INTERVAL_ACTIVE)

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setRefetchInterval(POLL_INTERVAL_INACTIVE)
      } else {
        setRefetchInterval(POLL_INTERVAL_ACTIVE)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const queryResult = useQuery<SystemMetricsResponse, Error>({
    queryKey: ['system', 'metrics'] as const,
    queryFn: () => apiClient.getSystemMetrics(),
    refetchInterval,
    staleTime: 0, // Always consider data stale for real-time updates
    retry: 2,
    refetchOnWindowFocus: true,
    ...options,
  })

  const { data, error, isLoading } = queryResult

  // Update history when new data arrives
  useEffect(() => {
    if (data) {
      const timestamp = new Date(data.timestamp).getTime()
      setLastUpdated(new Date(data.timestamp))

      setHistory((prev) => {
        const newCpuPoint: MetricDataPoint = {
          timestamp,
          value: data.system.cpu.usage,
        }
        const newMemoryPoint: MetricDataPoint = {
          timestamp,
          value: data.system.memory.usagePercent,
        }

        // Append new data points and maintain sliding window (max 720 points)
        const newCpu = [...prev.cpu, newCpuPoint].slice(-MAX_HISTORY_POINTS)
        const newMemory = [...prev.memory, newMemoryPoint].slice(-MAX_HISTORY_POINTS)

        return {
          cpu: newCpu,
          memory: newMemory,
        }
      })
    }
  }, [data])

  return {
    metrics: data,
    history,
    isLoading,
    error,
    lastUpdated,
  }
}
