import { z } from 'zod';

/**
 * Trend direction enumeration for KPI data
 * Indicates the direction of change in performance metrics
 */
export enum TrendDirection {
  UP = 'UP',
  DOWN = 'DOWN',
  STABLE = 'STABLE'
}

/**
 * Group by options for analytics filtering
 * Defines supported time-based aggregation options
 */
export enum GroupByOption {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR'
}

/**
 * Performance metrics schema for task analytics
 * Comprehensive schema for tracking task completion and performance metrics
 *
 * @property completionRate - Percentage of tasks completed successfully (0-1)
 * @property averageCompletionTime - Mean time to complete tasks in milliseconds
 * @property throughput - Number of tasks completed per unit time (tasks/day)
 * @property efficiency - Ratio of actual to estimated completion time (0-1)
 * @property taskVelocity - Rate of task completion trend over time
 * @property totalTasks - Total number of tasks in the analysis period
 * @property completedTasks - Number of successfully completed tasks
 * @property failedTasks - Number of failed tasks
 * @property pendingTasks - Number of tasks awaiting execution
 * @property cancelledTasks - Number of cancelled tasks
 * @property timestamp - ISO 8601 timestamp when metrics were calculated
 */
export const PerformanceMetricsSchema = z.object({
  completionRate: z.number().min(0).max(1),
  averageCompletionTime: z.number().min(0).nullable(),
  throughput: z.number().min(0),
  efficiency: z.number().min(0).max(1).nullable(),
  taskVelocity: z.number().nullable(),
  totalTasks: z.number().int().min(0),
  completedTasks: z.number().int().min(0),
  failedTasks: z.number().int().min(0),
  pendingTasks: z.number().int().min(0),
  cancelledTasks: z.number().int().min(0),
  timestamp: z.string().datetime()
}).strict();

/**
 * KPI data schema for key performance indicators
 * Represents a single KPI metric with trend information
 *
 * @property value - Current numeric value of the KPI
 * @property change - Percentage change from previous period (-1 to 1)
 * @property trend - Direction of change (UP, DOWN, STABLE)
 * @property label - Human-readable label for the KPI
 * @property unit - Unit of measurement (e.g., "tasks", "hours", "%")
 * @property previousValue - Previous period value for comparison (optional)
 */
export const KPIDataSchema = z.object({
  value: z.number(),
  change: z.number().min(-1).max(1),
  trend: z.nativeEnum(TrendDirection),
  label: z.string().min(1).max(100),
  unit: z.string().max(20).optional(),
  previousValue: z.number().optional()
}).strict();

/**
 * Chart dataset schema for chart data
 * Represents a single data series in a chart
 *
 * @property label - Name of the data series
 * @property data - Array of numeric values for the series
 * @property backgroundColor - Fill color for the series (CSS color)
 * @property borderColor - Border color for the series (CSS color)
 * @property borderWidth - Width of the border line in pixels
 */
export const ChartDatasetSchema = z.object({
  label: z.string(),
  data: z.array(z.number()),
  backgroundColor: z.string().optional(),
  borderColor: z.string().optional(),
  borderWidth: z.number().min(0).optional()
}).strict();

/**
 * Chart data schema for visualization components
 * Complete chart configuration with labels and datasets
 *
 * @property labels - Array of x-axis labels (dates, categories, etc.)
 * @property datasets - Array of data series to display
 * @property metadata - Optional chart configuration (title, axes labels, etc.)
 */
export const ChartDataSchema = z.object({
  labels: z.array(z.string()),
  datasets: z.array(ChartDatasetSchema),
  metadata: z.record(z.any()).optional()
}).strict();

/**
 * Time series data point schema
 * Single data point in a time-based series
 *
 * @property timestamp - ISO 8601 timestamp for the data point
 * @property value - Numeric value at this timestamp
 * @property category - Optional category label for the data point
 * @property metadata - Optional additional data for the point
 */
export const TimeSeriesDataSchema = z.object({
  timestamp: z.string().datetime(),
  value: z.number(),
  category: z.string().max(50).optional(),
  metadata: z.record(z.any()).optional()
}).strict();

/**
 * Date range schema for filtering analytics data
 * Validates date range with business rules
 *
 * @property startDate - ISO 8601 start date (inclusive)
 * @property endDate - ISO 8601 end date (inclusive)
 */
