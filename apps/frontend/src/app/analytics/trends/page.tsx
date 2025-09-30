'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { TrendCharts } from '@/components/analytics/TrendCharts';
import { TimePeriodSelector } from '@/components/analytics/TimePeriodSelector';
import { useTrendData } from '@/hooks/useTrendData';
import type { TimePeriod } from '@/types/analytics';

/**
 * TrendsPageContent - Internal component with search params access
 * Separated to handle Suspense boundary properly
 */
function TrendsPageContent() {
  const searchParams = useSearchParams();
  const period = (searchParams.get('period') as TimePeriod) || 'day';

  const {
    data,
    isLoading,
    isError,
    error,
    timePeriod,
    setTimePeriod,
  } = useTrendData({
    initialPeriod: period,
    enabled: true,
  });

  // Sync URL parameter with internal state
  const handlePeriodChange = (newPeriod: TimePeriod) => {
    setTimePeriod(newPeriod);
  };

  return (
    <div className="space-y-6">
      {/* Page header with title and time period selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Trends</h1>
          <p className="mt-2 text-muted-foreground">
            View task completion trends and patterns over time
          </p>
        </div>
        <TimePeriodSelector
          value={timePeriod}
          onChange={handlePeriodChange}
          className="self-start sm:self-auto"
        />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div
          className="flex items-center justify-center p-12"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading trend data...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div
          className="rounded-lg border border-destructive bg-destructive/10 p-6"
          role="alert"
          aria-live="assertive"
        >
          <h2 className="text-lg font-semibold text-destructive">
            Failed to Load Trends
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error?.message || 'An error occurred while loading trend data.'}
          </p>
        </div>
      )}

      {/* No data state */}
      {!isLoading && !isError && (!data || data.metrics.length === 0) && (
        <div
          className="flex items-center justify-center rounded-lg border bg-card p-12"
          role="status"
          aria-live="polite"
        >
          <div className="text-center">
            <h2 className="text-xl font-semibold text-card-foreground">
              No Trend Data Available
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Complete some tasks to see trends and patterns over time.
            </p>
          </div>
        </div>
      )}

      {/* Trend charts */}
      {!isLoading && !isError && data && data.metrics.length > 0 && (
        <TrendCharts
          metrics={data.metrics}
          height={320}
          showLegend={true}
          showComparison={true}
        />
      )}
    </div>
  );
}

/**
 * Analytics Trends Page
 * Displays task completion trends over time with interactive visualizations
 *
 * Requirements:
 * - 1.1: Display completion trends with loading states and empty state handling
 * - 2.1: Time-series visualization with interactive charts
 * - 3.1: Accessible via /analytics/trends route
 */
export default function TrendsPage() {
  return (
    <AppLayout>
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }
      >
        <TrendsPageContent />
      </Suspense>
    </AppLayout>
  );
}
