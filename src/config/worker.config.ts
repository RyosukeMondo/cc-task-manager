import { z } from 'zod';
import { registerAs } from '@nestjs/config';

/**
 * Process configuration schema for secure Claude Code process spawning
 * Validates all parameters required for safe child process creation
 */
export const ProcessConfigSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
  sessionName: z.string().min(1, 'Session name is required'),
  workingDirectory: z.string().min(1, 'Working directory is required'),
  pythonExecutable: z.string().optional().default('python3'),
  wrapperScriptPath: z.string().min(1, 'Wrapper script path is required'),
  unbuffered: z.boolean().default(true),
});

/**
 * Claude Code options schema for API configuration
 * Defines all supported parameters for Claude Code communication
 */
export const ClaudeCodeOptionsSchema = z.object({
  model: z.string().optional(),
  maxTokens: z.number().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  timeout: z.number().positive().optional().default(300000), // 5 minutes default
  permission_mode: z
    .enum(['bypassPermissions', 'default', 'plan', 'acceptEdits'])
    .optional(),
});

/**
 * Task execution request schema for end-to-end task processing
 * Validates complete task execution parameters including prompt and options
 */
export const TaskExecutionRequestSchema = z.object({
  id: z.string().min(1, 'Task ID is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  sessionName: z.string().min(1, 'Session name is required'),
  workingDirectory: z.string().min(1, 'Working directory is required'),
  options: ClaudeCodeOptionsSchema,
  timeoutMs: z.number().positive().optional().default(300000),
});

/**
 * Comprehensive worker configuration schema
 * Defines all service configuration parameters with validation and defaults
 */
export const WorkerConfigSchema = z.object({
  // Process management settings
  maxConcurrentTasks: z.number().positive().default(5),
  processTimeoutMs: z.number().positive().default(600000), // 10 minutes
  gracefulShutdownMs: z.number().positive().default(5000), // 5 seconds
  
  // Monitoring settings
  pidCheckIntervalMs: z.number().positive().default(1000), // 1 second
  fileWatchTimeoutMs: z.number().positive().default(30000), // 30 seconds
  inactivityTimeoutMs: z.number().positive().default(120000), // 2 minutes
  
  // Python wrapper settings
  pythonExecutable: z.string().default('python3'),
  wrapperScriptPath: z.string().min(1, 'Wrapper script path is required'),
  wrapperWorkingDir: z.string().optional(),
  
  // BullMQ settings
  queueName: z.string().default('claude-code-tasks'),
  redisHost: z.string().default('localhost'),
  redisPort: z.number().positive().default(6379),
  redisPassword: z.string().optional(),
  
  // Logging settings
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  enableDetailedLogs: z.boolean().default(false),
  
  // File system monitoring
  sessionLogsDir: z.string().optional(),
  awaitWriteFinish: z.boolean().default(true),
  awaitWriteFinishMs: z.number().positive().default(100),
});

/**
 * Task state enumeration for process lifecycle tracking
 * Represents all possible states in the task execution lifecycle
 */
export enum TaskState {
  PENDING = 'pending',
  RUNNING = 'running',
  ACTIVE = 'active',
  IDLE = 'idle',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Task status schema for runtime state tracking
 * Combines state information with metadata for comprehensive monitoring
 */
export const TaskStatusSchema = z.object({
  taskId: z.string(),
  state: z.nativeEnum(TaskState),
  pid: z.number().optional(),
  progress: z.string().optional(),
  lastActivity: z.date(),
  error: z.string().optional(),
  exitCode: z.number().optional(),
});

/**
 * TypeScript type exports derived from Zod schemas
 * Provides compile-time type safety for all configuration objects
 */
export type ProcessConfig = z.infer<typeof ProcessConfigSchema>;
export type ClaudeCodeOptions = z.infer<typeof ClaudeCodeOptionsSchema>;
export type TaskExecutionRequest = z.infer<typeof TaskExecutionRequestSchema>;
export type WorkerConfig = z.infer<typeof WorkerConfigSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * NestJS configuration factory for worker service
 *
 * Loads configuration from environment variables with validation and defaults.
 * Uses Zod schema validation to ensure type safety and proper values.
 *
 * Environment Variables:
 * - WORKER_MAX_CONCURRENT_TASKS: Maximum parallel task execution limit
 * - WORKER_PROCESS_TIMEOUT_MS: Maximum execution time per task
 * - WORKER_GRACEFUL_SHUTDOWN_MS: Grace period for process termination
 * - PYTHON_EXECUTABLE: Path to Python interpreter
 * - PYTHON_WRAPPER_SCRIPT_PATH: Path to Claude Code wrapper script
 * - REDIS_HOST/PORT/PASSWORD: Redis connection for BullMQ
 * - LOG_LEVEL: Logging verbosity level
 * - SESSION_LOGS_DIR: Directory for session file monitoring
 *
 * @returns Validated worker configuration object
 */
export default registerAs('worker', () => {
  const config = {
    // Process management settings
    maxConcurrentTasks: parseInt(process.env.WORKER_MAX_CONCURRENT_TASKS || '5'),
    processTimeoutMs: parseInt(process.env.WORKER_PROCESS_TIMEOUT_MS || '600000'),
    gracefulShutdownMs: parseInt(process.env.WORKER_GRACEFUL_SHUTDOWN_MS || '5000'),
    
    // Monitoring settings
    pidCheckIntervalMs: parseInt(process.env.WORKER_PID_CHECK_INTERVAL_MS || '1000'),
    fileWatchTimeoutMs: parseInt(process.env.WORKER_FILE_WATCH_TIMEOUT_MS || '30000'),
    inactivityTimeoutMs: parseInt(process.env.WORKER_INACTIVITY_TIMEOUT_MS || '120000'),
    
    // Python wrapper settings
    pythonExecutable: process.env.PYTHON_EXECUTABLE || 'python3',
    wrapperScriptPath: process.env.PYTHON_WRAPPER_SCRIPT_PATH || './scripts/claude_wrapper.py',
    wrapperWorkingDir: process.env.PYTHON_WRAPPER_WORKING_DIR,
    
    // BullMQ settings
    queueName: process.env.BULLMQ_QUEUE_NAME || 'claude-code-tasks',
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT || '6379'),
    redisPassword: process.env.REDIS_PASSWORD,
    
    // Logging settings
    logLevel: process.env.LOG_LEVEL || 'info',
    enableDetailedLogs: process.env.ENABLE_DETAILED_LOGS === 'true',
    
    // File system monitoring
    sessionLogsDir: process.env.SESSION_LOGS_DIR,
    awaitWriteFinish: process.env.AWAIT_WRITE_FINISH !== 'false',
    awaitWriteFinishMs: parseInt(process.env.AWAIT_WRITE_FINISH_MS || '100'),
  };

  // Validate configuration with Zod
  return WorkerConfigSchema.parse(config);
});

/**
 * Validation helper functions for runtime type checking
 *
 * These functions provide runtime validation using the Zod schemas,
 * ensuring data integrity and type safety throughout the application.
 *
 * @example
 * ```typescript
 * try {
 *   const validConfig = validateWorkerConfig(userInput);
 *   // Guaranteed to be properly typed and validated
 * } catch (error) {
 *   // Handle validation errors with detailed messages
 *   console.error('Validation failed:', error.message);
 * }
 * ```
 */
export const validateProcessConfig = (data: unknown): ProcessConfig => {
  return ProcessConfigSchema.parse(data);
};

export const validateTaskExecutionRequest = (data: unknown): TaskExecutionRequest => {
  return TaskExecutionRequestSchema.parse(data);
};

export const validateClaudeCodeOptions = (data: unknown): ClaudeCodeOptions => {
  return ClaudeCodeOptionsSchema.parse(data);
};

export const validateWorkerConfig = (data: unknown): WorkerConfig => {
  return WorkerConfigSchema.parse(data);
};

export const validateTaskStatus = (data: unknown): TaskStatus => {
  return TaskStatusSchema.parse(data);
};