export const DateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime()
}).strict().refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return start <= end;
  },
  {
    message: 'Start date must be before or equal to end date',
    path: ['endDate']
  }
).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const diffInDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return diffInDays <= 365;
  },
  {
    message: 'Date range cannot exceed 365 days',
    path: ['endDate']
  }
);

/**
 * Analytics filter schema for querying performance data
 * Comprehensive filtering options for analytics queries
 *
 * @property dateRange - Time period for the analytics query
 * @property groupBy - Time-based aggregation option
 * @property metrics - Specific metrics to include in the response
 * @property projectId - Filter by specific project (optional)
 * @property userId - Filter by specific user (optional)
 * @property tags - Filter by task tags (optional)
 */
export const AnalyticsFilterSchema = z.object({
  dateRange: DateRangeSchema,
  groupBy: z.nativeEnum(GroupByOption).default(GroupByOption.DAY),
  metrics: z.array(z.string()).min(1).max(20).optional(),
  projectId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  tags: z.array(z.string().max(50)).max(10).optional()
}).strict();

/**
 * Analytics response schema for API responses
 * Complete analytics data structure with metrics and charts
 *
 * @property performanceMetrics - Current performance metrics
 * @property kpis - Array of key performance indicators
 * @property chartData - Chart data for visualization
 * @property timeSeries - Time-based data points
 * @property generatedAt - ISO 8601 timestamp when the analytics were generated
 */
export const AnalyticsResponseSchema = z.object({
  performanceMetrics: PerformanceMetricsSchema,
  kpis: z.array(KPIDataSchema),
  chartData: ChartDataSchema.optional(),
  timeSeries: z.array(TimeSeriesDataSchema).optional(),
  generatedAt: z.string().datetime()
}).strict();

// Type exports for TypeScript usage
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;
export type KPIData = z.infer<typeof KPIDataSchema>;
export type ChartDataset = z.infer<typeof ChartDatasetSchema>;
export type ChartData = z.infer<typeof ChartDataSchema>;
export type TimeSeriesData = z.infer<typeof TimeSeriesDataSchema>;
export type DateRange = z.infer<typeof DateRangeSchema>;
export type AnalyticsFilter = z.infer<typeof AnalyticsFilterSchema>;
export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>;

/**
 * Validation helper functions for runtime type checking
 * Provides fail-fast validation with detailed error messages
 */
export const validatePerformanceMetrics = (data: unknown): PerformanceMetrics => {
  return PerformanceMetricsSchema.parse(data);
};

export const validateKPIData = (data: unknown): KPIData => {
  return KPIDataSchema.parse(data);
};

export const validateChartData = (data: unknown): ChartData => {
  return ChartDataSchema.parse(data);
};

export const validateTimeSeriesData = (data: unknown): TimeSeriesData => {
  return TimeSeriesDataSchema.parse(data);
};

export const validateDateRange = (data: unknown): DateRange => {
  return DateRangeSchema.parse(data);
};

export const validateAnalyticsFilter = (data: unknown): AnalyticsFilter => {
  return AnalyticsFilterSchema.parse(data);
};

export const validateAnalyticsResponse = (data: unknown): AnalyticsResponse => {
  return AnalyticsResponseSchema.parse(data);
};

/**
 * Safe parsing functions that return results instead of throwing
 * Useful for optional validation scenarios
 */
export const safeParsePerformanceMetrics = (data: unknown) => {
  return PerformanceMetricsSchema.safeParse(data);
};

export const safeParseKPIData = (data: unknown) => {
  return KPIDataSchema.safeParse(data);
};

export const safeParseChartData = (data: unknown) => {
  return ChartDataSchema.safeParse(data);
};

export const safeParseTimeSeriesData = (data: unknown) => {
  return TimeSeriesDataSchema.safeParse(data);
};

export const safeParseDateRange = (data: unknown) => {
  return DateRangeSchema.safeParse(data);
};

export const safeParseAnalyticsFilter = (data: unknown) => {
  return AnalyticsFilterSchema.safeParse(data);
};

export const safeParseAnalyticsResponse = (data: unknown) => {
  return AnalyticsResponseSchema.safeParse(data);
};