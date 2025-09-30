/**
 * Analytics types re-exported from shared schemas
 * All analytics types are imported from @cc-task-manager/schemas to ensure
 * contract-first development and type consistency across frontend and backend.
 */

// Time-series and trend types
export type {
  TimeSeriesData,
  TrendDirectionType,
  TrendComparison,
  TimePeriod,
  AnalyticsFilter,
  AggregatedMetric,
  AnalyticsTrendResponse,
  KPIData,
  ChartData,
  PerformanceMetrics,
} from '@cc-task-manager/schemas';

// Re-export TrendDirection enum for value usage
export {
  TrendDirection,
} from '@cc-task-manager/schemas';

// Re-export schemas for runtime validation if needed
export {
  TimeSeriesDataSchema,
  TrendDirectionSchema,
  TrendComparisonSchema,
  TimePeriodSchema,
  AnalyticsFilterSchema,
  AggregatedMetricSchema,
  AnalyticsTrendResponseSchema,
  KPIDataSchema,
  ChartDataSchema,
  PerformanceMetricsSchema,
} from '@cc-task-manager/schemas';