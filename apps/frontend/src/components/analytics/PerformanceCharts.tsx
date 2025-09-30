'use client'

import * as React from 'react'
import { Line, Bar } from 'react-chartjs-2'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ChartData as AnalyticsChartData, PerformanceMetrics } from '@/types/analytics'
import { ChartData, ChartOptions } from 'chart.js'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js'
import { chartColors, createBaseChartOptions } from '@/components/dashboard/charts/BaseChart'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

interface PerformanceChartsProps {
  /**
   * Performance metrics data
   */
  metrics?: PerformanceMetrics

  /**
   * Chart data for visualizations
   */
  charts?: Record<string, AnalyticsChartData>

  /**
   * Whether the data is loading
   */
  isLoading?: boolean

  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * PerformanceCharts component displays multiple chart visualizations for performance metrics
 * Includes completion time trends, throughput analysis, and efficiency tracking
 *
 * @example
 * ```tsx
 * <PerformanceCharts
 *   metrics={performanceMetrics}
 *   charts={{
 *     completionTime: { labels: [...], datasets: [...] },
 *     throughput: { labels: [...], datasets: [...] }
 *   }}
 * />
 * ```
 */
export function PerformanceCharts({
  metrics,
  charts,
  isLoading = false,
  className
}: PerformanceChartsProps) {
  if (isLoading) {
    return (
      <div className={className}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className={i === 2 ? 'md:col-span-2' : ''}>
              <CardHeader>
                <Skeleton className="h-5 w-[200px]" />
                <Skeleton className="h-4 w-[300px] mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!charts && !metrics) {
    return (
      <div className={className}>
        <Card>
          <CardContent className="flex items-center justify-center py-20">
            <p className="text-sm text-muted-foreground">No chart data available</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {charts?.completionTime && (
          <CompletionTimeChart data={charts.completionTime} />
        )}
        {charts?.throughput && (
          <ThroughputChart data={charts.throughput} />
        )}
        {charts?.efficiency && (
          <EfficiencyChart data={charts.efficiency} />
        )}
      </div>
    </div>
  )
}

interface ChartComponentProps {
  data: AnalyticsChartData
}

/**
 * Completion Time Chart - Shows average task completion time trends over time
 */
function CompletionTimeChart({ data }: ChartComponentProps) {
  const chartData: ChartData<'line'> = React.useMemo(() => {
    const datasets = data.datasets.map((dataset, index) => ({
      label: dataset.label,
      data: dataset.data,
      borderColor: dataset.borderColor || chartColors.borders[index % chartColors.borders.length],
      backgroundColor: dataset.backgroundColor || chartColors.primary[index % chartColors.primary.length],
      tension: 0.4,
      fill: true
    }))

    return {
      labels: data.labels,
      datasets
    }
  }, [data])

  const options: ChartOptions<'line'> = React.useMemo(() => ({
    ...createBaseChartOptions(true, false),
    scales: {
      x: {
        title: {
          display: true,
          text: data.metadata?.xAxisLabel || 'Time Period'
        },
        grid: {
          display: false
        }
      },
      y: {
        title: {
          display: true,
          text: data.metadata?.yAxisLabel || 'Completion Time (hours)'
        },
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
    plugins: {
      legend: {
        display: data.metadata?.showLegend ?? true,
        position: 'top' as const
      },
      tooltip: {
        enabled: data.metadata?.showTooltips ?? true,
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || ''
            const value = context.parsed.y
            return `${label}: ${value.toFixed(2)} hours`
          }
        }
      }
    }
  }), [data.metadata])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {data.metadata?.title || 'Average Completion Time'}
        </CardTitle>
        <CardDescription>
          Track how long tasks take to complete over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <Line data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Throughput Chart - Shows task completion rate (tasks per hour) over time
 */
function ThroughputChart({ data }: ChartComponentProps) {
  const chartData: ChartData<'bar'> = React.useMemo(() => {
    const datasets = data.datasets.map((dataset, index) => ({
      label: dataset.label,
      data: dataset.data,
      backgroundColor: dataset.backgroundColor || chartColors.primary[index % chartColors.primary.length],
      borderColor: dataset.borderColor || chartColors.borders[index % chartColors.borders.length],
      borderWidth: 1
    }))

    return {
      labels: data.labels,
      datasets
    }
  }, [data])

  const options: ChartOptions<'bar'> = React.useMemo(() => ({
    ...createBaseChartOptions(true, false),
    scales: {
      x: {
        title: {
          display: true,
          text: data.metadata?.xAxisLabel || 'Time Period'
        },
        grid: {
          display: false
        }
      },
      y: {
        title: {
          display: true,
          text: data.metadata?.yAxisLabel || 'Tasks per Hour'
        },
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
    plugins: {
      legend: {
        display: data.metadata?.showLegend ?? true,
        position: 'top' as const
      },
      tooltip: {
        enabled: data.metadata?.showTooltips ?? true,
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || ''
            const value = context.parsed.y
            return `${label}: ${value.toFixed(2)} tasks/hour`
          }
        }
      }
    }
  }), [data.metadata])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {data.metadata?.title || 'Task Throughput'}
        </CardTitle>
        <CardDescription>
          Number of tasks completed per hour
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <Bar data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Efficiency Chart - Shows task efficiency percentage over time
 */
function EfficiencyChart({ data }: ChartComponentProps) {
  const chartData: ChartData<'line'> = React.useMemo(() => {
    const datasets = data.datasets.map((dataset, index) => ({
      label: dataset.label,
      data: dataset.data,
      borderColor: dataset.borderColor || chartColors.success,
      backgroundColor: dataset.backgroundColor || 'rgba(16, 185, 129, 0.1)',
      tension: 0.4,
      fill: true,
      borderWidth: 2
    }))

    return {
      labels: data.labels,
      datasets
    }
  }, [data])

  const options: ChartOptions<'line'> = React.useMemo(() => ({
    ...createBaseChartOptions(true, false),
    scales: {
      x: {
        title: {
          display: true,
          text: data.metadata?.xAxisLabel || 'Time Period'
        },
        grid: {
          display: false
        }
      },
      y: {
        title: {
          display: true,
          text: data.metadata?.yAxisLabel || 'Efficiency (%)'
        },
        min: 0,
        max: 100,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
    plugins: {
      legend: {
        display: data.metadata?.showLegend ?? true,
        position: 'top' as const
      },
      tooltip: {
        enabled: data.metadata?.showTooltips ?? true,
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || ''
            const value = context.parsed.y
            return `${label}: ${value.toFixed(1)}%`
          }
        }
      }
    }
  }), [data.metadata])

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          {data.metadata?.title || 'Task Efficiency'}
        </CardTitle>
        <CardDescription>
          Efficiency score based on successful vs failed tasks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <Line data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  )
}