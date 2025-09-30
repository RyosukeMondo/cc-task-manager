/**
 * Analytics type re-exports from shared schemas
 *
 * This file imports and re-exports all analytics-related types from the shared schemas package
 * to ensure frontend-backend consistency for analytics data structures.
 */

export type {
  PerformanceMetrics,
  KPIData,
  ChartData,
  TimeSeriesData,
  DateRange,
  AnalyticsFilter,
} from '@cc-task-manager/schemas';