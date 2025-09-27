'use client';

import React from 'react';
import { Line } from 'react-chartjs-2';
import { ChartData } from 'chart.js';
import {
  BaseChartProps,
  ChartCard,
  createBaseChartOptions,
  chartColors
} from './BaseChart';

interface TaskTrendData {
  timestamps: string[];
  completed: number[];
  failed: number[];
  cancelled: number[];
}

interface TaskTrendChartProps extends Omit<BaseChartProps, 'data'> {
  data: TaskTrendData;
  timeRange?: '1h' | '24h' | '7d' | '30d';
}

/**
 * Task completion trend chart component
 * Shows task completion, failure, and cancellation trends over time
 * Extends BaseChart following Open/Closed Principle
 */
export function TaskTrendChart({
  title = 'Task Completion Trends',
  description = 'Task completion rates over time',
  data,
  timeRange = '24h',
  options,
  loading = false,
  error,
  className = ''
}: TaskTrendChartProps) {
  const chartData: ChartData<'line'> = {
    labels: data.timestamps,
    datasets: [
      {
        label: 'Completed',
        data: data.completed,
        borderColor: chartColors.success,
        backgroundColor: chartColors.success.replace('0.8', '0.1'),
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
      {
        label: 'Failed',
        data: data.failed,
        borderColor: chartColors.error,
        backgroundColor: chartColors.error.replace('0.8', '0.1'),
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
      {
        label: 'Cancelled',
        data: data.cancelled,
        borderColor: chartColors.borders[5],
        backgroundColor: chartColors.primary[5].replace('0.8', '0.1'),
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
      }
    ]
  };

  const chartOptions = {
    ...createBaseChartOptions(true, false),
    ...options,
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time'
        },
        grid: {
          display: false
        }
      },
      y: {
        title: {
          display: true,
          text: 'Number of Tasks'
        },
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const
    }
  };

  return (
    <ChartCard
      title={title}
      description={`${description} (${timeRange})`}
      loading={loading}
      error={error}
      className={className}
    >
      <Line data={chartData} options={chartOptions} />
    </ChartCard>
  );
}