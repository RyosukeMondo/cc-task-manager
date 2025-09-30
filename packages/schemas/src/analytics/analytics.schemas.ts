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
 * Trend direction indicator
 */
export const TrendDirectionSchema = z.enum(['up', 'down', 'stable']);
export type TrendDirection = z.infer<typeof TrendDirectionSchema>;

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
  direction: TrendDirectionSchema,
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