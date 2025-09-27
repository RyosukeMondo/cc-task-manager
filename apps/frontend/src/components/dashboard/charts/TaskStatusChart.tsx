'use client';

import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { ChartData } from 'chart.js';
import { TaskState } from '@cc-task-manager/types';
import {
  BaseChartProps,
  ChartCard,
  createBaseChartOptions,
  taskStateColors
} from './BaseChart';

interface TaskStatusData {
  [key in TaskState]: number;
}

interface TaskStatusChartProps extends Omit<BaseChartProps, 'data'> {
  data: TaskStatusData;
}

/**
 * Task status distribution chart component
 * Displays task state breakdown using a doughnut chart
 * Extends BaseChart following Open/Closed Principle
 */
export function TaskStatusChart({
  title = 'Task Status Distribution',
  description = 'Current distribution of task states',
  data,
  options,
  loading = false,
  error,
  className = ''
}: TaskStatusChartProps) {
  const chartData: ChartData<'doughnut'> = {
    labels: Object.keys(data).map(state =>
      state.charAt(0).toUpperCase() + state.slice(1)
    ),
    datasets: [
      {
        data: Object.values(data),
        backgroundColor: Object.keys(data).map(state =>
          taskStateColors[state as TaskState]
        ),
        borderColor: Object.keys(data).map(state =>
          taskStateColors[state as TaskState].replace('0.8', '1')
        ),
        borderWidth: 2,
        hoverBackgroundColor: Object.keys(data).map(state =>
          taskStateColors[state as TaskState].replace('0.8', '0.9')
        ),
      }
    ]
  };

  const chartOptions = {
    ...createBaseChartOptions(true, false),
    ...options,
    plugins: {
      ...createBaseChartOptions().plugins,
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  };

  return (
    <ChartCard
      title={title}
      description={description}
      loading={loading}
      error={error}
      className={className}
    >
      <Doughnut data={chartData} options={chartOptions} />
    </ChartCard>
  );
}