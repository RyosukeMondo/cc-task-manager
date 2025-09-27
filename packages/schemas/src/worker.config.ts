import { registerAs } from '@nestjs/config';
import { WorkerConfigSchema } from './worker.schemas';

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