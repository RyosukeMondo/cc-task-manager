import { z } from 'zod';

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
 * Task status schema for runtime state tracking
 * Combines state information with metadata for comprehensive monitoring
 */
export const TaskStatusSchema = z.object({
  taskId: z.string(),
  state: z.enum(['pending', 'running', 'active', 'idle', 'completed', 'failed', 'cancelled']),
  pid: z.number().optional(),
  progress: z.string().optional(),
  lastActivity: z.date(),
  error: z.string().optional(),
  exitCode: z.number().optional(),
});

/**
 * Validation helper functions for runtime type checking
 */
export const validateProcessConfig = (data: unknown) => {
  return ProcessConfigSchema.parse(data);
};

export const validateTaskExecutionRequest = (data: unknown) => {
  return TaskExecutionRequestSchema.parse(data);
};

export const validateClaudeCodeOptions = (data: unknown) => {
  return ClaudeCodeOptionsSchema.parse(data);
};

export const validateWorkerConfig = (data: unknown) => {
  return WorkerConfigSchema.parse(data);
};

export const validateTaskStatus = (data: unknown) => {
  return TaskStatusSchema.parse(data);
};