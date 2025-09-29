import { IBaseRepository } from './base-repository.interface';

/**
 * Execution Log Repository Interface
 * Extends base repository with logging-specific operations
 * Following Interface Segregation Principle for focused interfaces
 */
export interface IExecutionLogRepository extends IBaseRepository<ExecutionLogEntity> {
  /**
   * Find logs by execution ID
   */
  findByExecutionId(executionId: string): Promise<ExecutionLogEntity[]>;

  /**
   * Find logs by log level
   */
  findByLevel(level: LogLevel): Promise<ExecutionLogEntity[]>;

  /**
   * Find logs by log source
   */
  findBySource(source: LogSource): Promise<ExecutionLogEntity[]>;

  /**
   * Find logs by component
   */
  findByComponent(component: string): Promise<ExecutionLogEntity[]>;

  /**
   * Find logs by correlation ID (for distributed tracing)
   */
  findByCorrelationId(correlationId: string): Promise<ExecutionLogEntity[]>;

  /**
   * Find logs within time range
   */
  findByTimeRange(fromDate: Date, toDate: Date): Promise<ExecutionLogEntity[]>;

  /**
   * Find error logs (WARN, ERROR, FATAL levels)
   */
  findErrorLogs(options?: { executionId?: string; fromDate?: Date; toDate?: Date }): Promise<ExecutionLogEntity[]>;

  /**
   * Find logs with pagination for monitoring dashboards
   */
  findWithPagination(options: {
    page: number;
    limit: number;
    executionId?: string;
    level?: LogLevel;
    source?: LogSource;
    component?: string;
    fromDate?: Date;
    toDate?: Date;
    searchText?: string;
  }): Promise<PaginatedLogs>;

  /**
   * Search logs by message content
   */
  searchLogs(searchText: string, options?: {
    executionId?: string;
    level?: LogLevel;
    source?: LogSource;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  }): Promise<ExecutionLogEntity[]>;

  /**
   * Get log statistics by execution
   */
  getLogStatsByExecution(executionId: string): Promise<LogStatistics>;

  /**
   * Get log statistics by component
   */
  getLogStatsByComponent(component: string, fromDate?: Date, toDate?: Date): Promise<LogStatistics>;

  /**
   * Get error analysis for troubleshooting
   */
  getErrorAnalysis(options?: {
    executionId?: string;
    component?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<ErrorAnalysis>;

  /**
   * Get log volume metrics for monitoring
   */
  getLogVolumeMetrics(options?: {
    granularity: 'hour' | 'day' | 'week';
    fromDate?: Date;
    toDate?: Date;
  }): Promise<LogVolumeMetrics>;

  /**
   * Clean up logs older than specified date
   */
  cleanupOldLogs(beforeDate: Date, keepErrorLogs?: boolean): Promise<number>;

  /**
   * Archive logs to external storage
   */
  archiveLogs(beforeDate: Date): Promise<ArchiveResult>;

  /**
   * Bulk insert logs for high-throughput scenarios
   */
  bulkInsert(logs: Omit<ExecutionLogEntity, 'id' | 'timestamp'>[]): Promise<ExecutionLogEntity[]>;

  /**
   * Get recent logs for real-time monitoring
   */
  getRecentLogs(options?: {
    executionId?: string;
    level?: LogLevel;
    source?: LogSource;
    limit?: number;
    sinceTimestamp?: Date;
  }): Promise<ExecutionLogEntity[]>;

  /**
   * Get log context around a specific log entry
   */
  getLogContext(logId: string, contextLines?: number): Promise<LogContext>;

  /**
   * Aggregate logs by patterns for analytics
   */
  aggregateLogPatterns(options?: {
    executionId?: string;
    component?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<LogPatternAggregation[]>;
}

/**
 * Execution Log Entity interface aligned with Prisma model
 */
export interface ExecutionLogEntity {
  id: string;
  executionId: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  details: any | null; // JSON structured log data
  component: string | null;
  operation: string | null;
  correlationId: string | null;
  timestamp: Date;

  // Optional relationships for optimized queries
  execution?: {
    id: string;
    taskId: string;
    status: string;
    workerId: string | null;
  };
}

/**
 * Log Level enumeration matching Prisma schema
 */
export enum LogLevel {
  TRACE = 'TRACE',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

/**
 * Log Source enumeration matching Prisma schema
 */
export enum LogSource {
  SYSTEM = 'SYSTEM',
  CLAUDE = 'CLAUDE',
  USER = 'USER',
  QUEUE = 'QUEUE',
  WORKER = 'WORKER',
  DATABASE = 'DATABASE',
}

/**
 * Paginated Logs interface for efficient pagination
 */
export interface PaginatedLogs {
  logs: ExecutionLogEntity[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Log Statistics interface
 */
export interface LogStatistics {
  total: number;
  trace: number;
  debug: number;
  info: number;
  warn: number;
  error: number;
  fatal: number;
  bySource: {
    [source: string]: number;
  };
  byComponent: {
    [component: string]: number;
  };
  timeRange: {
    earliest: Date | null;
    latest: Date | null;
  };
  errorRate: number; // percentage of logs that are error/warn/fatal
}

/**
 * Error Analysis interface for troubleshooting
 */
export interface ErrorAnalysis {
  totalErrors: number;
  errorsByLevel: {
    [level: string]: number;
  };
  errorsByComponent: {
    [component: string]: number;
  };
  errorsByOperation: {
    [operation: string]: number;
  };
  commonErrorPatterns: {
    pattern: string;
    count: number;
    examples: string[];
  }[];
  errorTimeline: {
    timestamp: Date;
    count: number;
    level: LogLevel;
  }[];
  correlatedErrors: {
    correlationId: string;
    errorCount: number;
    timeSpan: number; // milliseconds
  }[];
}

/**
 * Log Volume Metrics interface for monitoring
 */
export interface LogVolumeMetrics {
  granularity: 'hour' | 'day' | 'week';
  timeSeries: {
    timestamp: Date;
    count: number;
    errorCount: number;
    warnCount: number;
  }[];
  summary: {
    totalLogs: number;
    totalErrors: number;
    averageLogsPerPeriod: number;
    peakLogsPerPeriod: number;
    errorRate: number;
  };
}

/**
 * Archive Result interface
 */
export interface ArchiveResult {
  archivedCount: number;
  archiveLocation: string;
  archiveSize: number; // bytes
  archivedTimeRange: {
    from: Date;
    to: Date;
  };
}

/**
 * Log Context interface for viewing surrounding logs
 */
export interface LogContext {
  targetLog: ExecutionLogEntity;
  beforeLogs: ExecutionLogEntity[];
  afterLogs: ExecutionLogEntity[];
  contextMetadata: {
    totalContext: number;
    beforeCount: number;
    afterCount: number;
  };
}

/**
 * Log Pattern Aggregation interface for analytics
 */
export interface LogPatternAggregation {
  pattern: string;
  count: number;
  level: LogLevel;
  source: LogSource;
  component: string | null;
  examples: {
    message: string;
    timestamp: Date;
    details: any;
  }[];
  frequency: {
    hourly: number;
    daily: number;
    weekly: number;
  };
}