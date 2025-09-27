import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TaskState, TaskStatus } from '../config/worker.config';
export interface ProcessStateTransition {
    taskId: string;
    pid: number;
    fromState: TaskState;
    toState: TaskState;
    timestamp: Date;
    reason: string;
    correlationId: string;
}
export interface FileSystemActivity {
    taskId: string;
    pid: number;
    filePath: string;
    eventType: 'add' | 'change' | 'unlink';
    timestamp: Date;
    correlationId: string;
}
export declare class StateMonitorService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private readonly eventEmitter;
    private readonly logger;
    private readonly workerConfig;
    private fileWatcher;
    private readonly watchedPaths;
    private readonly processStates;
    private readonly stateTimers;
    private readonly lastActivity;
    private pidCheckInterval;
    private readonly pidHealthChecks;
    private readonly debouncedFileChange;
    private readonly throttledStateCheck;
    constructor(configService: ConfigService, eventEmitter: EventEmitter2);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    startMonitoring(taskId: string, pid: number, sessionLogsPath?: string): Promise<void>;
    stopMonitoring(pid: number): Promise<void>;
    getProcessState(pid: number): TaskStatus | undefined;
    getAllProcessStates(): TaskStatus[];
    transitionState(pid: number, newState: TaskState, reason: string): Promise<void>;
    updateActivity(pid: number): void;
    private startFileSystemMonitoring;
    private removeFromFileSystemMonitoring;
    private handleFileSystemEvent;
    private startPidHealthMonitoring;
    private performPidHealthCheck;
    private setupInactivityTimeout;
    private performStateTransition;
}
