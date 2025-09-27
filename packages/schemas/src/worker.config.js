"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
const worker_schemas_1 = require("./worker.schemas");
exports.default = (0, config_1.registerAs)('worker', () => {
    const config = {
        maxConcurrentTasks: parseInt(process.env.WORKER_MAX_CONCURRENT_TASKS || '5'),
        processTimeoutMs: parseInt(process.env.WORKER_PROCESS_TIMEOUT_MS || '600000'),
        gracefulShutdownMs: parseInt(process.env.WORKER_GRACEFUL_SHUTDOWN_MS || '5000'),
        pidCheckIntervalMs: parseInt(process.env.WORKER_PID_CHECK_INTERVAL_MS || '1000'),
        fileWatchTimeoutMs: parseInt(process.env.WORKER_FILE_WATCH_TIMEOUT_MS || '30000'),
        inactivityTimeoutMs: parseInt(process.env.WORKER_INACTIVITY_TIMEOUT_MS || '120000'),
        pythonExecutable: process.env.PYTHON_EXECUTABLE || 'python3',
        wrapperScriptPath: process.env.PYTHON_WRAPPER_SCRIPT_PATH || './scripts/claude_wrapper.py',
        wrapperWorkingDir: process.env.PYTHON_WRAPPER_WORKING_DIR,
        queueName: process.env.BULLMQ_QUEUE_NAME || 'claude-code-tasks',
        redisHost: process.env.REDIS_HOST || 'localhost',
        redisPort: parseInt(process.env.REDIS_PORT || '6379'),
        redisPassword: process.env.REDIS_PASSWORD,
        logLevel: process.env.LOG_LEVEL || 'info',
        enableDetailedLogs: process.env.ENABLE_DETAILED_LOGS === 'true',
        sessionLogsDir: process.env.SESSION_LOGS_DIR,
        awaitWriteFinish: process.env.AWAIT_WRITE_FINISH !== 'false',
        awaitWriteFinishMs: parseInt(process.env.AWAIT_WRITE_FINISH_MS || '100'),
    };
    return worker_schemas_1.WorkerConfigSchema.parse(config);
});
//# sourceMappingURL=worker.config.js.map