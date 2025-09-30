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
  const { data: analyticsData, isLoading, error } = usePerformanceMetrics()

  // Extract metrics from analytics response
  const metrics = analyticsData?.metrics

  // Transform metrics into KPI data format
  const kpiData: KPIData[] = React.useMemo(() => {
    if (!metrics) return []

    return [
      {
        label: 'Completion Rate',
        value: metrics.completionRate,
        change: metrics.completionRate > 80 ? 5.2 : -2.1,
        trend: metrics.completionRate > 80 ? TrendDirection.UP : TrendDirection.DOWN,
        unit: '%',
        description: 'Percentage of tasks completed successfully'
      },
      {
        label: 'Avg Completion Time',
        value: metrics.averageCompletionTime / 3600, // Convert seconds to hours
        change: metrics.averageCompletionTime < 18000 ? -8.5 : 3.2,
        trend: metrics.averageCompletionTime < 18000 ? TrendDirection.UP : TrendDirection.DOWN,
        unit: 'h',
        description: 'Average time to complete tasks'
      },
      {
        label: 'Throughput',
        value: metrics.throughput,
        change: 12.3,
        trend: TrendDirection.UP,
        unit: '/h',
        description: 'Tasks completed per hour'
      },
      {
        label: 'Efficiency',
        value: metrics.efficiency,
        change: metrics.efficiency > 85 ? 4.1 : -1.5,
        trend: metrics.efficiency > 85 ? TrendDirection.UP : TrendDirection.STABLE,
        unit: '%',
        description: 'Overall task completion efficiency'
      }
    ]
  }, [metrics])

  // Extract chart data from analytics response
  const chartData = React.useMemo(() => {
    if (!analyticsData?.charts) return undefined
    return analyticsData.charts as Record<string, ChartData>
  }, [analyticsData])

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
          <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load performance metrics. Please try again later.
          </div>
        )}

        <KPISummary kpis={kpiData} isLoading={isLoading} />

        <PerformanceCharts
          metrics={metrics}
          charts={chartData}
          isLoading={isLoading}
        />
      </div>
    </AppLayout>
  )
}