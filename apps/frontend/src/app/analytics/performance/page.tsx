'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarIcon } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { AppLayout } from '@/components/layout'
import { KPISummary } from '@/components/analytics/KPISummary'
import { PerformanceCharts } from '@/components/analytics/PerformanceCharts'
import { usePerformanceMetrics } from '@/hooks/usePerformanceMetrics'
import type { KPIData, ChartData, DateRange } from '@/types/analytics'
import { TrendDirection } from '@cc-task-manager/schemas'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * Performance Analytics Page
 *
 * Displays comprehensive task performance metrics including:
 * - Key performance indicators (completion rate, avg completion time, throughput, efficiency)
 * - Visual charts for completion time trends, throughput, and efficiency over time
 * - Date range filter for viewing metrics across different time periods
 *
 * Route: /analytics/performance
 */
export default function PerformancePage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize date range from URL params or default to last 30 days
  const [dateRange, setDateRange] = React.useState<DateRange>(() => {
    const startParam = searchParams.get('startDate')
    const endParam = searchParams.get('endDate')

    if (startParam && endParam) {
      return {
        startDate: new Date(startParam),
        endDate: new Date(endParam)
      }
    }

    return {
      startDate: subDays(new Date(), 30),
      endDate: new Date()
    }
  })

  // Fetch performance metrics with date range filter
  const { data: analyticsData, isLoading, error } = usePerformanceMetrics({
    dateRange
  })

  // Update URL when date range changes
  React.useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('startDate', format(dateRange.startDate, 'yyyy-MM-dd'))
    params.set('endDate', format(dateRange.endDate, 'yyyy-MM-dd'))
    router.push(`?${params.toString()}`, { scroll: false })
  }, [dateRange, router, searchParams])

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Performance Analytics</h1>
            <p className="text-muted-foreground mt-2">
              Track your task completion metrics and identify areas for improvement
            </p>
          </div>

          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
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

/**
 * DateRangePicker component for selecting date ranges
 */
interface DateRangePickerProps {
  dateRange: DateRange
  onDateRangeChange: (dateRange: DateRange) => void
}

function DateRangePicker({ dateRange, onDateRangeChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [tempStartDate, setTempStartDate] = React.useState<Date>(dateRange.startDate)
  const [tempEndDate, setTempEndDate] = React.useState<Date>(dateRange.endDate)

  const handleApply = () => {
    if (tempStartDate && tempEndDate) {
      // Validate date range
      if (tempStartDate <= tempEndDate) {
        onDateRangeChange({
          startDate: tempStartDate,
          endDate: tempEndDate
        })
        setIsOpen(false)
      }
    }
  }

  const handlePreset = (days: number) => {
    const endDate = new Date()
    const startDate = subDays(endDate, days)
    onDateRangeChange({ startDate, endDate })
    setIsOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full sm:w-[300px] justify-start text-left font-normal',
            !dateRange && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateRange?.startDate ? (
            <>
              {format(dateRange.startDate, 'LLL dd, y')} -{' '}
              {format(dateRange.endDate, 'LLL dd, y')}
            </>
          ) : (
            <span>Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          <div className="flex flex-col gap-2 p-3 border-r">
            <div className="text-sm font-medium">Quick Select</div>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => handlePreset(7)}
            >
              Last 7 days
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => handlePreset(30)}
            >
              Last 30 days
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => handlePreset(90)}
            >
              Last 90 days
            </Button>
          </div>
          <div className="p-3">
            <div className="text-sm font-medium mb-2">Start Date</div>
            <Calendar
              mode="single"
              selected={tempStartDate}
              onSelect={(date) => date && setTempStartDate(date)}
              disabled={(date) => date > new Date() || date < new Date('2020-01-01')}
            />
            <div className="text-sm font-medium mb-2 mt-4">End Date</div>
            <Calendar
              mode="single"
              selected={tempEndDate}
              onSelect={(date) => date && setTempEndDate(date)}
              disabled={(date) => date > new Date() || date < tempStartDate}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={!tempStartDate || !tempEndDate || tempStartDate > tempEndDate}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}