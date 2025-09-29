/**
 * Shared type definitions for Claude Code database entities
 * Follows SOLID principles with Interface Segregation (ISP) and Single Responsibility (SRP)
 * Serves as Single Source of Truth (SSOT) for all applications
 */

// =============================================================================
// CORE ENTITY INTERFACES - Focused interfaces following ISP
// =============================================================================

/**
 * Base interface for all Claude Code entities
 * Provides common timestamp and identification fields
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Claude task entity interface for AI-powered task execution
 * Single responsibility: Define claude task structure
 */
export interface ClaudeTask extends BaseEntity {
  title: string;
  description?: string;
  prompt: string;
  config?: Record<string, any>;
  status: ClaudeTaskStatus;
  priority: TaskPriority;

  // Foreign keys
  createdById: string;
  projectId?: string;

  // Metadata
  tags: string[];
  estimatedDuration?: number; // seconds
  actualDuration?: number; // seconds

  // Additional timestamps
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Task execution interface for individual execution attempts
 * Single responsibility: Define execution tracking structure
 */
export interface TaskExecution extends BaseEntity {
  taskId: string;
  status: ExecutionStatus;
  progress?: number; // 0.0 to 1.0
  workerId?: string;
  processId?: string;
  sessionId?: string;

  // Resource tracking
  cpuUsage?: number;
  memoryUsage?: number; // bytes
  diskUsage?: number; // bytes

  // Error handling
  errorMessage?: string;
  errorCode?: string;
  stackTrace?: string;
  retryCount: number;

  // Additional timestamps
  startedAt?: Date;
  completedAt?: Date;
  lastHeartbeat?: Date;
}

/**
 * Queue job interface for BullMQ persistence
 * Single responsibility: Define queue job structure
 */
export interface QueueJob extends BaseEntity {
  taskId: string;
  queueName: string;
  jobId: string; // BullMQ job ID
  status: QueueJobStatus;
  priority: number;
  delay?: number; // milliseconds

  // Processing configuration
  maxAttempts: number;
  backoffType: BackoffType;
  backoffDelay: number; // milliseconds

  // Data
  jobData: Record<string, any>;
  jobOptions?: Record<string, any>;
  result?: Record<string, any>;

  // Additional timestamps
  processedAt?: Date;
  finishedAt?: Date;
}

/**
 * Job attempt interface for retry mechanisms
 * Single responsibility: Define job attempt tracking
 */
export interface JobAttempt {
  id: string;
  queueJobId: string;
  attemptNumber: number;
  status: AttemptStatus;
  error?: string;
  result?: Record<string, any>;

  // Timestamps
  startedAt: Date;
  finishedAt?: Date;
}

/**
 * Execution log interface for Claude Code output storage
 * Single responsibility: Define log entry structure
 */
export interface ExecutionLog {
  id: string;
  executionId: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  details?: Record<string, any>;

  // Context
  component?: string;
  operation?: string;
  correlationId?: string;

  // Timestamp
  timestamp: Date;
}

/**
 * System metric interface for performance monitoring
 * Single responsibility: Define metric data structure
 */
export interface SystemMetric {
  id: string;
  executionId?: string;
  metricType: MetricType;
  metricName: string;
  value: number;
  unit?: string;

  // Context
  workerId?: string;
  queueName?: string;
  tags?: Record<string, any>;

  // Timestamp
  timestamp: Date;
}

/**
 * Task result interface for execution outcomes
 * Single responsibility: Define result structure
 */
export interface TaskResult extends BaseEntity {
  taskId: string;
  status: ResultStatus;
  summary?: string;
  output?: Record<string, any>;

  // Quality metrics
  executionTime?: number; // milliseconds
  tokensUsed?: number;
  costEstimate?: number;
}

/**
 * Result file interface for task output attachments
 * Single responsibility: Define file attachment structure
 */
export interface ResultFile extends BaseEntity {
  resultId: string;
  filename: string;
  contentType: string;
  size: number; // bytes
  path: string; // Storage path or URL
  checksum: string; // File integrity verification
}

// =============================================================================
// ENUMERATION TYPES - Type-safe constants
// =============================================================================

export enum ClaudeTaskStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  PAUSED = 'PAUSED'
}

export enum ExecutionStatus {
  INITIALIZING = 'INITIALIZING',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  TIMEOUT = 'TIMEOUT'
}

export enum QueueJobStatus {
  WAITING = 'WAITING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DELAYED = 'DELAYED',
  PAUSED = 'PAUSED',
  STUCK = 'STUCK'
}

export enum AttemptStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum BackoffType {
  FIXED = 'FIXED',
  EXPONENTIAL = 'EXPONENTIAL',
  LINEAR = 'LINEAR'
}

export enum LogLevel {
  TRACE = 'TRACE',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL'
}

export enum LogSource {
  SYSTEM = 'SYSTEM',
  CLAUDE = 'CLAUDE',
  USER = 'USER',
  QUEUE = 'QUEUE',
  WORKER = 'WORKER',
  DATABASE = 'DATABASE'
}

export enum MetricType {
  COUNTER = 'COUNTER',
  GAUGE = 'GAUGE',
  HISTOGRAM = 'HISTOGRAM',
  SUMMARY = 'SUMMARY',
  TIMER = 'TIMER'
}

