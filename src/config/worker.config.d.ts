import { z } from 'zod';
export declare const ProcessConfigSchema: z.ZodObject<{
    jobId: z.ZodString;
    sessionName: z.ZodString;
    workingDirectory: z.ZodString;
    pythonExecutable: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    wrapperScriptPath: z.ZodString;
    unbuffered: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    workingDirectory?: string;
    jobId?: string;
    unbuffered?: boolean;
    sessionName?: string;
    pythonExecutable?: string;
    wrapperScriptPath?: string;
}, {
    workingDirectory?: string;
    jobId?: string;
    unbuffered?: boolean;
    sessionName?: string;
    pythonExecutable?: string;
    wrapperScriptPath?: string;
}>;
export declare const ClaudeCodeOptionsSchema: z.ZodObject<{
    model: z.ZodOptional<z.ZodString>;
    maxTokens: z.ZodOptional<z.ZodNumber>;
    temperature: z.ZodOptional<z.ZodNumber>;
    timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    permission_mode: z.ZodOptional<z.ZodEnum<["bypassPermissions", "default", "plan", "acceptEdits"]>>;
}, "strip", z.ZodTypeAny, {
    timeout?: number;
    permission_mode?: "default" | "bypassPermissions" | "plan" | "acceptEdits";
    model?: string;
    maxTokens?: number;
    temperature?: number;
}, {
    timeout?: number;
    permission_mode?: "default" | "bypassPermissions" | "plan" | "acceptEdits";
    model?: string;
    maxTokens?: number;
    temperature?: number;
}>;
export declare const TaskExecutionRequestSchema: z.ZodObject<{
    id: z.ZodString;
    prompt: z.ZodString;
    sessionName: z.ZodString;
    workingDirectory: z.ZodString;
    options: z.ZodObject<{
        model: z.ZodOptional<z.ZodString>;
        maxTokens: z.ZodOptional<z.ZodNumber>;
        temperature: z.ZodOptional<z.ZodNumber>;
        timeout: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        permission_mode: z.ZodOptional<z.ZodEnum<["bypassPermissions", "default", "plan", "acceptEdits"]>>;
    }, "strip", z.ZodTypeAny, {
        timeout?: number;
        permission_mode?: "default" | "bypassPermissions" | "plan" | "acceptEdits";
        model?: string;
        maxTokens?: number;
        temperature?: number;
    }, {
        timeout?: number;
        permission_mode?: "default" | "bypassPermissions" | "plan" | "acceptEdits";
        model?: string;
        maxTokens?: number;
        temperature?: number;
    }>;
    timeoutMs: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    options?: {
        timeout?: number;
        permission_mode?: "default" | "bypassPermissions" | "plan" | "acceptEdits";
        model?: string;
        maxTokens?: number;
        temperature?: number;
    };
    id?: string;
    prompt?: string;
    workingDirectory?: string;
    sessionName?: string;
    timeoutMs?: number;
}, {
    options?: {
        timeout?: number;
        permission_mode?: "default" | "bypassPermissions" | "plan" | "acceptEdits";
        model?: string;
        maxTokens?: number;
        temperature?: number;
    };
    id?: string;
    prompt?: string;
    workingDirectory?: string;
    sessionName?: string;
    timeoutMs?: number;
}>;
export declare const WorkerConfigSchema: z.ZodObject<{
    maxConcurrentTasks: z.ZodDefault<z.ZodNumber>;
    processTimeoutMs: z.ZodDefault<z.ZodNumber>;
    gracefulShutdownMs: z.ZodDefault<z.ZodNumber>;
    pidCheckIntervalMs: z.ZodDefault<z.ZodNumber>;
    fileWatchTimeoutMs: z.ZodDefault<z.ZodNumber>;
    inactivityTimeoutMs: z.ZodDefault<z.ZodNumber>;
    pythonExecutable: z.ZodDefault<z.ZodString>;
    wrapperScriptPath: z.ZodString;
    wrapperWorkingDir: z.ZodOptional<z.ZodString>;
    queueName: z.ZodDefault<z.ZodString>;
    redisHost: z.ZodDefault<z.ZodString>;
    redisPort: z.ZodDefault<z.ZodNumber>;
    redisPassword: z.ZodOptional<z.ZodString>;
    logLevel: z.ZodDefault<z.ZodEnum<["fatal", "error", "warn", "info", "debug", "trace"]>>;
    enableDetailedLogs: z.ZodDefault<z.ZodBoolean>;
    sessionLogsDir: z.ZodOptional<z.ZodString>;
    awaitWriteFinish: z.ZodDefault<z.ZodBoolean>;
    awaitWriteFinishMs: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    queueName?: string;
    logLevel?: "error" | "info" | "warn" | "trace" | "debug" | "fatal";
    pythonExecutable?: string;
    wrapperScriptPath?: string;
    maxConcurrentTasks?: number;
    processTimeoutMs?: number;
    gracefulShutdownMs?: number;
    pidCheckIntervalMs?: number;
    fileWatchTimeoutMs?: number;
    inactivityTimeoutMs?: number;
    wrapperWorkingDir?: string;
    redisHost?: string;
    redisPort?: number;
    redisPassword?: string;
    enableDetailedLogs?: boolean;
    sessionLogsDir?: string;
    awaitWriteFinish?: boolean;
    awaitWriteFinishMs?: number;
}, {
    queueName?: string;
    logLevel?: "error" | "info" | "warn" | "trace" | "debug" | "fatal";
    pythonExecutable?: string;
    wrapperScriptPath?: string;
    maxConcurrentTasks?: number;
    processTimeoutMs?: number;
    gracefulShutdownMs?: number;
    pidCheckIntervalMs?: number;
    fileWatchTimeoutMs?: number;
    inactivityTimeoutMs?: number;
    wrapperWorkingDir?: string;
    redisHost?: string;
    redisPort?: number;
    redisPassword?: string;
    enableDetailedLogs?: boolean;
    sessionLogsDir?: string;
    awaitWriteFinish?: boolean;
    awaitWriteFinishMs?: number;
}>;
export declare enum TaskState {
    PENDING = "pending",
    RUNNING = "running",
    ACTIVE = "active",
    IDLE = "idle",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
export declare const TaskStatusSchema: z.ZodObject<{
    taskId: z.ZodString;
    state: z.ZodNativeEnum<typeof TaskState>;
    pid: z.ZodOptional<z.ZodNumber>;
    progress: z.ZodOptional<z.ZodString>;
    lastActivity: z.ZodDate;
    error: z.ZodOptional<z.ZodString>;
    exitCode: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    taskId?: string;
    progress?: string;
    error?: string;
    exitCode?: number;
    state?: TaskState;
    lastActivity?: Date;
    pid?: number;
}, {
    taskId?: string;
    progress?: string;
    error?: string;
    exitCode?: number;
    state?: TaskState;
    lastActivity?: Date;
    pid?: number;
}>;
export type ProcessConfig = z.infer<typeof ProcessConfigSchema>;
export type ClaudeCodeOptions = z.infer<typeof ClaudeCodeOptionsSchema>;
export type TaskExecutionRequest = z.infer<typeof TaskExecutionRequestSchema>;
export type WorkerConfig = z.infer<typeof WorkerConfigSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
declare const _default: (() => {
    queueName?: string;
    logLevel?: "error" | "info" | "warn" | "trace" | "debug" | "fatal";
    pythonExecutable?: string;
    wrapperScriptPath?: string;
    maxConcurrentTasks?: number;
    processTimeoutMs?: number;
    gracefulShutdownMs?: number;
    pidCheckIntervalMs?: number;
    fileWatchTimeoutMs?: number;
    inactivityTimeoutMs?: number;
    wrapperWorkingDir?: string;
    redisHost?: string;
    redisPort?: number;
    redisPassword?: string;
    enableDetailedLogs?: boolean;
    sessionLogsDir?: string;
    awaitWriteFinish?: boolean;
    awaitWriteFinishMs?: number;
}) & import("node_modules/@nestjs/config").ConfigFactoryKeyHost<{
    queueName?: string;
    logLevel?: "error" | "info" | "warn" | "trace" | "debug" | "fatal";
    pythonExecutable?: string;
    wrapperScriptPath?: string;
    maxConcurrentTasks?: number;
    processTimeoutMs?: number;
    gracefulShutdownMs?: number;
    pidCheckIntervalMs?: number;
    fileWatchTimeoutMs?: number;
    inactivityTimeoutMs?: number;
    wrapperWorkingDir?: string;
    redisHost?: string;
    redisPort?: number;
    redisPassword?: string;
    enableDetailedLogs?: boolean;
    sessionLogsDir?: string;
    awaitWriteFinish?: boolean;
    awaitWriteFinishMs?: number;
}>;
export default _default;
export declare const validateProcessConfig: (data: unknown) => ProcessConfig;
export declare const validateTaskExecutionRequest: (data: unknown) => TaskExecutionRequest;
export declare const validateClaudeCodeOptions: (data: unknown) => ClaudeCodeOptions;
export declare const validateWorkerConfig: (data: unknown) => WorkerConfig;
export declare const validateTaskStatus: (data: unknown) => TaskStatus;
