import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { ChildProcess } from 'child_process';
import { WorkerService, TaskExecutionResult, TaskExecutionContext } from '../worker.service';
import { ProcessManagerService } from '../process-manager.service';
import { StateMonitorService, ProcessStateTransition, FileSystemActivity } from '../state-monitor.service';
import { ClaudeCodeClientService, ParsedResponse } from '../claude-code-client.service';
import { WorkerConfig, TaskExecutionRequest, TaskState } from '../../config/worker.config';


describe('WorkerService', () => {
  let service: WorkerService;
  let eventEmitter: EventEmitter2;
  let processManager: ProcessManagerService;
  let stateMonitor: StateMonitorService;
  let claudeCodeClient: ClaudeCodeClientService;
  let mockWorkerConfig: WorkerConfig;
  let mockChildProcess: any;

  beforeEach(async () => {
    mockWorkerConfig = {
      pythonExecutable: '/usr/bin/python3',
      gracefulShutdownMs: 5000,
      maxConcurrentTasks: 5,
      processTimeoutMs: 30000,
      pidCheckIntervalMs: 1000,
      fileWatchTimeoutMs: 30000,
      inactivityTimeoutMs: 120000,
      wrapperScriptPath: '/path/to/wrapper.py',
      wrapperWorkingDir: '/tmp/claude-sessions',
      queueName: 'claude-code-tasks',
      redisHost: 'localhost',
      redisPort: 6379,
      logLevel: 'info',
      enableDetailedLogs: false,
      sessionLogsDir: '/tmp/claude-logs',
      awaitWriteFinish: true,
      awaitWriteFinishMs: 100,
    };

    mockChildProcess = {
      pid: 12345,
      stdout: {
        on: jest.fn(),
      },
      stderr: {
        on: jest.fn(),
      },
      on: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'worker') return mockWorkerConfig;
              return undefined;
            }),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            on: jest.fn(),
          },
        },
        {
          provide: ProcessManagerService,
          useValue: {
            spawnClaudeProcess: jest.fn(),
            terminateProcess: jest.fn(),
            getActiveProcesses: jest.fn(() => []),
          },
        },
        {
          provide: StateMonitorService,
          useValue: {
            startMonitoring: jest.fn(),
            stopMonitoring: jest.fn(),
            getProcessState: jest.fn(),
            transitionState: jest.fn(),
          },
        },
        {
          provide: ClaudeCodeClientService,
          useValue: {
            validateConfiguration: jest.fn(() => ({ valid: true })),
            sendPrompt: jest.fn(),
            parseResponse: jest.fn(),
            isSuccessResponse: jest.fn(),
            extractErrorMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WorkerService>(WorkerService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    processManager = module.get<ProcessManagerService>(ProcessManagerService);
    stateMonitor = module.get<StateMonitorService>(StateMonitorService);
    claudeCodeClient = module.get<ClaudeCodeClientService>(ClaudeCodeClientService);

    // Setup default mocks
    jest.mocked(processManager.spawnClaudeProcess).mockResolvedValue(mockChildProcess as ChildProcess);
    jest.mocked(stateMonitor.startMonitoring).mockResolvedValue();
    jest.mocked(claudeCodeClient.sendPrompt).mockResolvedValue();

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('onModuleInit', () => {
    it('should initialize successfully', async () => {
      await service.onModuleInit();
      
      expect(eventEmitter.on).toHaveBeenCalledWith('process.stateTransition', expect.any(Function));
      expect(eventEmitter.on).toHaveBeenCalledWith('fileSystem.activity', expect.any(Function));
      expect(eventEmitter.on).toHaveBeenCalledWith('claude.response.received', expect.any(Function));
      expect(eventEmitter.on).toHaveBeenCalledWith('claude.client.error', expect.any(Function));
    });
  });

  describe('executeTask', () => {
    const mockRequest: TaskExecutionRequest = {
      id: 'test-task-123',
      prompt: 'Test prompt for Claude Code',
      sessionName: 'test-session',
      workingDirectory: '/tmp/test-work',
      timeoutMs: 30000,
      options: {
        model: 'claude-3-sonnet',
        timeout: 300,
      },
    };

    it('should reject task when concurrent limit reached', async () => {
      // Fill up concurrent task slots
      for (let i = 0; i < mockWorkerConfig.maxConcurrentTasks; i++) {
        service['activeTasks'].set(`task-${i}`, {
          taskId: `task-${i}`,
          correlationId: `corr-${i}`,
          startTime: new Date(),
        });
      }

      const result = await service.executeTask(mockRequest);

      expect(result.success).toBe(false);
      expect(result.state).toBe(TaskState.FAILED);
      expect(result.error).toContain('Maximum concurrent tasks reached');
      expect(processManager.spawnClaudeProcess).not.toHaveBeenCalled();
    });

    it('should handle configuration validation failure', async () => {
      jest.mocked(claudeCodeClient.validateConfiguration).mockReturnValue({
        valid: false,
        errors: ['Invalid model', 'Invalid timeout'],
      });

      const result = await service.executeTask(mockRequest);

      expect(result.success).toBe(false);
      expect(result.state).toBe(TaskState.FAILED);
      expect(result.error).toContain('Configuration validation failed');
    });

    it('should handle process spawn failure', async () => {
      jest.mocked(processManager.spawnClaudeProcess).mockRejectedValue(
        new Error('Failed to spawn process')
      );

      const result = await service.executeTask(mockRequest);

      expect(result.success).toBe(false);
      expect(result.state).toBe(TaskState.FAILED);
      expect(result.error).toBe('Failed to spawn process');
    });
  });

  describe('getTaskStatus', () => {
    it('should return status for active task', () => {
      const taskId = 'test-task-123';
      const context: TaskExecutionContext = {
        taskId,
        correlationId: 'test-correlation-id',
        startTime: new Date(),
        pid: 12345,
      };

      service['activeTasks'].set(taskId, context);

      jest.mocked(stateMonitor.getProcessState).mockReturnValue({
        taskId,
        state: TaskState.RUNNING,
        pid: 12345,
        lastActivity: new Date(),
      });

      const status = service.getTaskStatus(taskId);

      expect(status).toBeDefined();
      expect(status!.taskId).toBe(taskId);
      expect(status!.state).toBe(TaskState.RUNNING);
      expect(status!.pid).toBe(12345);
      expect(status!.success).toBe(false);
    });

    it('should return status for completed task', () => {
      const taskId = 'test-task-123';
      const result: TaskExecutionResult = {
        taskId,
        success: true,
        state: TaskState.COMPLETED,
        correlationId: 'test-correlation-id',
        startTime: new Date(),
        endTime: new Date(),
        pid: 12345,
      };

      service['taskResults'].set(taskId, result);

      const status = service.getTaskStatus(taskId);

      expect(status).toEqual(result);
    });

    it('should return undefined for unknown task', () => {
      const status = service.getTaskStatus('unknown-task');
      expect(status).toBeUndefined();
    });
  });

  describe('cancelTask', () => {
    it('should cancel active task successfully', async () => {
      const taskId = 'test-task-123';
      const context: TaskExecutionContext = {
        taskId,
        correlationId: 'test-correlation-id',
        startTime: new Date(),
        pid: 12345,
      };

      service['activeTasks'].set(taskId, context);

      const result = await service.cancelTask(taskId);

      expect(result).toBe(true);
      expect(processManager.terminateProcess).toHaveBeenCalledWith(12345);
      expect(stateMonitor.transitionState).toHaveBeenCalledWith(
        12345,
        TaskState.CANCELLED,
        'Task manually cancelled'
      );
      expect(service['activeTasks'].has(taskId)).toBe(false);
      
      const taskResult = service.getTaskStatus(taskId);
      expect(taskResult?.state).toBe(TaskState.CANCELLED);
    });

    it('should return false for non-existent task', async () => {
      const result = await service.cancelTask('unknown-task');
      
      expect(result).toBe(false);
      expect(processManager.terminateProcess).not.toHaveBeenCalled();
    });

    it('should handle termination errors gracefully', async () => {
      const taskId = 'test-task-123';
      const context: TaskExecutionContext = {
        taskId,
        correlationId: 'test-correlation-id',
        startTime: new Date(),
        pid: 12345,
      };

      service['activeTasks'].set(taskId, context);
      jest.mocked(processManager.terminateProcess).mockRejectedValue(
        new Error('Termination failed')
      );

      const result = await service.cancelTask(taskId);

      expect(result).toBe(false);
    });
  });

  describe('getActiveTasks', () => {
    it('should return empty array when no active tasks', () => {
      const activeTasks = service.getActiveTasks();
      expect(activeTasks).toEqual([]);
    });

    it('should return array of active task IDs', () => {
      service['activeTasks'].set('task-1', {
        taskId: 'task-1',
        correlationId: 'corr-1',
        startTime: new Date(),
      });
      service['activeTasks'].set('task-2', {
        taskId: 'task-2',
        correlationId: 'corr-2',
        startTime: new Date(),
      });

      const activeTasks = service.getActiveTasks();
      expect(activeTasks).toEqual(['task-1', 'task-2']);
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status information', () => {
      service['activeTasks'].set('task-1', {
        taskId: 'task-1',
        correlationId: 'corr-1',
        startTime: new Date(),
      });

      jest.mocked(processManager.getActiveProcesses).mockReturnValue([12345, 12346]);

      const health = service.getHealthStatus();

      expect(health.activeTasks).toBe(1);
      expect(health.maxConcurrentTasks).toBe(5);
      expect(health.activeProcesses).toEqual([12345, 12346]);
      expect(health.uptime).toBeGreaterThan(0);
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('should handle state transition events', () => {
      const transition: ProcessStateTransition = {
        taskId: 'test-task-123',
        pid: 12345,
        fromState: TaskState.RUNNING,
        toState: TaskState.ACTIVE,
        timestamp: new Date(),
        reason: 'Activity detected',
        correlationId: 'test-correlation-id',
      };

      const context: TaskExecutionContext = {
        taskId: 'test-task-123',
        correlationId: 'test-correlation-id',
        startTime: new Date(),
        pid: 12345,
        onStateChangeCallback: jest.fn(),
      };

      service['activeTasks'].set('test-task-123', context);

      // Simulate event emission
      service['handleStateTransition'](transition);

      expect(context.onStateChangeCallback).toHaveBeenCalledWith(TaskState.ACTIVE);
    });

    it('should handle file system activity events', () => {
      const activity: FileSystemActivity = {
        taskId: 'test-task-123',
        pid: 12345,
        filePath: '/tmp/test/output.log',
        eventType: 'change',
        timestamp: new Date(),
        correlationId: 'test-correlation-id',
      };

      // Should not throw
      expect(() => service['handleFileSystemActivity'](activity)).not.toThrow();
    });

    it('should handle Claude response events', () => {
      const event = {
        correlationId: 'test-correlation-id',
        status: 'running',
        pid: 12345,
        timestamp: new Date(),
      };

      // Should not throw
      expect(() => service['handleClaudeResponse'](event)).not.toThrow();
    });

    it('should handle Claude error events', () => {
      const error = {
        correlationId: 'test-correlation-id',
        type: 'sdk',
        message: 'Claude SDK error',
        timestamp: new Date(),
      };

      // Should not throw
      expect(() => service['handleClaudeError'](error)).not.toThrow();
    });
  });

  describe('task timeout handling', () => {
    it('should set up task timeout correctly', async () => {
      jest.useFakeTimers();
      
      const taskId = 'test-task-123';
      const timeoutMs = 5000;
      
      service['setupTaskTimeout'](taskId, timeoutMs, 'test-correlation-id');
      
      // Verify timeout was set
      expect(service['taskTimeouts'].has(taskId)).toBe(true);
      
      jest.useRealTimers();
    });
  });

  describe('task cleanup', () => {
    it('should clean up task resources', async () => {
      jest.useFakeTimers();
      
      const taskId = 'test-task-123';
      const context: TaskExecutionContext = {
        taskId,
        correlationId: 'test-correlation-id',
        startTime: new Date(),
        pid: 12345,
      };

      service['activeTasks'].set(taskId, context);
      service['setupTaskTimeout'](taskId, 5000, 'test-correlation-id');

      await service['cleanupTask'](taskId);

      expect(service['activeTasks'].has(taskId)).toBe(false);
      expect(service['taskTimeouts'].has(taskId)).toBe(false);
      expect(stateMonitor.stopMonitoring).toHaveBeenCalledWith(12345);
      
      jest.useRealTimers();
    });

    it('should handle cleanup when task does not exist', async () => {
      // Should not throw
      await expect(service['cleanupTask']('unknown-task')).resolves.not.toThrow();
    });
  });

  describe('session logs path generation', () => {
    it('should generate unique session logs path', () => {
      const sessionName = 'test-session';
      
      const path1 = service['generateSessionLogsPath'](sessionName);
      const path2 = service['generateSessionLogsPath'](sessionName);
      
      expect(path1).toContain('sessions');
      expect(path1).toContain(sessionName);
      expect(path1).not.toBe(path2); // Should be unique due to timestamp
    });
  });

  describe('error scenarios', () => {
    it('should handle missing worker configuration', () => {
      const configServiceWithoutConfig = {
        get: jest.fn(() => undefined),
      };

      expect(() => {
        new WorkerService(
          configServiceWithoutConfig as any,
          eventEmitter,
          processManager,
          stateMonitor,
          claudeCodeClient
        );
      }).toThrow();
    });

    it('should handle process execution without PID', async () => {
      const context: TaskExecutionContext = {
        taskId: 'test-task-123',
        correlationId: 'test-correlation-id',
        startTime: new Date(),
        process: mockChildProcess as ChildProcess,
        // No PID set
      };

      await expect(
        service['handleProcessExecution'](context, {})
      ).rejects.toThrow('Process not initialized');
    });

    it('should handle invalid task execution request', async () => {
      const invalidRequest = {
        id: '', // Invalid empty ID
        prompt: 'Test prompt',
        sessionName: 'test-session',
        workingDirectory: '/tmp/test-work',
        timeoutMs: 30000,
        options: {},
      };

      const result = await service.executeTask(invalidRequest as TaskExecutionRequest);
      
      expect(result.success).toBe(false);
      expect(result.state).toBe(TaskState.FAILED);
    });
  });
});