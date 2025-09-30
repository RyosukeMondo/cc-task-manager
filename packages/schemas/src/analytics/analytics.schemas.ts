import { z } from 'zod';

/**
 * Trend direction enumeration for KPI changes
 * Indicates the direction of change in performance metrics
 */
export enum TrendDirection {
  UP = 'up',
  DOWN = 'down',
  STABLE = 'stable'
}

/**
 * Time grouping options for analytics aggregation
 * Defines supported time intervals for data grouping
 */
export enum GroupByOption {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year'
}

/**
 * Available metrics for analytics queries
 * Defines all performance metrics that can be requested
 */
export enum MetricType {
  COMPLETION_RATE = 'completionRate',
  AVERAGE_COMPLETION_TIME = 'averageCompletionTime',
  THROUGHPUT = 'throughput',
  EFFICIENCY = 'efficiency',
  TASK_VELOCITY = 'taskVelocity'
}

/**
 * Date range schema for time-based filtering
 * Validates date range with business rules ensuring end date is after start date
 */
export const DateRangeSchema = z.object({
  /** ISO 8601 date string for range start */
  startDate: z.string().datetime('Invalid start date format'),
  /** ISO 8601 date string for range end */
  endDate: z.string().datetime('Invalid end date format')
}).strict().refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return end >= start;
  },
  {
    message: 'End date must be equal to or after start date',
    path: ['endDate']
  }
);

/**
 * Performance metrics schema for task completion analytics
 * Comprehensive performance indicators with timestamps and calculated rates
 */
export const PerformanceMetricsSchema = z.object({
  /** Task completion rate as percentage (0-100) */
  completionRate: z.number().min(0).max(100),

  /** Average time to complete tasks in seconds */
  averageCompletionTime: z.number().min(0),

  /** Tasks completed per hour */
  throughput: z.number().min(0),

  /** Efficiency score calculated as (completed / (completed + failed)) * 100 */
  efficiency: z.number().min(0).max(100),

  /** Task velocity: average tasks completed per day over the selected period */
  taskVelocity: z.number().min(0),

  /** Total number of tasks in the analyzed period */
  totalTasks: z.number().int().min(0),

  /** Number of successfully completed tasks */
  completedTasks: z.number().int().min(0),

  /** Number of failed tasks */
  failedTasks: z.number().int().min(0),

  /** Number of pending tasks */
  pendingTasks: z.number().int().min(0),

  /** Number of currently running tasks */
  runningTasks: z.number().int().min(0),

  /** ISO 8601 timestamp when metrics were calculated */
  timestamp: z.string().datetime(),

  /** Date range for which these metrics apply */
  period: DateRangeSchema
}).strict();

/**
 * KPI data schema for summary cards
 * Single key performance indicator with change tracking
 */
export const KPIDataSchema = z.object({
  /** Numeric value of the KPI */
  value: z.number(),

  /** Percentage change from previous period (-100 to Infinity) */
  change: z.number(),

  /** Trend direction for visual indication */
  trend: z.nativeEnum(TrendDirection),

  /** Human-readable label for the KPI */
  label: z.string().min(1).max(100),

  /** Optional unit of measurement (e.g., '%', 'tasks', 'hours') */
  unit: z.string().max(20).optional(),

  /** Optional description providing context */
  description: z.string().max(200).optional()
}).strict();

/**
 * Dataset configuration for chart rendering
 * Defines a single data series with styling options
 */
export const DatasetSchema = z.object({
  /** Dataset label for legend */
  label: z.string().min(1).max(100),

  /** Array of numeric data points */
  data: z.array(z.number()),

  /** Optional color for the dataset (hex, rgb, or named color) */
  color: z.string().max(50).optional(),

  /** Optional background color for filled areas */
  backgroundColor: z.string().max(50).optional(),

  /** Optional border color */
  borderColor: z.string().max(50).optional()
}).strict();

/**
 * Chart metadata for display configuration
 * Additional settings for chart rendering and interaction
 */
export const ChartMetadataSchema = z.object({
  /** Chart title */
  title: z.string().max(200).optional(),

  /** X-axis label */
  xAxisLabel: z.string().max(100).optional(),

  /** Y-axis label */
  yAxisLabel: z.string().max(100).optional(),

  /** Whether to show legend */
  showLegend: z.boolean().default(true),

  /** Whether to enable tooltips */
  showTooltips: z.boolean().default(true),

  /** Chart type hint (e.g., 'line', 'bar', 'area') */
  chartType: z.enum(['line', 'bar', 'area', 'pie', 'doughnut']).optional()
}).strict();

