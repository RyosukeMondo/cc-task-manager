import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as chokidar from 'chokidar';
import { debounce, throttle } from 'lodash-es';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { validateTaskStatus } from '@cc-task-manager/schemas';
import { WorkerConfig, TaskStatus } from '@cc-task-manager/types';
import { TaskState } from '@cc-task-manager/types';

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

@Injectable()
export class StateMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StateMonitorService.name);
  private readonly workerConfig: WorkerConfig;
  
  // File system monitoring
  private fileWatcher: chokidar.FSWatcher | null = null;
  private readonly watchedPaths = new Map<string, Set<number>>();
  
  // Process state management
  private readonly processStates = new Map<number, TaskStatus>();
  private readonly stateTimers = new Map<number, NodeJS.Timeout>();
  private readonly lastActivity = new Map<number, Date>();
  
  // Health monitoring
  private pidCheckInterval: NodeJS.Timeout | null = null;
  private readonly pidHealthChecks = new Map<number, {
    consecutiveFailures: number;
    lastCheckTime: Date;
    correlationId: string;
  }>();

  // Debounced and throttled functions
  private readonly debouncedFileChange: (filePath: string, eventType: string) => void;
  private readonly throttledStateCheck: (pid: number) => void;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.workerConfig = this.configService.get<WorkerConfig>('worker')!;
    
    // Create debounced file change handler to avoid rapid fire events
    this.debouncedFileChange = debounce(
      this.handleFileSystemEvent.bind(this),
      this.workerConfig.awaitWriteFinishMs || 100
    );
    
    // Create throttled state check to prevent excessive CPU usage
    this.throttledStateCheck = throttle(
      this.performPidHealthCheck.bind(this),
      this.workerConfig.pidCheckIntervalMs || 1000
    );
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing StateMonitor service');
    
    // Start PID health monitoring interval
    this.startPidHealthMonitoring();
    
    this.logger.log('StateMonitor service initialized successfully');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down StateMonitor service');
    
    // Stop file system monitoring
    if (this.fileWatcher) {
      await this.fileWatcher.close();
      this.fileWatcher = null;
    }
    
    // Clear all intervals and timers
    if (this.pidCheckInterval) {
      clearInterval(this.pidCheckInterval);
      this.pidCheckInterval = null;
    }
    
    // Clear all state transition timers
    for (const timer of this.stateTimers.values()) {
      clearTimeout(timer);
    }
    this.stateTimers.clear();
    
    this.logger.log('StateMonitor service shut down successfully');
  }

  /**
   * Start monitoring a process for state changes and file system activity
   * @param taskId Unique task identifier
   * @param pid Process ID to monitor
   * @param sessionLogsPath Path to session logs directory for file monitoring
   */
  async startMonitoring(taskId: string, pid: number, sessionLogsPath?: string): Promise<void> {
    const correlationId = randomUUID();
    
    this.logger.log('Starting process monitoring', {
      correlationId,
      taskId,
      pid,
      sessionLogsPath,
    });

    // Initialize process state
    const initialState: TaskStatus = {
      taskId,
      state: TaskState.RUNNING,
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

    // Start file system monitoring if session logs path is provided
    if (sessionLogsPath && this.workerConfig.sessionLogsDir) {
      await this.startFileSystemMonitoring(taskId, pid, sessionLogsPath, correlationId);
    }

    // Set up inactivity timeout
    this.setupInactivityTimeout(taskId, pid, correlationId);

    this.logger.log('Process monitoring started successfully', {
      correlationId,
      taskId,
      pid,
      initialState: initialState.state,
    });
  }

  /**
   * Stop monitoring a process and clean up resources
   * @param pid Process ID to stop monitoring
   */
  async stopMonitoring(pid: number): Promise<void> {
    const state = this.processStates.get(pid);
    const correlationId = this.pidHealthChecks.get(pid)?.correlationId || randomUUID();
    
    this.logger.log('Stopping process monitoring', {
      correlationId,
      pid,
      taskId: state?.taskId,
      finalState: state?.state,
    });

    // Clear state transition timer
    const timer = this.stateTimers.get(pid);
    if (timer) {
      clearTimeout(timer);
      this.stateTimers.delete(pid);
    }

    // Remove from file system monitoring
    this.removeFromFileSystemMonitoring(pid);
    
    // Clean up tracking maps
    this.processStates.delete(pid);
    this.lastActivity.delete(pid);
    this.pidHealthChecks.delete(pid);

    this.logger.log('Process monitoring stopped', {
      correlationId,
      pid,
      taskId: state?.taskId,
    });
  }

  /**
   * Get current state of a monitored process
   * @param pid Process ID to check
   * @returns Current TaskStatus or undefined if not monitored
   */
  getProcessState(pid: number): TaskStatus | undefined {
    return this.processStates.get(pid);
  }

  /**
   * Get all currently monitored processes
   * @returns Array of all monitored process states
   */
  getAllProcessStates(): TaskStatus[] {
    return Array.from(this.processStates.values());
  }

  /**
   * Manually trigger a state transition for a process
   * @param pid Process ID
   * @param newState New state to transition to
   * @param reason Reason for the transition
   */
  async transitionState(pid: number, newState: TaskState, reason: string): Promise<void> {
    const currentState = this.processStates.get(pid);
    if (!currentState) {
      this.logger.warn('Attempted state transition on non-monitored process', {
        pid,
        newState,
        reason,
      });
      return;
    }

    await this.performStateTransition(
      pid,
      currentState.state,
      newState,
      reason,
      this.pidHealthChecks.get(pid)?.correlationId || randomUUID()
    );
  }

  /**
   * Update last activity timestamp for a process
   * @param pid Process ID
   */
  updateActivity(pid: number): void {
    const now = new Date();
    this.lastActivity.set(pid, now);
    
    const currentState = this.processStates.get(pid);
    if (currentState) {
      currentState.lastActivity = now;
      
      // If process was idle, transition to active
      if (currentState.state === TaskState.IDLE) {
        this.transitionState(pid, TaskState.ACTIVE, 'Activity detected');
      }
      
      // Reset inactivity timeout
      this.setupInactivityTimeout(
        currentState.taskId,
        pid,
        this.pidHealthChecks.get(pid)?.correlationId || randomUUID()
      );
    }
  }

  /**
   * Start file system monitoring for a process
   */
  private async startFileSystemMonitoring(
    taskId: string,
    pid: number,
    sessionLogsPath: string,
    correlationId: string
  ): Promise<void> {
    const watchPath = this.workerConfig.sessionLogsDir 
      ? join(this.workerConfig.sessionLogsDir, sessionLogsPath)
      : sessionLogsPath;

    this.logger.log('Starting file system monitoring', {
      correlationId,
      taskId,
      pid,
      watchPath,
    });

    // Initialize file system watcher if not already created
    if (!this.fileWatcher) {
      this.fileWatcher = chokidar.watch([], {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: this.workerConfig.awaitWriteFinish ? {
          stabilityThreshold: this.workerConfig.awaitWriteFinishMs || 100,
          pollInterval: 50,
        } : false,
      });

      // Set up event handlers
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

    // Add path to watcher and track association
    this.fileWatcher.add(watchPath);
    
    if (!this.watchedPaths.has(watchPath)) {
      this.watchedPaths.set(watchPath, new Set());
    }
    this.watchedPaths.get(watchPath)!.add(pid);
  }

  /**
   * Remove a process from file system monitoring
   */
  private removeFromFileSystemMonitoring(pid: number): void {
    // Remove PID from all watched paths
    for (const [path, pids] of this.watchedPaths.entries()) {
      if (pids.has(pid)) {
        pids.delete(pid);
        
        // If no more PIDs are watching this path, remove it from watcher
        if (pids.size === 0) {
          this.watchedPaths.delete(path);
          if (this.fileWatcher) {
            this.fileWatcher.unwatch(path);
          }
        }
      }
    }
  }

  /**
   * Handle file system events
   */
  private handleFileSystemEvent(filePath: string, eventType: string): void {
    // Find all PIDs monitoring the path containing this file
    const affectedPids: number[] = [];
    
    for (const [watchPath, pids] of this.watchedPaths.entries()) {
      if (filePath.startsWith(watchPath)) {
        affectedPids.push(...Array.from(pids));
      }
    }

    // Update activity for all affected processes
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

        // Emit file system activity event
        const activity: FileSystemActivity = {
          taskId: state.taskId,
          pid,
          filePath,
          eventType: eventType as 'add' | 'change' | 'unlink',
          timestamp: new Date(),
          correlationId: this.pidHealthChecks.get(pid)?.correlationId || randomUUID(),
        };

        this.eventEmitter.emit('fileSystem.activity', activity);
      }
    }
  }

  /**
   * Start PID health monitoring interval
   */
  private startPidHealthMonitoring(): void {
    this.pidCheckInterval = setInterval(() => {
      for (const pid of this.processStates.keys()) {
        this.throttledStateCheck(pid);
      }
    }, this.workerConfig.pidCheckIntervalMs);
  }

  /**
   * Perform health check on a specific PID
   */
  private performPidHealthCheck(pid: number): void {
    const healthCheck = this.pidHealthChecks.get(pid);
    const state = this.processStates.get(pid);
    
    if (!healthCheck || !state) {
      return;
    }

    try {
      // Check if process is still alive
      process.kill(pid, 0);
      
      // Process is alive - reset failure count
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
      
    } catch (error) {
      // Process is not alive
      healthCheck.consecutiveFailures++;
      healthCheck.lastCheckTime = new Date();
      
      this.logger.warn('Process health check failed', {
        correlationId: healthCheck.correlationId,
        pid,
        taskId: state.taskId,
        consecutiveFailures: healthCheck.consecutiveFailures,
        error: error instanceof Error ? error.message : String(error),
      });

      // If process is confirmed dead, transition to failed state
      if (state.state !== TaskState.FAILED && state.state !== TaskState.COMPLETED) {
        this.performStateTransition(
          pid,
          state.state,
          TaskState.FAILED,
          `Process health check failed (${healthCheck.consecutiveFailures} consecutive failures)`,
          healthCheck.correlationId
        );
      }
    }
  }

  /**
   * Set up inactivity timeout for a process
   */
  private setupInactivityTimeout(taskId: string, pid: number, correlationId: string): void {
    // Clear existing timer
    const existingTimer = this.stateTimers.get(pid);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new inactivity timer
    const timer = setTimeout(() => {
      const currentState = this.processStates.get(pid);
      if (currentState && currentState.state === TaskState.ACTIVE) {
        this.performStateTransition(
          pid,
          TaskState.ACTIVE,
          TaskState.IDLE,
          'Inactivity timeout reached',
          correlationId
        );
      }
    }, this.workerConfig.inactivityTimeoutMs);

    this.stateTimers.set(pid, timer);
  }

  /**
   * Perform a state transition and emit events
   */
  private async performStateTransition(
    pid: number,
    fromState: TaskState,
    toState: TaskState,
    reason: string,
    correlationId: string
  ): Promise<void> {
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

    // Update state
    state.state = toState;
    state.lastActivity = new Date();

    // Create transition event
    const transition: ProcessStateTransition = {
      taskId: state.taskId,
      pid,
      fromState,
      toState,
      timestamp: new Date(),
      reason,
      correlationId,
    };

    // Emit state transition event
    this.eventEmitter.emit('process.stateTransition', transition);

    // Handle specific state transitions
    switch (toState) {
      case TaskState.COMPLETED:
      case TaskState.FAILED:
      case TaskState.CANCELLED:
        // Stop monitoring terminated processes after a short delay
        setTimeout(() => {
          this.stopMonitoring(pid);
        }, 1000);
        break;
        
      case TaskState.ACTIVE:
        // Reset inactivity timeout when becoming active
        this.setupInactivityTimeout(state.taskId, pid, correlationId);
        break;
    }
  }
}