'use client';

import React from 'react';
import { Bar } from 'react-chartjs-2';
import { ChartData } from 'chart.js';
import {
  BaseChartProps,
  ChartCard,
  createBaseChartOptions,
  chartColors
} from './BaseChart';

interface PerformanceData {
  labels: string[];
  executionTimes: number[];
  memoryUsage: number[];
  cpuUsage: number[];
}

interface PerformanceChartProps extends Omit<BaseChartProps, 'data'> {
  data: PerformanceData;
  metric?: 'execution' | 'memory' | 'cpu' | 'all';
}

/**
 * System performance metrics chart component
 * Displays execution times, memory usage, and CPU usage
 * Extends BaseChart following Open/Closed Principle
 */
export function PerformanceChart({
  title = 'System Performance Metrics',
  description = 'Real-time system performance data',
  data,
  metric = 'all',
  options,
  loading = false,
  error,
  className = ''
}: PerformanceChartProps) {
  const getDatasets = () => {
    const datasets = [];

    if (metric === 'execution' || metric === 'all') {
      datasets.push({
        label: 'Execution Time (ms)',
        data: data.executionTimes,
        backgroundColor: chartColors.primary[0],
        borderColor: chartColors.borders[0],
        borderWidth: 1,
        yAxisID: 'y'
      });
    }

    if (metric === 'memory' || metric === 'all') {
      datasets.push({
        label: 'Memory Usage (MB)',
        data: data.memoryUsage,
        backgroundColor: chartColors.primary[1],
        borderColor: chartColors.borders[1],
        borderWidth: 1,
        yAxisID: metric === 'all' ? 'y1' : 'y'
      });
    }

    if (metric === 'cpu' || metric === 'all') {
      datasets.push({
        label: 'CPU Usage (%)',
        data: data.cpuUsage,
        backgroundColor: chartColors.primary[2],
        borderColor: chartColors.borders[2],
        borderWidth: 1,
        yAxisID: metric === 'all' ? 'y2' : 'y'
      });
    }

    return datasets;
  };

  const chartData: ChartData<'bar'> = {
    labels: data.labels,
    datasets: getDatasets()
  };

  const getScales = () => {
    if (metric === 'all') {
      return {
        x: {
          title: {
            display: true,
            text: 'Time Interval'
          }
        },
        y: {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
          title: {
            display: true,
            text: 'Execution Time (ms)'
          }
        },
        y1: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          title: {
            display: true,
            text: 'Memory (MB)'
          },
          grid: {
            drawOnChartArea: false
          }
        },
        y2: {
          type: 'linear' as const,
          display: false,
          position: 'right' as const,
          max: 100
        }
      };
    }

    return {
      x: {
        title: {
          display: true,
          text: 'Time Interval'
        }
      },
      y: {
        title: {
          display: true,
          text: metric === 'execution' ? 'Time (ms)' :
                metric === 'memory' ? 'Memory (MB)' : 'CPU Usage (%)'
        },
        beginAtZero: true,
        max: metric === 'cpu' ? 100 : undefined
      }
    };
  };

  const chartOptions = {
    ...createBaseChartOptions(true, false),
    ...options,
    scales: getScales(),
    plugins: {
      ...createBaseChartOptions().plugins,
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            let suffix = '';

            if (label.includes('Time')) suffix = ' ms';
            else if (label.includes('Memory')) suffix = ' MB';
            else if (label.includes('CPU')) suffix = '%';

            return `${label}: ${value.toLocaleString()}${suffix}`;
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
      <Bar data={chartData} options={chartOptions} />
    </ChartCard>
  );
}