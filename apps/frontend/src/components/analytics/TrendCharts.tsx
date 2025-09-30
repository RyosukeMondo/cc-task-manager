'use client';

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { AggregatedMetric, TrendComparison } from '@/types/analytics';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TrendChartsProps {
  /** Aggregated metrics with time-series data */
  metrics: AggregatedMetric[];
  /** Optional custom height for charts */
  height?: number;
  /** Whether to show legend */
  showLegend?: boolean;
  /** Whether to show comparison badges */
  showComparison?: boolean;
  /** Optional CSS class name */
  className?: string;
}

/**
 * TrendCharts component displays time-series data with interactive line charts
 * Supports multiple metrics, period comparisons, and theme-aware colors
 *
 * Requirements:
 * - 2.1: Time-series visualization
 * - 2.2: Interactive charts
 * - 2.3: Period comparisons
 * - 2.4: Accessibility
 */
export function TrendCharts({
  metrics,
  height = 300,
  showLegend = true,
  showComparison = true,
  className = '',
}: TrendChartsProps) {
  // Generate colors for multiple metrics
  const colors = useMemo(() => {
    const baseColors = [
      'rgba(59, 130, 246, 1)', // blue-500
      'rgba(16, 185, 129, 1)', // green-500
      'rgba(249, 115, 22, 1)', // orange-500
      'rgba(168, 85, 247, 1)', // purple-500
      'rgba(236, 72, 153, 1)', // pink-500
      'rgba(14, 165, 233, 1)', // sky-500
    ];
    return baseColors;
  }, []);

  // Chart configuration with accessibility and theme support
  const chartOptions: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      plugins: {
        legend: {
          display: showLegend,
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            padding: 15,
            font: {
              size: 12,
              family: "'Inter', sans-serif",
            },
          },
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleFont: {
            size: 13,
            weight: 'bold',
          },
          bodyFont: {
            size: 12,
          },
          padding: 12,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              return `${label}: ${value.toLocaleString()}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              size: 11,
            },
            maxRotation: 45,
            minRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
          },
          ticks: {
            font: {
              size: 11,
            },
            callback: (value) => {
              if (typeof value === 'number') {
                return value.toLocaleString();
              }
              return value;
            },
          },
        },
      },
    }),
    [showLegend]
  );

  // Render comparison badge
  const renderComparison = (comparison?: TrendComparison) => {
    if (!comparison || !showComparison) return null;

    const isPositive = comparison.direction === 'up';
    const isNegative = comparison.direction === 'down';
    const isStable = comparison.direction === 'stable';

    const bgColor = isPositive
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : isNegative
      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';

    const icon = isPositive ? '↑' : isNegative ? '↓' : '→';

    // Handle undefined percentageChange
    const percentageChange = comparison.percentageChange ?? 0;
    const periodLabel = comparison.periodLabel ?? 'vs previous';

    return (
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${bgColor}`}
        role="status"
        aria-label={`Trend ${comparison.direction}: ${Math.abs(percentageChange).toFixed(1)}% ${periodLabel}`}
      >
        <span aria-hidden="true">{icon}</span>
        <span>
          {Math.abs(percentageChange).toFixed(1)}%
        </span>
        <span className="text-xs opacity-75">{periodLabel}</span>
      </div>
    );
  };

  if (!metrics || metrics.length === 0) {
    return (
      <div
        className={`flex items-center justify-center p-8 text-muted-foreground ${className}`}
        role="status"
        aria-live="polite"
      >
        No trend data available
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {metrics.map((metric, index) => {
        // Skip metrics without time series data
        if (!metric.timeSeries || metric.timeSeries.length === 0) {
          return null;
        }

        // Prepare chart data for this metric
        const chartData = {
          labels: metric.timeSeries.map((point) => {
            const date = new Date(point.timestamp ?? new Date());
            return date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });
          }),
          datasets: [
            {
              label: metric.name ?? 'Unknown',
              data: metric.timeSeries.map((point) => point.value ?? 0),
              borderColor: colors[index % colors.length],
              backgroundColor: colors[index % colors.length].replace('1)', '0.1)'),
              borderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              tension: 0.3,
              fill: true,
            },
          ],
        };

        return (
          <div
            key={metric.metricId ?? `metric-${index}`}
            className="rounded-lg border bg-card p-6 shadow-sm"
          >
            {/* Header with metric name and comparison */}
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-card-foreground">
                  {metric.name ?? 'Unknown Metric'}
                </h3>
                <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    Total: <strong>{(metric.total ?? 0).toLocaleString()}</strong>
                  </span>
                  <span>
                    Avg: <strong>{(metric.average ?? 0).toLocaleString()}</strong>
                  </span>
                </div>
              </div>
              {renderComparison(metric.comparison)}
            </div>

            {/* Chart */}
            <div style={{ height: `${height}px` }}>
              <Line
                data={chartData}
                options={chartOptions}
                aria-label={`Line chart showing ${metric.name} trends over time`}
                role="img"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}