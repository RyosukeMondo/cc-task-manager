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
var StateMonitorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateMonitorService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const chokidar = require("chokidar");
const lodash_es_1 = require("lodash-es");
const path_1 = require("path");
const crypto_1 = require("crypto");
const worker_config_1 = require("../config/worker.config");
let StateMonitorService = StateMonitorService_1 = class StateMonitorService {
    constructor(configService, eventEmitter) {
        this.configService = configService;
        this.eventEmitter = eventEmitter;
        this.logger = new common_1.Logger(StateMonitorService_1.name);
        this.fileWatcher = null;
        this.watchedPaths = new Map();
        this.processStates = new Map();
        this.stateTimers = new Map();
        this.lastActivity = new Map();
        this.pidCheckInterval = null;
        this.pidHealthChecks = new Map();
        this.workerConfig = this.configService.get('worker');
        this.debouncedFileChange = (0, lodash_es_1.debounce)(this.handleFileSystemEvent.bind(this), this.workerConfig.awaitWriteFinishMs || 100);
        this.throttledStateCheck = (0, lodash_es_1.throttle)(this.performPidHealthCheck.bind(this), this.workerConfig.pidCheckIntervalMs || 1000);
    }
    async onModuleInit() {
        this.logger.log('Initializing StateMonitor service');
        this.startPidHealthMonitoring();
        this.logger.log('StateMonitor service initialized successfully');
    }
    async onModuleDestroy() {
        this.logger.log('Shutting down StateMonitor service');
        if (this.fileWatcher) {
            await this.fileWatcher.close();
            this.fileWatcher = null;
        }
        if (this.pidCheckInterval) {
            clearInterval(this.pidCheckInterval);
            this.pidCheckInterval = null;
        }
        for (const timer of this.stateTimers.values()) {
            clearTimeout(timer);
        }
        this.stateTimers.clear();
        this.logger.log('StateMonitor service shut down successfully');
    }
    async startMonitoring(taskId, pid, sessionLogsPath) {
        const correlationId = (0, crypto_1.randomUUID)();
        this.logger.log('Starting process monitoring', {
            correlationId,
            taskId,
            pid,
            sessionLogsPath,
        });
        const initialState = {
            taskId,
            state: worker_config_1.TaskState.RUNNING,
            pid,
            lastActivity: new Date(),
        };
        this.processStates.set(pid, initialState);
        this.lastActivity.set(pid, new Date());
        this.pidHealthChecks.set(pid, {
            consecutiveFailures: 0,
            lastCheckTime: new Date(),
            correlationId,
        });
        if (sessionLogsPath && this.workerConfig.sessionLogsDir) {
            await this.startFileSystemMonitoring(taskId, pid, sessionLogsPath, correlationId);
        }
        this.setupInactivityTimeout(taskId, pid, correlationId);
        this.logger.log('Process monitoring started successfully', {
            correlationId,
            taskId,
            pid,
            initialState: initialState.state,
        });
    }
    async stopMonitoring(pid) {
        const state = this.processStates.get(pid);
        const correlationId = this.pidHealthChecks.get(pid)?.correlationId || (0, crypto_1.randomUUID)();
        this.logger.log('Stopping process monitoring', {
            correlationId,
            pid,
            taskId: state?.taskId,
            finalState: state?.state,
        });
        const timer = this.stateTimers.get(pid);
        if (timer) {
            clearTimeout(timer);
            this.stateTimers.delete(pid);
        }
        this.removeFromFileSystemMonitoring(pid);
        this.processStates.delete(pid);
        this.lastActivity.delete(pid);
        this.pidHealthChecks.delete(pid);
        this.logger.log('Process monitoring stopped', {
            correlationId,
            pid,
            taskId: state?.taskId,
        });
    }
    getProcessState(pid) {
        return this.processStates.get(pid);
    }
    getAllProcessStates() {
        return Array.from(this.processStates.values());
    }
    async transitionState(pid, newState, reason) {
        const currentState = this.processStates.get(pid);
        if (!currentState) {
            this.logger.warn('Attempted state transition on non-monitored process', {
                pid,
                newState,
                reason,
            });
            return;
        }
        await this.performStateTransition(pid, currentState.state, newState, reason, this.pidHealthChecks.get(pid)?.correlationId || (0, crypto_1.randomUUID)());
    }
    updateActivity(pid) {
        const now = new Date();
        this.lastActivity.set(pid, now);
        const currentState = this.processStates.get(pid);
        if (currentState) {
            currentState.lastActivity = now;
            if (currentState.state === worker_config_1.TaskState.IDLE) {
                this.transitionState(pid, worker_config_1.TaskState.ACTIVE, 'Activity detected');
            }
            this.setupInactivityTimeout(currentState.taskId, pid, this.pidHealthChecks.get(pid)?.correlationId || (0, crypto_1.randomUUID)());
        }
    }
    async startFileSystemMonitoring(taskId, pid, sessionLogsPath, correlationId) {
        const watchPath = this.workerConfig.sessionLogsDir
            ? (0, path_1.join)(this.workerConfig.sessionLogsDir, sessionLogsPath)
            : sessionLogsPath;
        this.logger.log('Starting file system monitoring', {
            correlationId,
            taskId,
            pid,
            watchPath,
        });
        if (!this.fileWatcher) {
            this.fileWatcher = chokidar.watch([], {
                persistent: true,
                ignoreInitial: true,
                awaitWriteFinish: this.workerConfig.awaitWriteFinish ? {
                    stabilityThreshold: this.workerConfig.awaitWriteFinishMs || 100,
                    pollInterval: 50,
                } : false,
            });
            this.fileWatcher.on('add', (filePath) => {
                this.debouncedFileChange(filePath, 'add');
            });
            this.fileWatcher.on('change', (filePath) => {
                this.debouncedFileChange(filePath, 'change');
            });
            this.fileWatcher.on('unlink', (filePath) => {
                this.debouncedFileChange(filePath, 'unlink');
            });
            this.fileWatcher.on('error', (error) => {
                this.logger.error('File watcher error', {
                    error: error.message,
                    stack: error.stack,
                });
            });
        }
        this.fileWatcher.add(watchPath);
        if (!this.watchedPaths.has(watchPath)) {
            this.watchedPaths.set(watchPath, new Set());
        }
        this.watchedPaths.get(watchPath).add(pid);
    }
    removeFromFileSystemMonitoring(pid) {
        for (const [path, pids] of this.watchedPaths.entries()) {
            if (pids.has(pid)) {
                pids.delete(pid);
                if (pids.size === 0) {
                    this.watchedPaths.delete(path);
                    if (this.fileWatcher) {
                        this.fileWatcher.unwatch(path);
                    }
                }
            }
        }
    }
    handleFileSystemEvent(filePath, eventType) {
        const affectedPids = [];
        for (const [watchPath, pids] of this.watchedPaths.entries()) {
            if (filePath.startsWith(watchPath)) {
                affectedPids.push(...Array.from(pids));
            }
        }
        for (const pid of affectedPids) {
            const state = this.processStates.get(pid);
            if (state) {
                this.logger.debug('File system activity detected', {
                    taskId: state.taskId,
                    pid,
                    filePath,
                    eventType,
                });
                this.updateActivity(pid);
                const activity = {
                    taskId: state.taskId,
                    pid,
                    filePath,
                    eventType: eventType,
                    timestamp: new Date(),
                    correlationId: this.pidHealthChecks.get(pid)?.correlationId || (0, crypto_1.randomUUID)(),
                };
                this.eventEmitter.emit('fileSystem.activity', activity);
            }
        }
    }
    startPidHealthMonitoring() {
        this.pidCheckInterval = setInterval(() => {
            for (const pid of this.processStates.keys()) {
                this.throttledStateCheck(pid);
            }
        }, this.workerConfig.pidCheckIntervalMs);
    }
    performPidHealthCheck(pid) {
        const healthCheck = this.pidHealthChecks.get(pid);
        const state = this.processStates.get(pid);
        if (!healthCheck || !state) {
            return;
        }
        try {
            process.kill(pid, 0);
            if (healthCheck.consecutiveFailures > 0) {
                this.logger.log('Process health recovered', {
                    correlationId: healthCheck.correlationId,
                    pid,
                    taskId: state.taskId,
                    previousFailures: healthCheck.consecutiveFailures,
                });
                healthCheck.consecutiveFailures = 0;
            }
            healthCheck.lastCheckTime = new Date();
        }
        catch (error) {
            healthCheck.consecutiveFailures++;
            healthCheck.lastCheckTime = new Date();
            this.logger.warn('Process health check failed', {
                correlationId: healthCheck.correlationId,
                pid,
                taskId: state.taskId,
                consecutiveFailures: healthCheck.consecutiveFailures,
                error: error instanceof Error ? error.message : String(error),
            });
            if (state.state !== worker_config_1.TaskState.FAILED && state.state !== worker_config_1.TaskState.COMPLETED) {
                this.performStateTransition(pid, state.state, worker_config_1.TaskState.FAILED, `Process health check failed (${healthCheck.consecutiveFailures} consecutive failures)`, healthCheck.correlationId);
            }
        }
    }
    setupInactivityTimeout(taskId, pid, correlationId) {
        const existingTimer = this.stateTimers.get(pid);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        const timer = setTimeout(() => {
            const currentState = this.processStates.get(pid);
            if (currentState && currentState.state === worker_config_1.TaskState.ACTIVE) {
                this.performStateTransition(pid, worker_config_1.TaskState.ACTIVE, worker_config_1.TaskState.IDLE, 'Inactivity timeout reached', correlationId);
            }
        }, this.workerConfig.inactivityTimeoutMs);
        this.stateTimers.set(pid, timer);
    }
    async performStateTransition(pid, fromState, toState, reason, correlationId) {
        const state = this.processStates.get(pid);
        if (!state) {
            return;
        }
        this.logger.log('Process state transition', {
            correlationId,
            taskId: state.taskId,
            pid,
            fromState,
            toState,
            reason,
        });
        state.state = toState;
        state.lastActivity = new Date();
        const transition = {
            taskId: state.taskId,
            pid,
            fromState,
            toState,
            timestamp: new Date(),
            reason,
            correlationId,
        };
        this.eventEmitter.emit('process.stateTransition', transition);
        switch (toState) {
            case worker_config_1.TaskState.COMPLETED:
            case worker_config_1.TaskState.FAILED:
            case worker_config_1.TaskState.CANCELLED:
                setTimeout(() => {
                    this.stopMonitoring(pid);
                }, 1000);
                break;
            case worker_config_1.TaskState.ACTIVE:
                this.setupInactivityTimeout(state.taskId, pid, correlationId);
                break;
        }
    }
};
exports.StateMonitorService = StateMonitorService;
exports.StateMonitorService = StateMonitorService = StateMonitorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        event_emitter_1.EventEmitter2])
], StateMonitorService);
//# sourceMappingURL=state-monitor.service.js.map