import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChildProcess } from 'child_process';
import { TaskExecutionRequest, TaskState } from '../config/worker.config';
import { ProcessManagerService } from './process-manager.service';
import { StateMonitorService } from './state-monitor.service';
import { ClaudeCodeClientService } from './claude-code-client.service';
import { ContractRegistry } from '../contracts/ContractRegistry';
export interface TaskExecutionResult {
    taskId: string;
    success: boolean;
    state: TaskState;
    output?: string;
    error?: string;
    correlationId: string;
    startTime: Date;
    endTime?: Date;
    pid?: number;
    outcome?: string;
    reason?: string;
    tags?: string[];
    normalizedMessage?: string;
}
export interface TaskExecutionContext {
    taskId: string;
    correlationId: string;
    process?: ChildProcess;
    pid?: number;
    startTime: Date;
    sessionLogsPath?: string;
    onProgressCallback?: (progress: string) => void;
    onStateChangeCallback?: (state: TaskState) => void;
}
export declare class WorkerService implements OnModuleInit {
    private readonly configService;
    private readonly eventEmitter;
    private readonly processManager;
    private readonly stateMonitor;
    private readonly claudeCodeClient;
    private readonly contractRegistry;
    private readonly logger;
    private readonly workerConfig;
    private readonly activeTasks;
    private readonly taskResults;
    private readonly taskTimeouts;
    constructor(configService: ConfigService, eventEmitter: EventEmitter2, processManager: ProcessManagerService, stateMonitor: StateMonitorService, claudeCodeClient: ClaudeCodeClientService, contractRegistry: ContractRegistry);
    onModuleInit(): Promise<void>;
    private registerTaskExecutionContract;
    private validateTaskRequest;
    executeTask(request: TaskExecutionRequest): Promise<TaskExecutionResult>;
    getTaskStatus(taskId: string): TaskExecutionResult | undefined;
    cancelTask(taskId: string): Promise<boolean>;
    getActiveTasks(): string[];
    getHealthStatus(): {
        activeTasks: number;
        maxConcurrentTasks: number;
        activeProcesses: number[];
        uptime: number;
    };
    private handleProcessExecution;
    private setupEventListeners;
    private handleStateTransition;
    private handleFileSystemActivity;
    private handleClaudeResponse;
    private handleClaudeError;
    private setupTaskTimeout;
    private generateSessionLogsPath;
    private cleanupTask;
}
