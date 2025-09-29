import { IBaseRepository } from './base-repository.interface';

/**
 * Task Execution Repository Interface
 * Extends base repository with execution-specific operations
 * Following Interface Segregation Principle for focused interfaces
 */
export interface ITaskExecutionRepository extends IBaseRepository<TaskExecutionEntity> {
  /**
   * Find task executions by Claude task ID
   */
  findByTaskId(taskId: string): Promise<TaskExecutionEntity[]>;

  /**
   * Find task executions by status
   */
  findByStatus(status: ExecutionStatus): Promise<TaskExecutionEntity[]>;

  /**
   * Find task executions by multiple statuses
   */
  findByStatuses(statuses: ExecutionStatus[]): Promise<TaskExecutionEntity[]>;

  /**
   * Find active executions (running or initializing)
   */
  findActiveExecutions(): Promise<TaskExecutionEntity[]>;

  /**
   * Find executions by worker ID
   */
  findByWorkerId(workerId: string): Promise<TaskExecutionEntity[]>;

  /**
   * Find executions by session ID
   */
  findBySessionId(sessionId: string): Promise<TaskExecutionEntity[]>;

  /**
   * Find executions requiring heartbeat check
   */
  findStaleExecutions(heartbeatThreshold: Date): Promise<TaskExecutionEntity[]>;

  /**
   * Find executions with logs included
   */
  findWithLogs(options?: { taskId?: string; status?: ExecutionStatus }): Promise<TaskExecutionEntity[]>;

  /**
   * Find executions with metrics included
   */
  findWithMetrics(options?: { taskId?: string; status?: ExecutionStatus }): Promise<TaskExecutionEntity[]>;

  /**
   * Update execution status with timestamp management
   */
  updateStatus(id: string, status: ExecutionStatus): Promise<TaskExecutionEntity>;

  /**
   * Update execution progress
   */
  updateProgress(id: string, progress: number): Promise<TaskExecutionEntity>;

  /**
   * Update execution heartbeat
   */
  updateHeartbeat(id: string): Promise<TaskExecutionEntity>;

  /**
   * Start execution (set status to RUNNING with timestamp)
   */
  startExecution(id: string, workerId?: string, processId?: string): Promise<TaskExecutionEntity>;

  /**
   * Complete execution (set status to COMPLETED with timestamp)
   */
  completeExecution(id: string): Promise<TaskExecutionEntity>;

  /**
   * Fail execution (set status to FAILED with error details)
   */
  failExecution(id: string, errorMessage?: string, errorCode?: string, stackTrace?: string): Promise<TaskExecutionEntity>;

  /**
   * Cancel execution (set status to CANCELLED)
   */
  cancelExecution(id: string): Promise<TaskExecutionEntity>;

  /**
   * Pause execution (set status to PAUSED)
   */
  pauseExecution(id: string): Promise<TaskExecutionEntity>;

  /**
   * Resume execution (set status to RUNNING)
   */
  resumeExecution(id: string): Promise<TaskExecutionEntity>;

  /**
   * Get execution statistics by task
   */
  getExecutionStatsByTask(taskId: string): Promise<ExecutionStatistics>;

  /**
   * Get execution statistics by worker
   */
  getExecutionStatsByWorker(workerId: string): Promise<ExecutionStatistics>;

  /**
   * Get resource usage metrics
   */
  getResourceUsageMetrics(options?: { taskId?: string; workerId?: string; fromDate?: Date; toDate?: Date }): Promise<ResourceUsageMetrics>;

  /**
   * Get performance metrics for monitoring
   */
  getPerformanceMetrics(options?: { fromDate?: Date; toDate?: Date }): Promise<ExecutionPerformanceMetrics>;
}

/**
 * Task Execution Entity interface aligned with Prisma model
 */
export interface TaskExecutionEntity {
  id: string;
  taskId: string;
  status: ExecutionStatus;
  progress: number | null;
  workerId: string | null;
  processId: string | null;
  sessionId: string | null;
  cpuUsage: number | null;
  memoryUsage: number | null;
  diskUsage: number | null;
  errorMessage: string | null;
  errorCode: string | null;
  stackTrace: string | null;
  retryCount: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  lastHeartbeat: Date | null;

  // Optional relationships for optimized queries
  task?: {
    id: string;
    title: string;
    status: string;
  };
  logs?: ExecutionLogEntity[];
  metrics?: SystemMetricEntity[];
}

/**
 * Execution Status enumeration matching Prisma schema
 */
export enum ExecutionStatus {
  INITIALIZING = 'INITIALIZING',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  TIMEOUT = 'TIMEOUT',
}

/**
 * Execution Statistics interface
 */
export interface ExecutionStatistics {
  total: number;
  initializing: number;
  starting: number;
  running: number;
  paused: number;
  completed: number;
  failed: number;
  cancelled: number;
  timeout: number;
  averageRetryCount: number;
  successRate: number; // percentage (0-100)
}

/**
 * Resource Usage Metrics interface
 */
export interface ResourceUsageMetrics {
  averageCpuUsage: number | null;
  peakCpuUsage: number | null;
  averageMemoryUsage: number | null; // bytes
  peakMemoryUsage: number | null; // bytes
  averageDiskUsage: number | null; // bytes
  peakDiskUsage: number | null; // bytes
  totalExecutions: number;
}

/**
 * Execution Performance Metrics interface
 */
export interface ExecutionPerformanceMetrics {
  totalExecutions: number;
  successRate: number;
  averageDuration: number | null; // seconds
  medianDuration: number | null; // seconds
  shortestDuration: number | null; // seconds
  longestDuration: number | null; // seconds
  averageRetryCount: number;
  failureReasons: {
    [reason: string]: number;
  };
  resourceEfficiency: {
    avgCpuUtilization: number | null;
    avgMemoryUtilization: number | null;
    avgDiskUtilization: number | null;
  };
}

/**
 * Basic Execution Log Entity for relationships
 */
export interface ExecutionLogEntity {
  id: string;
  executionId: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  details: any | null;
  component: string | null;
  operation: string | null;
  correlationId: string | null;
  timestamp: Date;
}

/**
 * Basic System Metric Entity for relationships
 */
export interface SystemMetricEntity {
  id: string;
  executionId: string | null;
  metricType: MetricType;
  metricName: string;
  value: number;
  unit: string | null;
  workerId: string | null;
  queueName: string | null;
  tags: any | null;
  timestamp: Date;
}

/**
 * Log Level enumeration
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
 * Log Source enumeration
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
 * Metric Type enumeration
 */
export enum MetricType {
  COUNTER = 'COUNTER',
  GAUGE = 'GAUGE',
  HISTOGRAM = 'HISTOGRAM',
  SUMMARY = 'SUMMARY',
  TIMER = 'TIMER',
}