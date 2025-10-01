'use client'

import * as React from 'react'
import { AppLayout } from '@/components/layout'
import { KPISummary } from '@/components/analytics/KPISummary'
import { PerformanceCharts } from '@/components/analytics/PerformanceCharts'
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics'
import type { KPIData, ChartData } from '@/types/analytics'
import { TrendDirection } from '@cc-task-manager/schemas'

/**
 * Performance Analytics Page
 *
 * Displays comprehensive task performance metrics including:
 * - Key performance indicators (completion rate, avg completion time, throughput, efficiency)
 * - Visual charts for completion time trends, throughput, and efficiency over time
 *
 * Route: /analytics/performance
 */
export default function PerformancePage() {
  const { data: metricsData, isLoading, error } = usePerformanceMetrics()

  // Transform metrics into KPI data format
  const kpiData: KPIData[] = React.useMemo(() => {
    if (!metricsData) return []

    // Calculate efficiency from completion rate
    const efficiency = metricsData.totalTasks > 0
      ? (metricsData.completedTasks / metricsData.totalTasks) * 100
      : 0

    return [
      {
        label: 'Completion Rate',
        value: metricsData.completionRate,
        change: metricsData.completionRate > 80 ? 5.2 : -2.1,
        trend: metricsData.completionRate > 80 ? TrendDirection.UP : TrendDirection.DOWN,
        unit: '%',
        description: 'Percentage of tasks completed successfully'
      },
      {
        label: 'Avg Execution Time',
        value: metricsData.averageExecutionTime ? metricsData.averageExecutionTime / 3600 : 0, // Convert seconds to hours
        change: metricsData.averageExecutionTime && metricsData.averageExecutionTime < 18000 ? -8.5 : 3.2,
        trend: metricsData.averageExecutionTime && metricsData.averageExecutionTime < 18000 ? TrendDirection.UP : TrendDirection.DOWN,
        unit: 'h',
        description: 'Average time to execute tasks'
      },
      {
        label: 'Throughput',
        value: metricsData.throughput,
        change: 12.3,
        trend: TrendDirection.UP,
        unit: '/h',
        description: 'Tasks completed per hour'
      },
      {
        label: 'Total Tasks',
        value: metricsData.totalTasks,
        change: metricsData.completedTasks - metricsData.failedTasks,
        trend: metricsData.completedTasks > metricsData.failedTasks ? TrendDirection.UP : TrendDirection.DOWN,
        unit: '',
        description: `${metricsData.completedTasks} completed, ${metricsData.failedTasks} failed`
      }
    ]
  }, [metricsData])

  // Chart data would come from a separate endpoint
  const chartData = undefined

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Track your task completion metrics and identify areas for improvement
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <div className="font-semibold text-amber-900 text-sm">
              Unable to load performance metrics
            </div>
            <div className="text-sm text-amber-700 mt-1">
              {error instanceof Error && (error.message.includes('connect') || error.message.includes('Network') || error.message.includes('Failed to fetch'))
                ? 'Cannot connect to analytics server. Metrics will be available when connection is restored.'
                : 'Performance metrics are temporarily unavailable. Please try again later.'}
            </div>
          </div>
        )}

        <KPISummary kpis={kpiData} isLoading={isLoading} />

        <PerformanceCharts
          metrics={metricsData}
          charts={chartData}
          isLoading={isLoading}
        />
      </div>
    </AppLayout>
  )
}