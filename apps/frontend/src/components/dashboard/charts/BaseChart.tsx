'use client';

import React from 'react';
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
  ArcElement,
  ChartOptions,
  ChartData,
  TooltipItem
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
);

/**
 * Base chart component interface following Open/Closed Principle
 * Extensible design allows new chart types without modifying existing code
 */
export interface BaseChartProps {
  title: string;
  description?: string;
  data: ChartData<any>;
  options?: ChartOptions<any>;
  height?: number;
  width?: number;
  className?: string;
  loading?: boolean;
  error?: string;
}

/**
 * Common chart options factory
 * Provides consistent styling and behavior across all chart types
 */
export function createBaseChartOptions(
  responsive: boolean = true,
  maintainAspectRatio: boolean = false
): ChartOptions<any> {
  return {
    responsive,
    maintainAspectRatio,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 6,
        displayColors: false,
        callbacks: {
          label: function(context: TooltipItem<any>) {
            const label = context.dataset.label || '';
            const value = context.parsed.y || context.parsed;
            return `${label}: ${typeof value === 'number' ? value.toLocaleString() : value}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    }
  };
}

/**
 * Base chart wrapper component
 * Provides consistent card layout, loading states, and error handling
 */
export function ChartCard({
  title,
  description,
  children,
  loading = false,
  error,
  className = ''
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  loading?: boolean;
  error?: string;
  className?: string;
}) {
  return (
    <Card className={`${className}`}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-red-500">
            <p>Error loading chart: {error}</p>
          </div>
        ) : (
          <div className="h-64">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Color palette for consistent chart styling
 */
export const chartColors = {
  primary: [
    'rgba(59, 130, 246, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(239, 68, 68, 0.8)',
    'rgba(139, 92, 246, 0.8)',
    'rgba(236, 72, 153, 0.8)'
  ],
  borders: [
    'rgba(59, 130, 246, 1)',
    'rgba(16, 185, 129, 1)',
    'rgba(245, 158, 11, 1)',
    'rgba(239, 68, 68, 1)',
    'rgba(139, 92, 246, 1)',
    'rgba(236, 72, 153, 1)'
  ],
  success: 'rgba(16, 185, 129, 0.8)',
  warning: 'rgba(245, 158, 11, 0.8)',
  error: 'rgba(239, 68, 68, 0.8)',
  info: 'rgba(59, 130, 246, 0.8)'
};

/**
 * Task state color mapping for consistent visualization
 */
export const taskStateColors = {
  pending: chartColors.info,
  running: chartColors.warning,
  active: chartColors.primary[0],
  idle: 'rgba(156, 163, 175, 0.8)',
  completed: chartColors.success,
  failed: chartColors.error,
  cancelled: 'rgba(107, 114, 128, 0.8)'
};