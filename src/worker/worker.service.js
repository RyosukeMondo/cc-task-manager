"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var WorkerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const crypto_1 = require("crypto");
const path_1 = require("path");
const worker_config_1 = require("../config/worker.config");
const process_manager_service_1 = require("./process-manager.service");
const state_monitor_service_1 = require("./state-monitor.service");
const claude_code_client_service_1 = require("./claude-code-client.service");
const ContractRegistry_1 = require("../contracts/ContractRegistry");
const ContractValidationPipe_1 = require("../contracts/ContractValidationPipe");
let WorkerService = WorkerService_1 = class WorkerService {
    constructor(configService, eventEmitter, processManager, stateMonitor, claudeCodeClient, contractRegistry) {
        this.configService = configService;
        this.eventEmitter = eventEmitter;
        this.processManager = processManager;
        this.stateMonitor = stateMonitor;
        this.claudeCodeClient = claudeCodeClient;
        this.contractRegistry = contractRegistry;
        this.logger = new common_1.Logger(WorkerService_1.name);
        this.activeTasks = new Map();
        this.taskResults = new Map();
        this.taskTimeouts = new Map();
        this.workerConfig = this.configService.get('worker');
    }
    async onModuleInit() {
        this.logger.log('Initializing WorkerService');
        await this.registerTaskExecutionContract();
        this.setupEventListeners();
        this.logger.log('WorkerService initialized successfully', {
            maxConcurrentTasks: this.workerConfig.maxConcurrentTasks,
            processTimeoutMs: this.workerConfig.processTimeoutMs,
        });
    }
    async registerTaskExecutionContract() {
        try {
            const registered = await this.contractRegistry.registerContract('TaskExecutionRequest', '1.0.0', worker_config_1.TaskExecutionRequestSchema, {
                description: 'Contract for validating task execution requests in the worker service',
                compatibleVersions: ['1.0.0'],
            });
            if (!registered) {
                this.logger.warn('Failed to register TaskExecutionRequest contract');
            }
            else {
                this.logger.log('TaskExecutionRequest contract registered successfully');
            }
        }
        catch (error) {
            this.logger.error('Error registering TaskExecutionRequest contract:', error);
        }
    }
    async validateTaskRequest(request) {
        try {
            const validationPipe = new ContractValidationPipe_1.ContractValidationPipe(this.contractRegistry, {
                contractName: 'TaskExecutionRequest',
                version: '1.0.0',
                location: 'body'
            });
            const validatedRequest = validationPipe.transform(request, { type: 'body', metatype: Object, data: '' });
            const legacyValidatedRequest = (0, worker_config_1.validateTaskExecutionRequest)(validatedRequest);
            return legacyValidatedRequest;
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException) {
                const contractError = error.getResponse();
                this.logger.error('Contract validation failed for task request:', {
                    contract: contractError.contract,
                    location: contractError.location,
                    issues: contractError.issues,
                    message: contractError.message,
                });
                throw new Error(`Task validation failed: ${contractError.message}`);
            }
            this.logger.error('Task request validation failed:', error);
            throw error;
        }
    }
    async executeTask(request) {
        const validatedRequest = await this.validateTaskRequest(request);
        const correlationId = (0, crypto_1.randomUUID)();
        this.logger.log('Starting task execution', {
            correlationId,
            taskId: validatedRequest.id,
            sessionName: validatedRequest.sessionName,
            workingDirectory: validatedRequest.workingDirectory,
            hasOptions: !!validatedRequest.options,
        });
        if (this.activeTasks.size >= this.workerConfig.maxConcurrentTasks) {
            const error = `Maximum concurrent tasks reached (${this.workerConfig.maxConcurrentTasks})`;
            this.logger.warn('Task execution rejected', {
                correlationId,
                taskId: validatedRequest.id,
                reason: error,
                activeTasks: this.activeTasks.size,
            });
            return {
                taskId: validatedRequest.id,
                success: false,
                state: worker_config_1.TaskState.FAILED,
                error,
                correlationId,
                startTime: new Date(),
                endTime: new Date(),
            };
        }
        const context = {
            taskId: validatedRequest.id,
            correlationId,
            startTime: new Date(),
        };
        this.activeTasks.set(validatedRequest.id, context);
        try {
            const configValidation = this.claudeCodeClient.validateConfiguration(validatedRequest.options, correlationId);
            if (!configValidation.valid) {
                throw new Error(`Configuration validation failed: ${configValidation.errors?.join(', ')}`);
            }
            const processConfig = {
                jobId: validatedRequest.id,
                sessionName: validatedRequest.sessionName,
                workingDirectory: validatedRequest.workingDirectory,
                pythonExecutable: this.workerConfig.pythonExecutable,
                wrapperScriptPath: this.workerConfig.wrapperScriptPath,
                unbuffered: true,
            };
            const process = await this.processManager.spawnClaudeProcess(processConfig);
            context.process = process;
            context.pid = process.pid;
            const sessionLogsPath = this.generateSessionLogsPath(validatedRequest.sessionName);
            context.sessionLogsPath = sessionLogsPath;
            await this.stateMonitor.startMonitoring(validatedRequest.id, process.pid, sessionLogsPath);
            this.setupTaskTimeout(validatedRequest.id, validatedRequest.timeoutMs, correlationId);
            await this.claudeCodeClient.sendPrompt(process, validatedRequest.prompt, validatedRequest.options, correlationId);
            const result = await this.handleProcessExecution(context, validatedRequest.options);
            this.logger.log('Task execution completed', {
                correlationId,
                taskId: validatedRequest.id,
                success: result.success,
                state: result.state,
                executionTime: result.endTime ? result.endTime.getTime() - result.startTime.getTime() : 0,
            });
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Task execution failed', {
                correlationId,
                taskId: validatedRequest.id,
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
            });
            await this.cleanupTask(validatedRequest.id);
            const result = {
                taskId: validatedRequest.id,
                success: false,
                state: worker_config_1.TaskState.FAILED,
                error: errorMessage,
                correlationId,
                startTime: context.startTime,
                endTime: new Date(),
                pid: context.pid,
            };
            this.taskResults.set(validatedRequest.id, result);
            return result;
        }
    }
    getTaskStatus(taskId) {
        const activeTask = this.activeTasks.get(taskId);
        if (activeTask) {
            const processState = activeTask.pid
                ? this.stateMonitor.getProcessState(activeTask.pid)
                : undefined;
            return {
                taskId,
                success: false,
                state: processState?.state || worker_config_1.TaskState.RUNNING,
                correlationId: activeTask.correlationId,
                startTime: activeTask.startTime,
                pid: activeTask.pid,
            };
        }
        return this.taskResults.get(taskId);
    }
    async cancelTask(taskId) {
        const context = this.activeTasks.get(taskId);
        if (!context) {
            this.logger.warn('Attempted to cancel non-existent task', { taskId });
            return false;
        }
        this.logger.log('Cancelling task', {
            correlationId: context.correlationId,
            taskId,
            pid: context.pid,
        });
        try {
            if (context.pid) {
                await this.processManager.terminateProcess(context.pid);
            }
            if (context.pid) {
                await this.stateMonitor.transitionState(context.pid, worker_config_1.TaskState.CANCELLED, 'Task manually cancelled');
            }
            await this.cleanupTask(taskId);
            const result = {
                taskId,
                success: false,
                state: worker_config_1.TaskState.CANCELLED,
                correlationId: context.correlationId,
                startTime: context.startTime,
                endTime: new Date(),
                pid: context.pid,
            };
            this.taskResults.set(taskId, result);
            this.logger.log('Task cancelled successfully', {
                correlationId: context.correlationId,
                taskId,
                pid: context.pid,
            });
            return true;
        }
        catch (error) {
            this.logger.error('Error cancelling task', {
                correlationId: context.correlationId,
                taskId,
                pid: context.pid,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
    getActiveTasks() {
        return Array.from(this.activeTasks.keys());
    }
    getHealthStatus() {
        return {
            activeTasks: this.activeTasks.size,
            maxConcurrentTasks: this.workerConfig.maxConcurrentTasks,
            activeProcesses: this.processManager.getActiveProcesses(),
            uptime: process.uptime(),
        };
    }
    async handleProcessExecution(context, options) {
        const { taskId, correlationId, process, pid } = context;
        if (!process || !pid) {
            throw new Error('Process not initialized');
        }
        return new Promise((resolve, reject) => {
            let outputBuffer = '';
            let hasResolved = false;
            let lastNormalized = null;
            const resolveOnce = (result) => {
                if (!hasResolved) {
                    hasResolved = true;
                    resolve(result);
                }
            };
            const rejectOnce = (error) => {
                if (!hasResolved) {
                    hasResolved = true;
                    reject(error);
                }
            };
            process.stdout?.on('data', (data) => {
                const output = data.toString();
                outputBuffer += output;
                const lines = outputBuffer.split('\n');
                outputBuffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) {
                        continue;
                    }
                    const parsed = this.claudeCodeClient.parseResponse(trimmedLine, correlationId);
                    const normalized = this.claudeCodeClient.toNormalizedEvent(parsed);
                    if (normalized) {
                        this.eventEmitter.emit('worker.normalized', {
                            ...normalized,
                            correlationId,
                            taskId,
                            pid,
                        });
                        const termOutcomes = new Set(['completed', 'failed', 'timeout', 'shutdown']);
                        const termStatuses = new Set(['completed', 'failed', 'timeout', 'shutdown']);
                        if ((normalized.outcome && termOutcomes.has(normalized.outcome)) ||
                            (normalized.status && termStatuses.has(normalized.status))) {
                            lastNormalized = {
                                event: normalized.event,
                                outcome: normalized.outcome ?? null,
                                reason: normalized.reason ?? null,
                                tags: normalized.tags,
                                message: normalized.message,
                                status: normalized.status ?? null,
                            };
                        }
                    }
                    const status = parsed.status ?? parsed.data?.status ?? null;
                    const returnCode = parsed.returnCode ??
                        parsed.data?.return_code ??
                        (typeof parsed.data?.returnCode === 'number'
                            ? parsed.data.returnCode
                            : undefined);
                    if (!parsed.success) {
                        resolveOnce({
                            taskId,
                            success: false,
                            state: worker_config_1.TaskState.FAILED,
                            error: this.claudeCodeClient.extractErrorMessage(parsed),
                            correlationId,
                            startTime: context.startTime,
                            endTime: new Date(),
                            pid,
                        });
                        continue;
                    }
                    if (!status) {
                        continue;
                    }
                    switch (status) {
                        case 'completed':
                            if (this.claudeCodeClient.isSuccessResponse(parsed)) {
                                resolveOnce({
                                    taskId,
                                    success: true,
                                    state: worker_config_1.TaskState.COMPLETED,
                                    output: parsed.data?.message,
                                    correlationId,
                                    startTime: context.startTime,
                                    endTime: new Date(),
                                    pid,
                                    outcome: lastNormalized?.outcome ?? undefined,
                                    reason: lastNormalized?.reason ?? undefined,
                                    tags: lastNormalized?.tags ?? undefined,
                                    normalizedMessage: lastNormalized?.message ?? parsed.data?.message,
                                });
                            }
                            else {
                                resolveOnce({
                                    taskId,
                                    success: false,
                                    state: worker_config_1.TaskState.FAILED,
                                    error: this.claudeCodeClient.extractErrorMessage(parsed),
                                    correlationId,
                                    startTime: context.startTime,
                                    endTime: new Date(),
                                    pid,
                                    outcome: lastNormalized?.outcome ?? 'failed',
                                    reason: lastNormalized?.reason ?? undefined,
                                    tags: lastNormalized?.tags ?? undefined,
                                    normalizedMessage: lastNormalized?.message ?? undefined,
                                });
                            }
                            break;
                        case 'failed':
                        case 'error':
                        case 'timeout':
                            resolveOnce({
                                taskId,
                                success: false,
                                state: worker_config_1.TaskState.FAILED,
                                error: this.claudeCodeClient.extractErrorMessage(parsed),
                                correlationId,
                                startTime: context.startTime,
                                endTime: new Date(),
                                pid,
                                outcome: lastNormalized?.outcome ?? 'failed',
                                reason: lastNormalized?.reason ?? undefined,
                                tags: lastNormalized?.tags ?? undefined,
                                normalizedMessage: lastNormalized?.message ?? undefined,
                            });
                            break;
                        case 'running':
                        case 'started':
                            if (context.onProgressCallback && parsed.data?.message) {
                                context.onProgressCallback(parsed.data.message);
                            }
                            break;
                        default:
                            if (['ready', 'state'].includes(parsed.event ?? '')) {
                                break;
                            }
                            if (returnCode !== undefined && returnCode !== 0) {
                                resolveOnce({
                                    taskId,
                                    success: false,
                                    state: worker_config_1.TaskState.FAILED,
                                    error: this.claudeCodeClient.extractErrorMessage(parsed),
                                    correlationId,
                                    startTime: context.startTime,
                                    endTime: new Date(),
                                    pid,
                                });
                            }
                            break;
                    }
                }
            });
            process.stderr?.on('data', (data) => {
                this.logger.warn('Process stderr output', {
                    correlationId,
                    taskId,
                    pid,
                    stderr: data.toString().trim(),
                });
            });
            process.on('exit', (code, signal) => {
                this.logger.log('Process exited', {
                    correlationId,
                    taskId,
                    pid,
                    exitCode: code,
                    signal,
                });
                if (!hasResolved) {
                    const state = code === 0 ? worker_config_1.TaskState.COMPLETED : worker_config_1.TaskState.FAILED;
                    const success = code === 0;
                    resolveOnce({
                        taskId,
                        success,
                        state,
                        error: success ? undefined : `Process exited with code ${code}`,
                        correlationId,
                        startTime: context.startTime,
                        endTime: new Date(),
                        pid,
                        outcome: lastNormalized?.outcome ?? (success ? 'completed' : 'failed'),
                        reason: lastNormalized?.reason ?? undefined,
                        tags: lastNormalized?.tags ?? undefined,
                        normalizedMessage: lastNormalized?.message ?? undefined,
                    });
                }
            });
            process.on('error', (error) => {
                this.logger.error('Process error', {
                    correlationId,
                    taskId,
                    pid,
                    error: error.message,
                });
                rejectOnce(error);
            });
        });
    }
    setupEventListeners() {
        this.eventEmitter.on('process.stateTransition', (transition) => {
            this.handleStateTransition(transition);
        });
        this.eventEmitter.on('fileSystem.activity', (activity) => {
            this.handleFileSystemActivity(activity);
        });
        this.eventEmitter.on('claude.response.received', (event) => {
            this.handleClaudeResponse(event);
        });
        this.eventEmitter.on('claude.client.error', (error) => {
            this.handleClaudeError(error);
        });
    }
    handleStateTransition(transition) {
        const context = Array.from(this.activeTasks.values())
            .find(ctx => ctx.pid === transition.pid);
        if (context && context.onStateChangeCallback) {
            context.onStateChangeCallback(transition.toState);
        }
        this.logger.debug('Process state transition', {
            correlationId: transition.correlationId,
            taskId: transition.taskId,
            pid: transition.pid,
            fromState: transition.fromState,
            toState: transition.toState,
            reason: transition.reason,
        });
    }
    handleFileSystemActivity(activity) {
        this.logger.debug('File system activity', {
            correlationId: activity.correlationId,
            taskId: activity.taskId,
            pid: activity.pid,
            filePath: activity.filePath,
            eventType: activity.eventType,
        });
    }
    handleClaudeResponse(event) {
        this.logger.debug('Claude Code response received', {
            correlationId: event.correlationId,
            status: event.status,
            pid: event.pid,
        });
    }
    handleClaudeError(error) {
        this.logger.error('Claude Code client error', {
            correlationId: error.correlationId,
            type: error.type,
            message: error.message,
        });
    }
    setupTaskTimeout(taskId, timeoutMs, correlationId) {
        const timeout = setTimeout(async () => {
            this.logger.warn('Task timeout reached', {
                correlationId,
                taskId,
                timeoutMs,
            });
            await this.cancelTask(taskId);
        }, timeoutMs);
        this.taskTimeouts.set(taskId, timeout);
    }
    generateSessionLogsPath(sessionName) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return (0, path_1.join)('sessions', sessionName, timestamp);
    }
    async cleanupTask(taskId) {
        const context = this.activeTasks.get(taskId);
        if (!context) {
            return;
        }
        const timeout = this.taskTimeouts.get(taskId);
        if (timeout) {
            clearTimeout(timeout);
            this.taskTimeouts.delete(taskId);
        }
        if (context.pid) {
            await this.stateMonitor.stopMonitoring(context.pid);
        }
        this.activeTasks.delete(taskId);
    }
};
exports.WorkerService = WorkerService;
__decorate([
    (0, event_emitter_1.OnEvent)('process.stateTransition'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WorkerService.prototype, "handleStateTransition", null);
__decorate([
    (0, event_emitter_1.OnEvent)('fileSystem.activity'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WorkerService.prototype, "handleFileSystemActivity", null);
exports.WorkerService = WorkerService = WorkerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        event_emitter_1.EventEmitter2,
        process_manager_service_1.ProcessManagerService,
        state_monitor_service_1.StateMonitorService,
        claude_code_client_service_1.ClaudeCodeClientService,
        ContractRegistry_1.ContractRegistry])
], WorkerService);
//# sourceMappingURL=worker.service.js.map