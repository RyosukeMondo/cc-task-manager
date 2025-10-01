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
 * Date range schema for time-based filtering
 * Used to specify start and end dates for analytics queries
 */
export const DateRangeSchema = z.object({
  /** Start date (ISO 8601) */
  startDate: z.string().datetime(),
  /** End date (ISO 8601) */
  endDate: z.string().datetime(),
});

export type DateRange = z.infer<typeof DateRangeSchema>;

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
/**
 * Complete analytics response schema
 * Combines metrics, KPIs, and charts for comprehensive analytics display
 */
export const AnalyticsResponseSchema = z.object({
  /** Key Performance Indicators */
  kpis: z.array(KPIDataSchema).optional(),
  /** Performance metrics */
  metrics: PerformanceMetricsSchema.optional(),
  /** Chart data for visualizations */
  charts: z.record(z.string(), ChartDataSchema).optional(),
  /** Time-series trend data */
  trends: AnalyticsTrendResponseSchema.optional(),
  /** Date range for the analytics data */
  dateRange: DateRangeSchema.optional(),
  /** Timestamp when the analytics were generated */
  generatedAt: z.string().datetime().optional(),
});

export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>;

/**
 * Group by period enumeration for trend analysis (backend-analytics-api spec)
 * Defines supported time-series grouping intervals
 */
export enum GroupByPeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month'
}

/**
 * Base analytics filter schema (backend-analytics-api spec)
 * Base object without refinement for extending
 */
const baseAnalyticsFilterSchema = z.object({
  startDate: z.string().datetime('Invalid datetime format').optional(),
  endDate: z.string().datetime('Invalid datetime format').optional(),
}).strict();

/**
 * Analytics filter schema for date range queries (backend-analytics-api spec)
 * Validates date range parameters with start <= end constraint
 */
export const analyticsFilterSchema = baseAnalyticsFilterSchema.refine(
  (data) => {
    // Validate startDate <= endDate if both are provided
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return start <= end;
    }
    return true;
  },
  {
    message: 'Start date must be less than or equal to end date',
    path: ['startDate']
  }
);

/**
 * Trend filter schema for time-series analysis (backend-analytics-api spec)
 * Extends analytics filter with groupBy parameter
 */
export const trendFilterSchema = baseAnalyticsFilterSchema.extend({
  groupBy: z.nativeEnum(GroupByPeriod).default(GroupByPeriod.DAY)
}).strict().refine(
  (data) => {
    // Validate startDate <= endDate if both are provided
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return start <= end;
    }
    return true;
  },
  {
    message: 'Start date must be less than or equal to end date',
    path: ['startDate']
  }
);

/**
 * Performance metrics schema for aggregate analytics (backend-analytics-api spec)
 * Contains calculated metrics for task performance over a period
 */
export const performanceMetricsSchema = z.object({
  completionRate: z.number().min(0).max(100),
  averageExecutionTime: z.number().min(0).nullable(),
  throughput: z.number().min(0),
  totalTasks: z.number().int().min(0),
  completedTasks: z.number().int().min(0),
  failedTasks: z.number().int().min(0),
  period: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime()
  }).strict()
}).strict();

/**
 * Trend data point schema for time-series data (backend-analytics-api spec)
 * Represents metrics for a specific time period
 */
export const trendDataPointSchema = z.object({
  period: z.string(),
  totalTasks: z.number().int().min(0),
  completedTasks: z.number().int().min(0),
  failedTasks: z.number().int().min(0),
  averageExecutionTime: z.number().min(0).nullable()
}).strict();

/**
 * Trend data response schema for trend endpoints (backend-analytics-api spec)
 * Contains array of trend data points
 */
export const trendDataSchema = z.array(trendDataPointSchema);

// Type exports for TypeScript usage (backend-analytics-api spec)
export type AnalyticsFilterDto = z.infer<typeof analyticsFilterSchema>;
export type TrendFilterDto = z.infer<typeof trendFilterSchema>;
export type PerformanceMetricsDto = z.infer<typeof performanceMetricsSchema>;
export type TrendDataPointDto = z.infer<typeof trendDataPointSchema>;
export type TrendDataResponseDto = z.infer<typeof trendDataSchema>;

/**
 * Validation helper functions for runtime type checking (backend-analytics-api spec)
 * Provides fail-fast validation with detailed error messages
 */
export const validateAnalyticsFilter = (data: unknown) => {
  return analyticsFilterSchema.parse(data);
};

export const validateTrendFilter = (data: unknown) => {
  return trendFilterSchema.parse(data);
};

export const validatePerformanceMetrics = (data: unknown) => {
  return performanceMetricsSchema.parse(data);
};

export const validateTrendData = (data: unknown) => {
  return trendDataSchema.parse(data);
};

/**
 * Safe parsing functions that return results instead of throwing (backend-analytics-api spec)
 * Useful for optional validation scenarios
 */
export const safeParseAnalyticsFilter = (data: unknown) => {
  return analyticsFilterSchema.safeParse(data);
};

export const safeParseTrendFilter = (data: unknown) => {
  return trendFilterSchema.safeParse(data);
};

export const safeParsePerformanceMetrics = (data: unknown) => {
  return performanceMetricsSchema.safeParse(data);
};

export const safeParseTrendData = (data: unknown) => {
  return trendDataSchema.safeParse(data);
};
