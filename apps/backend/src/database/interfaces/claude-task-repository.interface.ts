import { IBaseRepository } from './base-repository.interface';

/**
 * Claude Task Repository Interface
 * Extends base repository with Claude-specific task operations
 * Following Interface Segregation Principle for focused interfaces
 */
export interface IClaudeTaskRepository extends IBaseRepository<ClaudeTaskEntity> {
  /**
   * Find Claude tasks by creator (user) ID
   */
  findByUserId(userId: string): Promise<ClaudeTaskEntity[]>;

  /**
   * Find Claude tasks by project ID
   */
  findByProjectId(projectId: string): Promise<ClaudeTaskEntity[]>;

  /**
   * Find Claude tasks by status
   */
  findByStatus(status: ClaudeTaskStatus): Promise<ClaudeTaskEntity[]>;

  /**
   * Find Claude tasks by multiple statuses
   */
  findByStatuses(statuses: ClaudeTaskStatus[]): Promise<ClaudeTaskEntity[]>;

  /**
   * Find running or active Claude tasks
   */
  findActiveOrRunning(): Promise<ClaudeTaskEntity[]>;

  /**
   * Find Claude tasks by priority
   */
  findByPriority(priority: TaskPriority): Promise<ClaudeTaskEntity[]>;

  /**
   * Find scheduled Claude tasks ready to run
   */
  findScheduledForExecution(beforeDate?: Date): Promise<ClaudeTaskEntity[]>;

  /**
   * Find Claude tasks with executions included
   */
  findWithExecutions(options?: { userId?: string; status?: ClaudeTaskStatus }): Promise<ClaudeTaskEntity[]>;

  /**
   * Find Claude tasks with results included
   */
  findWithResults(options?: { userId?: string; status?: ClaudeTaskStatus }): Promise<ClaudeTaskEntity[]>;

  /**
   * Update Claude task status with timestamp management
   */
  updateStatus(id: string, status: ClaudeTaskStatus): Promise<ClaudeTaskEntity>;

  /**
   * Start Claude task execution (set status to RUNNING with timestamp)
   */
  startExecution(id: string): Promise<ClaudeTaskEntity>;

  /**
   * Complete Claude task execution (set status to COMPLETED with duration)
   */
  completeExecution(id: string, actualDuration?: number): Promise<ClaudeTaskEntity>;

  /**
   * Fail Claude task execution (set status to FAILED)
   */
  failExecution(id: string): Promise<ClaudeTaskEntity>;

  /**
   * Cancel Claude task execution (set status to CANCELLED)
   */
  cancelExecution(id: string): Promise<ClaudeTaskEntity>;

  /**
   * Get Claude task statistics by user
   */
  getTaskStatsByUser(userId: string): Promise<ClaudeTaskStatistics>;

  /**
   * Get Claude task statistics by project
   */
  getTaskStatsByProject(projectId: string): Promise<ClaudeTaskStatistics>;

  /**
   * Get execution performance metrics
   */
  getExecutionMetrics(options?: { userId?: string; fromDate?: Date; toDate?: Date }): Promise<ExecutionMetrics>;
}

/**
 * Claude Task Entity interface aligned with Prisma model
 */
export interface ClaudeTaskEntity {
  id: string;
  title: string;
  description: string | null;
  prompt: string;
  config: any | null; // JSON configuration
  status: ClaudeTaskStatus;
  priority: TaskPriority;
  createdById: string;
  projectId: string | null;
  tags: string[];
  estimatedDuration: number | null; // seconds
  actualDuration: number | null; // seconds
  createdAt: Date;
  updatedAt: Date;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;

  // Optional relationships for optimized queries
  createdBy?: {
    id: string;
    username: string;
    email: string;
  };
  project?: {
    id: string;
    name: string;
  };
  executions?: TaskExecutionEntity[];
  results?: TaskResultEntity[];
}

/**
 * Claude Task Status enumeration matching Prisma schema
 */
export enum ClaudeTaskStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  PAUSED = 'PAUSED',
}

/**
 * Task Priority enumeration (reused from Task)
 */
export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/**
 * Claude Task Statistics interface
 */
export interface ClaudeTaskStatistics {
  total: number;
  pending: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  paused: number;
  averageDuration: number | null; // seconds
  totalDuration: number; // seconds
}

/**
 * Execution Metrics interface for performance tracking
 */
export interface ExecutionMetrics {
  totalTasks: number;
  successRate: number; // percentage (0-100)
  averageDuration: number | null; // seconds
  medianDuration: number | null; // seconds
  shortestDuration: number | null; // seconds
  longestDuration: number | null; // seconds
  tasksPerHour: number;
  failureReasons: {
    [reason: string]: number;
  };
}

/**
 * Basic Task Execution Entity for relationships
 */
export interface TaskExecutionEntity {
  id: string;
  taskId: string;
  status: ExecutionStatus;
  progress: number | null;
  workerId: string | null;
  processId: string | null;
  sessionId: string | null;
  errorMessage: string | null;
  errorCode: string | null;
  retryCount: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  lastHeartbeat: Date | null;
}

/**
 * Basic Task Result Entity for relationships
 */
export interface TaskResultEntity {
  id: string;
  taskId: string;
  resultData: any; // JSON result data
  resultType: ResultType;
  success: boolean;
  createdAt: Date;
}

/**
 * Execution Status enumeration
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
 * Result Type enumeration
 */
export enum ResultType {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  PARTIAL = 'PARTIAL',
  TIMEOUT = 'TIMEOUT',
}