'use client'

import * as React from 'react'
import { AppLayout } from '@/components/layout'
import { SystemMetrics } from '@/components/monitoring/SystemMetrics'
import { APIPerformanceMetrics } from '@/components/monitoring/APIPerformanceMetrics'
import { MetricsChart } from '@/components/monitoring/MetricsChart'
import { useSystemMetrics } from '@/hooks/useSystemMetrics'

/**
 * System Monitoring Dashboard
 *
 * Displays real-time system metrics including:
 * - System resources (CPU, Memory, Disk, Database)
 * - API performance metrics
 * - Time-series charts for CPU and Memory trends
 * - WebSocket connection status
 *
 * Route: /monitoring
 * Polling: 5s when active, 60s when inactive
 */
export default function MonitoringPage() {
  const { metrics, history, isLoading, error, lastUpdated } = useSystemMetrics()

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Monitoring</h1>
            <p className="text-muted-foreground mt-2">
              Real-time system metrics and performance monitoring
            </p>
          </div>
          {lastUpdated && (
            <div className="text-sm text-muted-foreground">
              Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <div className="font-semibold text-amber-900 text-sm">
              Unable to load system metrics
            </div>
            <div className="text-sm text-amber-700 mt-1">
              {error instanceof Error && (error.message.includes('connect') || error.message.includes('Network') || error.message.includes('Failed to fetch'))
                ? 'Cannot connect to monitoring server. Metrics will be available when connection is restored.'
                : 'System metrics are temporarily unavailable. Please try again later.'}
            </div>
          </div>
        )}

        <SystemMetrics metrics={metrics} isLoading={isLoading} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MetricsChart
            title="CPU Usage"
            data={history.cpu}
            dataKey="value"
            color="#3b82f6"
          />
          <MetricsChart
            title="Memory Usage"
            data={history.memory}
            dataKey="value"
            color="#10b981"
          />
        </div>

        <APIPerformanceMetrics metrics={metrics} isLoading={isLoading} />
      </div>
    </AppLayout>
  )
}
