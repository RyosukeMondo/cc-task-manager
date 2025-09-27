"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTaskStatus = exports.validateWorkerConfig = exports.validateClaudeCodeOptions = exports.validateTaskExecutionRequest = exports.validateProcessConfig = exports.TaskStatusSchema = exports.WorkerConfigSchema = exports.TaskExecutionRequestSchema = exports.ClaudeCodeOptionsSchema = exports.ProcessConfigSchema = exports.TaskState = void 0;
const zod_1 = require("zod");
var TaskState;
(function (TaskState) {
    TaskState["PENDING"] = "pending";
    TaskState["RUNNING"] = "running";
    TaskState["ACTIVE"] = "active";
    TaskState["IDLE"] = "idle";
    TaskState["COMPLETED"] = "completed";
    TaskState["FAILED"] = "failed";
    TaskState["CANCELLED"] = "cancelled";
})(TaskState || (exports.TaskState = TaskState = {}));
exports.ProcessConfigSchema = zod_1.z.object({
    jobId: zod_1.z.string().min(1, 'Job ID is required'),
    sessionName: zod_1.z.string().min(1, 'Session name is required'),
    workingDirectory: zod_1.z.string().min(1, 'Working directory is required'),
    pythonExecutable: zod_1.z.string().optional().default('python3'),
    wrapperScriptPath: zod_1.z.string().min(1, 'Wrapper script path is required'),
    unbuffered: zod_1.z.boolean().default(true),
});
exports.ClaudeCodeOptionsSchema = zod_1.z.object({
    model: zod_1.z.string().optional(),
    maxTokens: zod_1.z.number().positive().optional(),
    temperature: zod_1.z.number().min(0).max(2).optional(),
    timeout: zod_1.z.number().positive().optional().default(300000),
    permission_mode: zod_1.z
        .enum(['bypassPermissions', 'default', 'plan', 'acceptEdits'])
        .optional(),
});
exports.TaskExecutionRequestSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, 'Task ID is required'),
    prompt: zod_1.z.string().min(1, 'Prompt is required'),
    sessionName: zod_1.z.string().min(1, 'Session name is required'),
    workingDirectory: zod_1.z.string().min(1, 'Working directory is required'),
    options: exports.ClaudeCodeOptionsSchema,
    timeoutMs: zod_1.z.number().positive().optional().default(300000),
});
exports.WorkerConfigSchema = zod_1.z.object({
    maxConcurrentTasks: zod_1.z.number().positive().default(5),
    processTimeoutMs: zod_1.z.number().positive().default(600000),
    gracefulShutdownMs: zod_1.z.number().positive().default(5000),
    pidCheckIntervalMs: zod_1.z.number().positive().default(1000),
    fileWatchTimeoutMs: zod_1.z.number().positive().default(30000),
    inactivityTimeoutMs: zod_1.z.number().positive().default(120000),
    pythonExecutable: zod_1.z.string().default('python3'),
    wrapperScriptPath: zod_1.z.string().min(1, 'Wrapper script path is required'),
    wrapperWorkingDir: zod_1.z.string().optional(),
    queueName: zod_1.z.string().default('claude-code-tasks'),
    redisHost: zod_1.z.string().default('localhost'),
    redisPort: zod_1.z.number().positive().default(6379),
    redisPassword: zod_1.z.string().optional(),
    logLevel: zod_1.z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    enableDetailedLogs: zod_1.z.boolean().default(false),
    sessionLogsDir: zod_1.z.string().optional(),
    awaitWriteFinish: zod_1.z.boolean().default(true),
    awaitWriteFinishMs: zod_1.z.number().positive().default(100),
});
exports.TaskStatusSchema = zod_1.z.object({
    taskId: zod_1.z.string(),
    state: zod_1.z.nativeEnum(TaskState),
    pid: zod_1.z.number().optional(),
    progress: zod_1.z.string().optional(),
    lastActivity: zod_1.z.date(),
    error: zod_1.z.string().optional(),
    exitCode: zod_1.z.number().optional(),
});
const validateProcessConfig = (data) => {
    return exports.ProcessConfigSchema.parse(data);
};
exports.validateProcessConfig = validateProcessConfig;
const validateTaskExecutionRequest = (data) => {
    return exports.TaskExecutionRequestSchema.parse(data);
};
exports.validateTaskExecutionRequest = validateTaskExecutionRequest;
const validateClaudeCodeOptions = (data) => {
    return exports.ClaudeCodeOptionsSchema.parse(data);
};
exports.validateClaudeCodeOptions = validateClaudeCodeOptions;
const validateWorkerConfig = (data) => {
    return exports.WorkerConfigSchema.parse(data);
};
exports.validateWorkerConfig = validateWorkerConfig;
const validateTaskStatus = (data) => {
    return exports.TaskStatusSchema.parse(data);
};
exports.validateTaskStatus = validateTaskStatus;
//# sourceMappingURL=worker.schemas.js.map