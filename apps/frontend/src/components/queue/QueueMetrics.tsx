'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QueueMetricsProps {
  /**
   * Queue metrics data
   */
  metrics: {
    activeCount: number;
    pendingCount: number;
    completedCount: number;
    failedCount: number;
  };

  /**
   * Whether the data is loading
   */
  isLoading?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

interface MetricCardData {
  title: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

/**
 * QueueMetrics component displays queue health metrics with color-coded warnings
 *
 * Shows 4 metric cards:
 * - Active Jobs (yellow)
 * - Pending Jobs (blue)
 * - Completed Jobs (green)
 * - Failed Jobs (red)
 *
 * Features:
 * - Warning badge if activeCount > 50 ("High load")
 * - Critical styling if failedCount > 0 (red border)
 * - Responsive grid layout: 1 column mobile, 2 columns tablet, 4 columns desktop
 *
 * Spec: queue-management-dashboard
 * Requirements: 1
 *
 * @example
 * ```tsx
 * <QueueMetrics
 *   metrics={{
 *     activeCount: 5,
 *     pendingCount: 10,
 *     completedCount: 100,
 *     failedCount: 2
 *   }}
 * />
 * ```
 */
export function QueueMetrics({ metrics, isLoading = false, className }: QueueMetricsProps) {
  const metricCards: MetricCardData[] = [
    {
      title: 'Active Jobs',
      count: metrics.activeCount,
      icon: <Activity className="h-5 w-5" />,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
    },
    {
      title: 'Pending Jobs',
      count: metrics.pendingCount,
      icon: <Clock className="h-5 w-5" />,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
      borderColor: 'border-blue-200 dark:border-blue-800',
    },
    {
      title: 'Completed Jobs',
      count: metrics.completedCount,
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950',
      borderColor: 'border-green-200 dark:border-green-800',
    },
    {
      title: 'Failed Jobs',
      count: metrics.failedCount,
      icon: <XCircle className="h-5 w-5" />,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-950',
      borderColor: 'border-red-200 dark:border-red-800',
    },
  ];

  return (
    <div className={cn('grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4', className)}>
      {metricCards.map((card) => (
        <MetricCard
          key={card.title}
          {...card}
          isLoading={isLoading}
          showHighLoadWarning={card.title === 'Active Jobs' && card.count > 50}
          showCriticalStyle={card.title === 'Failed Jobs' && card.count > 0}
        />
      ))}
    </div>
  );
}

interface MetricCardProps extends MetricCardData {
  isLoading: boolean;
  showHighLoadWarning: boolean;
  showCriticalStyle: boolean;
}

function MetricCard({
  title,
  count,
  icon,
  color,
  bgColor,
  borderColor,
  isLoading,
  showHighLoadWarning,
  showCriticalStyle,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        'transition-all',
        showCriticalStyle && 'border-red-500 dark:border-red-600 border-2'
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        <div className={cn('rounded-full p-2', bgColor, color)}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <div className={cn('text-3xl font-bold', color)}>
              {isLoading ? '-' : count.toLocaleString()}
            </div>
            {showHighLoadWarning && (
              <Badge variant="outline" className="mt-2 border-yellow-500 text-yellow-600 dark:text-yellow-400">
                High load
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
