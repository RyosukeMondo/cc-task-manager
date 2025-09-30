import { z } from 'zod';

/**
 * Time-series data point for trend visualization
 * Used to display metrics over time with timestamp-based grouping
 */
export const TimeSeriesDataSchema = z.object({
  /** ISO 8601 timestamp for the data point */
  timestamp: z.string().datetime(),
  /** Numeric value of the metric at this time point */
  value: z.number(),
  /** Category or metric type for this data point */
  category: z.string(),
  /** Optional label for display purposes */
  label: z.string().optional(),
});

export type TimeSeriesData = z.infer<typeof TimeSeriesDataSchema>;

/**
 * Trend direction indicator schema
 * Used to show if a metric is increasing, decreasing, or staying stable
 */
export const TrendDirectionSchema = z.enum(['up', 'down', 'stable']);
export type TrendDirectionType = z.infer<typeof TrendDirectionSchema>;

/**
 * Trend direction enum values
 * Use these constants for type-safe trend direction assignment
 */
export const TrendDirection = {
  UP: 'up' as TrendDirectionType,
  DOWN: 'down' as TrendDirectionType,
  STABLE: 'stable' as TrendDirectionType,
};

/**
 * Period-over-period comparison schema
 * Compares current period metrics against previous period
 */
export const TrendComparisonSchema = z.object({
  /** Current period value */
  currentValue: z.number(),
  /** Previous period value for comparison */
  previousValue: z.number(),
  /** Percentage change between periods (can be negative) */
  percentageChange: z.number(),
  /** Direction of the trend */
  direction: z.enum(['up', 'down', 'stable']),
  /** Label for the comparison period (e.g., "vs last week") */
  periodLabel: z.string(),
});

export type TrendComparison = z.infer<typeof TrendComparisonSchema>;

/**
 * Time period grouping options for analytics filters
 */
export const TimePeriodSchema = z.enum(['day', 'week', 'month']);
export type TimePeriod = z.infer<typeof TimePeriodSchema>;

/**
 * Analytics filter schema with time period grouping support
 * Used to filter and aggregate metrics by time periods
 */
export const AnalyticsFilterSchema = z.object({
  /** Time period for grouping data (day/week/month) */
  groupBy: TimePeriodSchema,
  /** Start date for the filter range (ISO 8601) */
  startDate: z.string().datetime(),
  /** End date for the filter range (ISO 8601) */
  endDate: z.string().datetime(),
  /** Optional metric categories to filter */
  categories: z.array(z.string()).optional(),
  /** Optional user ID filter for user-specific analytics */
  userId: z.string().optional(),
});

export type AnalyticsFilter = z.infer<typeof AnalyticsFilterSchema>;

/**
 * Aggregated metric data with trend information
 */
export const AggregatedMetricSchema = z.object({
  /** Metric identifier */
  metricId: z.string(),
  /** Display name for the metric */
  name: z.string(),
  /** Time-series data points */
  timeSeries: z.array(TimeSeriesDataSchema),
  /** Period-over-period comparison */
  comparison: TrendComparisonSchema.optional(),
  /** Total value for the period */
  total: z.number(),
  /** Average value for the period */
  average: z.number(),
});

export type AggregatedMetric = z.infer<typeof AggregatedMetricSchema>;

/**
 * Complete analytics response with trend data
 */
export const AnalyticsTrendResponseSchema = z.object({
  /** Filtered and aggregated metrics */
  metrics: z.array(AggregatedMetricSchema),
  /** Applied filter parameters */
  filter: AnalyticsFilterSchema,
  /** Timestamp when the data was generated */
  generatedAt: z.string().datetime(),
});

export type AnalyticsTrendResponse = z.infer<typeof AnalyticsTrendResponseSchema>;

/**
 * KPI (Key Performance Indicator) data schema
 * Used to display summary metrics with trend information
 */
export const KPIDataSchema = z.object({
  /** Label/name of the KPI */
  label: z.string(),
  /** Numeric value of the KPI */
  value: z.number(),
  /** Percentage change from previous period */
  change: z.number(),
  /** Trend direction (up, down, or stable) */
  trend: z.enum(['up', 'down', 'stable']),
  /** Unit of measurement (e.g., '%', 'h', '/h') */
  unit: z.string().optional(),
  /** Optional description of the KPI */
  description: z.string().optional(),
});

export type KPIData = z.infer<typeof KPIDataSchema>;

/**
 * Chart dataset schema for visualization
 * Matches Chart.js dataset structure
 */
export const ChartDatasetSchema = z.object({
  /** Dataset label */
  label: z.string(),
  /** Data values */
  data: z.array(z.number()),
  /** Border color */
  borderColor: z.string().optional(),
  /** Background color */
  backgroundColor: z.string().optional(),
  /** Line tension for line charts */
  tension: z.number().optional(),
  /** Other chart.js properties */
}).passthrough();

/**
 * Chart metadata schema for customizing chart display
 * Provides configuration for titles, labels, and display options
 */
export const ChartMetadataSchema = z.object({
  /** Chart title */
  title: z.string().optional(),
  /** X-axis label */
  xAxisLabel: z.string().optional(),
  /** Y-axis label */
  yAxisLabel: z.string().optional(),
  /** Whether to show legend */
  showLegend: z.boolean().optional(),
  /** Whether to show tooltips */
  showTooltips: z.boolean().optional(),
}).optional();

export type ChartMetadata = z.infer<typeof ChartMetadataSchema>;

/**
 * Chart data schema for analytics visualizations
 * Compatible with Chart.js data structure with optional metadata
 */
export const ChartDataSchema = z.object({
  /** X-axis labels */
  labels: z.array(z.string()),
  /** Chart datasets */
  datasets: z.array(ChartDatasetSchema),
  /** Optional metadata for chart customization */
  metadata: ChartMetadataSchema,
});

export type ChartData = z.infer<typeof ChartDataSchema>;

/**
 * Performance metrics schema
 * Contains key performance indicators for task execution
 */
export const PerformanceMetricsSchema = z.object({
  /** Task completion rate as percentage (0-100) */
  completionRate: z.number().min(0).max(100),
  /** Average time to complete tasks in seconds */
  averageCompletionTime: z.number().min(0),
  /** Number of tasks completed per hour */
  throughput: z.number().min(0),
  /** Overall efficiency percentage (0-100) */
  efficiency: z.number().min(0).max(100),
  /** Optional chart data for visualizations */
  charts: z.record(z.string(), ChartDataSchema).optional(),
});

export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;