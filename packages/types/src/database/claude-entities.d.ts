export interface BaseEntity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface ClaudeTask extends BaseEntity {
    title: string;
    description?: string;
    prompt: string;
    config?: Record<string, any>;
    status: ClaudeTaskStatus;
    priority: TaskPriority;
    createdById: string;
    projectId?: string;
    tags: string[];
    estimatedDuration?: number;
    actualDuration?: number;
    scheduledAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
}
export interface TaskExecution extends BaseEntity {
    taskId: string;
    status: ExecutionStatus;
    progress?: number;
    workerId?: string;
    processId?: string;
    sessionId?: string;
    cpuUsage?: number;
    memoryUsage?: number;
    diskUsage?: number;
    errorMessage?: string;
    errorCode?: string;
    stackTrace?: string;
    retryCount: number;
    startedAt?: Date;
    completedAt?: Date;
    lastHeartbeat?: Date;
}
export interface QueueJob extends BaseEntity {
    taskId: string;
    queueName: string;
    jobId: string;
    status: QueueJobStatus;
    priority: number;
    delay?: number;
    maxAttempts: number;
    backoffType: BackoffType;
    backoffDelay: number;
    jobData: Record<string, any>;
    jobOptions?: Record<string, any>;
    result?: Record<string, any>;
    processedAt?: Date;
    finishedAt?: Date;
}
export interface JobAttempt {
    id: string;
    queueJobId: string;
    attemptNumber: number;
    status: AttemptStatus;
    error?: string;
    result?: Record<string, any>;
    startedAt: Date;
    finishedAt?: Date;
}
export interface ExecutionLog {
    id: string;
    executionId: string;
    level: LogLevel;
    source: LogSource;
    message: string;
    details?: Record<string, any>;
    component?: string;
    operation?: string;
    correlationId?: string;
    timestamp: Date;
}
export interface SystemMetric {
    id: string;
    executionId?: string;
    metricType: MetricType;
    metricName: string;
    value: number;
    unit?: string;
    workerId?: string;
    queueName?: string;
    tags?: Record<string, any>;
    timestamp: Date;
}
export interface TaskResult extends BaseEntity {
    taskId: string;
    status: ResultStatus;
    summary?: string;
    output?: Record<string, any>;
    executionTime?: number;
    tokensUsed?: number;
    costEstimate?: number;
}
export interface ResultFile extends BaseEntity {
    resultId: string;
    filename: string;
    contentType: string;
    size: number;
    path: string;
    checksum: string;
}
export declare enum ClaudeTaskStatus {
    PENDING = "PENDING",
    QUEUED = "QUEUED",
    RUNNING = "RUNNING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED",
    PAUSED = "PAUSED"
}
export declare enum ExecutionStatus {
    INITIALIZING = "INITIALIZING",
    STARTING = "STARTING",
    RUNNING = "RUNNING",
    PAUSED = "PAUSED",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED",
    TIMEOUT = "TIMEOUT"
}
export declare enum QueueJobStatus {
    WAITING = "WAITING",
    ACTIVE = "ACTIVE",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    DELAYED = "DELAYED",
    PAUSED = "PAUSED",
    STUCK = "STUCK"
}
export declare enum AttemptStatus {
    PROCESSING = "PROCESSING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
    CANCELLED = "CANCELLED"
}
export declare enum BackoffType {
    FIXED = "FIXED",
    EXPONENTIAL = "EXPONENTIAL",
    LINEAR = "LINEAR"
}
export declare enum LogLevel {
    TRACE = "TRACE",
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR",
    FATAL = "FATAL"
}
export declare enum LogSource {
    SYSTEM = "SYSTEM",
    CLAUDE = "CLAUDE",
    USER = "USER",
    QUEUE = "QUEUE",
    WORKER = "WORKER",
    DATABASE = "DATABASE"
}
export declare enum MetricType {
    COUNTER = "COUNTER",
    GAUGE = "GAUGE",
    HISTOGRAM = "HISTOGRAM",
    SUMMARY = "SUMMARY",
    TIMER = "TIMER"
}
export declare enum ResultStatus {
    SUCCESS = "SUCCESS",
    PARTIAL_SUCCESS = "PARTIAL_SUCCESS",
    FAILURE = "FAILURE",
    ERROR = "ERROR",
    TIMEOUT = "TIMEOUT"
}
export declare enum TaskPriority {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    URGENT = "URGENT"
}
export type CreateEntity<T extends BaseEntity> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateEntity<T extends BaseEntity> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;
export type CreateClaudeTask = CreateEntity<ClaudeTask>;
export type UpdateClaudeTask = UpdateEntity<ClaudeTask>;
export type CreateTaskExecution = CreateEntity<TaskExecution>;
export type UpdateTaskExecution = UpdateEntity<TaskExecution>;
export type CreateQueueJob = CreateEntity<QueueJob>;
export type CreateTaskResult = CreateEntity<TaskResult>;
export type CreateResultFile = CreateEntity<ResultFile>;
export interface ClaudeTaskWithRelations extends ClaudeTask {
    executions?: TaskExecution[];
    queueJobs?: QueueJob[];
    results?: TaskResult[];
}
export interface TaskExecutionWithRelations extends TaskExecution {
    logs?: ExecutionLog[];
    metrics?: SystemMetric[];
}
export interface QueueJobWithRelations extends QueueJob {
    attempts?: JobAttempt[];
}
export interface TaskResultWithRelations extends TaskResult {
    files?: ResultFile[];
}
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
export interface TaskExecutionFilter {
    status?: ExecutionStatus | ExecutionStatus[];
    taskId?: string;
    workerId?: string;
    startedAt?: {
        from?: Date;
        to?: Date;
    };
}
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
export interface Pagination {
    page: number;
    limit: number;
    offset?: number;
}
export declare enum SortDirection {
    ASC = "asc",
    DESC = "desc"
}
export interface SortConfig<T = string> {
    field: T;
    direction: SortDirection;
}
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
