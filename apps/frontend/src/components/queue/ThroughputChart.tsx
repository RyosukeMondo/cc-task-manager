'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface ThroughputDataPoint {
  timestamp?: number;
  hour: string;
  completed: number;
  failed: number;
}

interface ThroughputChartProps {
  /**
   * Throughput data for the last 24 hours
   * Array of hourly buckets with completed and failed job counts
   */
  data: ThroughputDataPoint[];

  /**
   * Whether the data is loading
   */
  isLoading?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * ThroughputChart component visualizes job throughput trends over time
 *
 * Features:
 * - Line chart showing last 24 hours of job completion data
 * - Two lines: Completed (green) and Failed (red)
 * - X-axis: Time in HH:mm format
 * - Y-axis: Job count
 * - Tooltip on hover with exact counts
 * - Empty state for no data
 * - Responsive 300px height
 *
 * Spec: queue-management-dashboard
 * Requirements: 2
 *
 * @example
 * ```tsx
 * <ThroughputChart
 *   data={[
 *     { timestamp: 1234567890, hour: '14:00', completed: 50, failed: 2 },
 *     { timestamp: 1234571490, hour: '15:00', completed: 45, failed: 1 },
 *   ]}
 * />
 * ```
 */
export function ThroughputChart({ data, isLoading = false, className }: ThroughputChartProps) {
  // Show empty state if no data
  if (!isLoading && (!data || data.length === 0)) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Job Throughput (Last 24 Hours)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No job history available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Job Throughput (Last 24 Hours)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p>Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Job Throughput (Last 24 Hours)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="hour"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              allowDecimals={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'hsl(var(--border))' }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="completed"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--chart-2))', r: 3 }}
              activeDot={{ r: 5 }}
              name="Completed"
            />
            <Line
              type="monotone"
              dataKey="failed"
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--destructive))', r: 3 }}
              activeDot={{ r: 5 }}
              name="Failed"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Custom tooltip component for the chart
 * Shows exact counts and formatted timestamp on hover
 */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  // Get timestamp from payload if available
  const timestamp = payload[0]?.payload?.timestamp;
  const formattedTime = timestamp
    ? format(new Date(timestamp * 1000), 'MMM dd, HH:mm')
    : label;

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3">
      <p className="font-semibold text-sm mb-2">{formattedTime}</p>
      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">{entry.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
