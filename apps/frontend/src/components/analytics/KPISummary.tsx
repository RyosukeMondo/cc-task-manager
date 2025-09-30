'use client'

import * as React from 'react'
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { KPIData } from '@/types/analytics'
import { TrendDirection } from '@cc-task-manager/schemas'
import { cn } from '@/lib/utils'

interface KPISummaryProps {
  /**
   * Array of KPI data to display
   */
  kpis: KPIData[]

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
 * KPISummary component displays key performance indicators in card format
 * Shows value, change percentage, and trend direction for each KPI
 *
 * @example
 * ```tsx
 * <KPISummary
 *   kpis={[
 *     {
 *       label: 'Completion Rate',
 *       value: 87.5,
 *       change: 5.2,
 *       trend: TrendDirection.UP,
 *       unit: '%'
 *     }
 *   ]}
 * />
 * ```
 */
export function KPISummary({ kpis, isLoading = false, className }: KPISummaryProps) {
  if (isLoading) {
    return (
      <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[120px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[80px] mb-2" />
              <Skeleton className="h-4 w-[100px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!kpis || kpis.length === 0) {
    return (
      <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
        <Card className="col-span-full">
          <CardContent className="flex items-center justify-center py-10">
            <p className="text-sm text-muted-foreground">No KPI data available</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-4', className)}>
      {kpis.map((kpi, index) => (
        <KPICard key={`${kpi.label}-${index}`} kpi={kpi} />
      ))}
    </div>
  )
}

interface KPICardProps {
  kpi: KPIData
}

function KPICard({ kpi }: KPICardProps) {
  const { label, value, change, trend, unit = '', description } = kpi

  const formattedValue = React.useMemo(() => {
    // Handle undefined value
    if (value === undefined || value === null) {
      return '--'
    }

    if (unit === '%') {
      return `${value.toFixed(1)}${unit}`
    }
    if (Number.isInteger(value)) {
      return `${value}${unit}`
    }
    return `${value.toFixed(2)}${unit}`
  }, [value, unit])

  const formattedChange = React.useMemo(() => {
    // Handle undefined change
    if (change === undefined || change === null) {
      return '--'
    }

    const absChange = Math.abs(change)
    return `${change >= 0 ? '+' : '-'}${absChange.toFixed(1)}%`
  }, [change])

  const trendIcon = React.useMemo(() => {
    switch (trend) {
      case TrendDirection.UP:
        return <ArrowUpIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
      case TrendDirection.DOWN:
        return <ArrowDownIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
      case TrendDirection.STABLE:
        return <MinusIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
      default:
        return null
    }
  }, [trend])

  const trendColor = React.useMemo(() => {
    switch (trend) {
      case TrendDirection.UP:
        return 'text-green-600 dark:text-green-400'
      case TrendDirection.DOWN:
        return 'text-red-600 dark:text-red-400'
      case TrendDirection.STABLE:
        return 'text-gray-600 dark:text-gray-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }, [trend])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {trendIcon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>
        <div className="flex items-center gap-1 mt-1">
          <p className={cn('text-xs font-medium', trendColor)}>
            {formattedChange}
          </p>
          <p className="text-xs text-muted-foreground">from last period</p>
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-2">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}