export enum ResultStatus {
  SUCCESS = 'SUCCESS',
  PARTIAL_SUCCESS = 'PARTIAL_SUCCESS',
  FAILURE = 'FAILURE',
  ERROR = 'ERROR',
  TIMEOUT = 'TIMEOUT'
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

// =============================================================================
// UTILITY TYPES - Common operations and transformations
// =============================================================================

/**
 * Create type for new entities (without id and timestamps)
 * DRY principle: Reusable creation type generator
 */
export type CreateEntity<T extends BaseEntity> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Update type for existing entities (partial without id and timestamps)
 * DRY principle: Reusable update type generator
 */
export type UpdateEntity<T extends BaseEntity> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Claude task creation type
 * ISP principle: Focused interface for task creation
 */
export type CreateClaudeTask = CreateEntity<ClaudeTask>;

/**
 * Claude task update type
 * ISP principle: Focused interface for task updates
 */
export type UpdateClaudeTask = UpdateEntity<ClaudeTask>;

/**
 * Task execution creation type
 * ISP principle: Focused interface for execution creation
 */
export type CreateTaskExecution = CreateEntity<TaskExecution>;

/**
 * Task execution update type
 * ISP principle: Focused interface for execution updates
 */
export type UpdateTaskExecution = UpdateEntity<TaskExecution>;

/**
 * Queue job creation type
 * ISP principle: Focused interface for queue job creation
 */
export type CreateQueueJob = CreateEntity<QueueJob>;

/**
 * Task result creation type
 * ISP principle: Focused interface for result creation
 */
export type CreateTaskResult = CreateEntity<TaskResult>;

/**
 * Result file creation type
 * ISP principle: Focused interface for file creation
 */
export type CreateResultFile = CreateEntity<ResultFile>;

// =============================================================================
// RELATIONSHIP TYPES - Type-safe entity relationships
// =============================================================================

/**
 * Claude task with populated relationships
 * DRY principle: Reusable relationship pattern
 */
export interface ClaudeTaskWithRelations extends ClaudeTask {
  executions?: TaskExecution[];
  queueJobs?: QueueJob[];
  results?: TaskResult[];
}

/**
 * Task execution with populated relationships
 * DRY principle: Reusable relationship pattern
 */
export interface TaskExecutionWithRelations extends TaskExecution {
  logs?: ExecutionLog[];
  metrics?: SystemMetric[];
}

/**
 * Queue job with populated relationships
 * DRY principle: Reusable relationship pattern
 */
export interface QueueJobWithRelations extends QueueJob {
  attempts?: JobAttempt[];
}

/**
 * Task result with populated relationships
 * DRY principle: Reusable relationship pattern
 */
export interface TaskResultWithRelations extends TaskResult {
  files?: ResultFile[];
}

// =============================================================================
// QUERY FILTER TYPES - Type-safe database filtering
// =============================================================================

/**
 * Claude task filter interface
 * ISP principle: Focused filtering interface
 */
export interface ClaudeTaskFilter {
  status?: ClaudeTaskStatus | ClaudeTaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  createdById?: string;
  projectId?: string;
  tags?: string[];
  scheduledAt?: {
    from?: Date;
    to?: Date;
  };
  createdAt?: {
    from?: Date;
    to?: Date;
  };
}

/**
 * Task execution filter interface
 * ISP principle: Focused filtering interface
 */
export interface TaskExecutionFilter {
  status?: ExecutionStatus | ExecutionStatus[];
  taskId?: string;
  workerId?: string;
  startedAt?: {
    from?: Date;
    to?: Date;
  };
}

/**
 * Execution log filter interface
 * ISP principle: Focused filtering interface
 */
export interface ExecutionLogFilter {
  level?: LogLevel | LogLevel[];
  source?: LogSource | LogSource[];
  executionId?: string;
  correlationId?: string;
  timestamp?: {
    from?: Date;
    to?: Date;
  };
}

/**
 * System metric filter interface
 * ISP principle: Focused filtering interface
 */
export interface SystemMetricFilter {
  metricType?: MetricType | MetricType[];
  metricName?: string;
  workerId?: string;
  executionId?: string;
  timestamp?: {
    from?: Date;
    to?: Date;
  };
}

// =============================================================================
// PAGINATION AND SORTING TYPES - Type-safe data access patterns
// =============================================================================

/**
 * Pagination interface
 * DRY principle: Reusable pagination pattern
 */
export interface Pagination {
  page: number;
  limit: number;
  offset?: number;
}

/**
 * Sort direction enumeration
 * KISS principle: Simple sort direction
 */
export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc'
}

/**
 * Sort configuration interface
 * DRY principle: Reusable sorting pattern
 */
export interface SortConfig<T = string> {
  field: T;
  direction: SortDirection;
}

/**
 * Paginated response interface
 * DRY principle: Reusable pagination response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

// =============================================================================
// API RESPONSE TYPES - Contract-driven interfaces
// =============================================================================

/**
 * Standard API response interface
 * DRY principle: Consistent response structure
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta?: {
    timestamp: Date;
    requestId?: string;
    version?: string;
  };
}

/**
 * Bulk operation response interface
 * ISP principle: Focused bulk operation interface
 */
export interface BulkOperationResponse<T = any> {
  success: boolean;
  processedCount: number;
  successCount: number;
  errorCount: number;
  results: T[];
  errors: Array<{
    item: any;
    error: string;
  }>;
}