/**
 * Chart data schema for visualization components
 * Complete chart configuration with labels, datasets, and metadata
 */
export const ChartDataSchema = z.object({
  /** Array of labels for x-axis or categories */
  labels: z.array(z.string()),

  /** Array of datasets to display */
  datasets: z.array(DatasetSchema).min(1, 'At least one dataset required'),

  /** Optional metadata for chart configuration */
  metadata: ChartMetadataSchema.optional()
}).strict();

/**
 * Time series data point schema for trend analysis
 * Single data point in a time-ordered sequence
 */
export const TimeSeriesDataSchema = z.object({
  /** ISO 8601 timestamp for the data point */
  timestamp: z.string().datetime(),

  /** Numeric value at this timestamp */
  value: z.number(),

  /** Optional category or metric name for grouping */
  category: z.string().max(100).optional(),

  /** Optional additional metadata for the data point */
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional()
}).strict();

/**
 * Analytics filter schema for query parameters
 * Comprehensive filtering options for analytics queries
 */
export const AnalyticsFilterSchema = z.object({
  /** Date range for filtering data */
  dateRange: DateRangeSchema,

  /** Time grouping for aggregation */
  groupBy: z.nativeEnum(GroupByOption).default(GroupByOption.DAY),

  /** Specific metrics to include in response */
  metrics: z.array(z.nativeEnum(MetricType)).min(1, 'At least one metric required').optional(),

  /** Optional project ID filter */
  projectId: z.string().uuid('Invalid project ID format').optional(),

  /** Optional user ID filter */
  userId: z.string().uuid('Invalid user ID format').optional(),

  /** Optional tags to filter by */
  tags: z.array(z.string().max(50)).max(10, 'Maximum 10 tags allowed').optional()
}).strict();

/**
 * Analytics query response schema
 * Complete analytics data including metrics, charts, and KPIs
 */
export const AnalyticsResponseSchema = z.object({
  /** Performance metrics for the requested period */
  metrics: PerformanceMetricsSchema,

  /** Array of KPI summaries */
  kpis: z.array(KPIDataSchema),

  /** Chart data for visualizations */
  charts: z.record(z.string(), ChartDataSchema),

  /** Time series data for trend analysis */
  timeSeries: z.array(TimeSeriesDataSchema),

  /** ISO 8601 timestamp when data was generated */
  generatedAt: z.string().datetime()
}).strict();

// Type exports for TypeScript usage
export type DateRange = z.infer<typeof DateRangeSchema>;
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;
export type KPIData = z.infer<typeof KPIDataSchema>;
export type Dataset = z.infer<typeof DatasetSchema>;
export type ChartMetadata = z.infer<typeof ChartMetadataSchema>;
export type ChartData = z.infer<typeof ChartDataSchema>;
export type TimeSeriesData = z.infer<typeof TimeSeriesDataSchema>;
export type AnalyticsFilter = z.infer<typeof AnalyticsFilterSchema>;
export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>;

/**
 * Validation helper functions for runtime type checking
 * Provides fail-fast validation with detailed error messages
 */
export const validateDateRange = (data: unknown) => {
  return DateRangeSchema.parse(data);
};

export const validatePerformanceMetrics = (data: unknown) => {
  return PerformanceMetricsSchema.parse(data);
};

export const validateKPIData = (data: unknown) => {
  return KPIDataSchema.parse(data);
};

export const validateChartData = (data: unknown) => {
  return ChartDataSchema.parse(data);
};

export const validateTimeSeriesData = (data: unknown) => {
  return TimeSeriesDataSchema.parse(data);
};

export const validateAnalyticsFilter = (data: unknown) => {
  return AnalyticsFilterSchema.parse(data);
};

export const validateAnalyticsResponse = (data: unknown) => {
  return AnalyticsResponseSchema.parse(data);
};

/**
 * Safe parsing functions that return results instead of throwing
 * Useful for optional validation scenarios
 */
export const safeParseDateRange = (data: unknown) => {
  return DateRangeSchema.safeParse(data);
};

export const safeParsePerformanceMetrics = (data: unknown) => {
  return PerformanceMetricsSchema.safeParse(data);
};

export const safeParseAnalyticsFilter = (data: unknown) => {
  return AnalyticsFilterSchema.safeParse(data);
};