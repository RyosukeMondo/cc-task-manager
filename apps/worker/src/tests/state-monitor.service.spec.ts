import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import * as chokidar from 'chokidar';
import { StateMonitorService, ProcessStateTransition, FileSystemActivity } from '../state-monitor.service';
import { WorkerConfig, TaskState, TaskStatus } from '../../../../packages/types/src';

// Mock chokidar
const mockWatcher = {
  add: jest.fn(),
  unwatch: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
};

jest.mock('chokidar', () => ({
  watch: jest.fn(() => mockWatcher),
}));

// Mock process.kill for PID health checks
const originalProcessKill = process.kill;

describe('StateMonitorService', () => {
  let service: StateMonitorService;
  let eventEmitter: EventEmitter2;
  let configService: ConfigService;
  let mockWorkerConfig: WorkerConfig;

  beforeEach(async () => {
    mockWorkerConfig = {
      pythonExecutable: '/usr/bin/python3',
      gracefulShutdownMs: 5000,
      maxConcurrentTasks: 10,
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StateMonitorService,
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
          },
        },
      ],
    }).compile();

    service = module.get<StateMonitorService>(StateMonitorService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    configService = module.get<ConfigService>(ConfigService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.kill = originalProcessKill;
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('onModuleInit', () => {
    it('should initialize successfully', async () => {
      jest.useFakeTimers();
      
      await service.onModuleInit();
      
      expect(service).toBeDefined();
      jest.useRealTimers();
    });
  });

  describe('onModuleDestroy', () => {
    it('should clean up resources on destroy', async () => {
      jest.useFakeTimers();
      
      await service.onModuleInit();
      await service.onModuleDestroy();
      
      expect(mockWatcher.close).toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('startMonitoring', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      await service.onModuleInit();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start monitoring a process successfully', async () => {
      const taskId = 'test-task-123';
      const pid = 12345;
      const sessionLogsPath = 'session-logs/test-session';

      await service.startMonitoring(taskId, pid, sessionLogsPath);

      const processState = service.getProcessState(pid);
      expect(processState).toBeDefined();
      expect(processState?.taskId).toBe(taskId);
      expect(processState?.pid).toBe(pid);
      expect(processState?.state).toBe(TaskState.RUNNING);
      expect(chokidar.watch).toHaveBeenCalled();
      expect(mockWatcher.add).toHaveBeenCalledWith('/tmp/claude-logs/session-logs/test-session');
    });

    it('should start monitoring without file system monitoring when no session logs path', async () => {
      const taskId = 'test-task-123';
      const pid = 12345;

      await service.startMonitoring(taskId, pid);

      const processState = service.getProcessState(pid);
      expect(processState).toBeDefined();
      expect(processState?.taskId).toBe(taskId);
      expect(processState?.pid).toBe(pid);
      expect(processState?.state).toBe(TaskState.RUNNING);
      expect(mockWatcher.add).not.toHaveBeenCalled();
    });

    it('should set up inactivity timeout', async () => {
      const taskId = 'test-task-123';
      const pid = 12345;

      await service.startMonitoring(taskId, pid);

      // Fast-forward past inactivity timeout
      jest.advanceTimersByTime(mockWorkerConfig.inactivityTimeoutMs + 1000);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'process.stateTransition',
        expect.objectContaining({
          taskId,
          pid,
          fromState: TaskState.ACTIVE,
          toState: TaskState.IDLE,
          reason: 'Inactivity timeout reached',
        })
      );
    });
  });

  describe('stopMonitoring', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      await service.onModuleInit();
      await service.startMonitoring('test-task-123', 12345, 'session-logs/test-session');
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should stop monitoring and clean up resources', async () => {
      const pid = 12345;

      expect(service.getProcessState(pid)).toBeDefined();

      await service.stopMonitoring(pid);

      expect(service.getProcessState(pid)).toBeUndefined();
      expect(mockWatcher.unwatch).toHaveBeenCalledWith('/tmp/claude-logs/session-logs/test-session');
    });
  });

  describe('getProcessState', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      await service.onModuleInit();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return process state for monitored process', async () => {
      const taskId = 'test-task-123';
      const pid = 12345;

      await service.startMonitoring(taskId, pid);

      const state = service.getProcessState(pid);
      expect(state).toBeDefined();
      expect(state?.taskId).toBe(taskId);
      expect(state?.pid).toBe(pid);
      expect(state?.state).toBe(TaskState.RUNNING);
    });

    it('should return undefined for non-monitored process', () => {
      const state = service.getProcessState(99999);
      expect(state).toBeUndefined();
    });
  });

  describe('getAllProcessStates', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      await service.onModuleInit();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return all monitored process states', async () => {
      await service.startMonitoring('task-1', 12345);
      await service.startMonitoring('task-2', 12346);

      const states = service.getAllProcessStates();
      expect(states).toHaveLength(2);
      expect(states.some(s => s.taskId === 'task-1')).toBe(true);
      expect(states.some(s => s.taskId === 'task-2')).toBe(true);
    });

    it('should return empty array when no processes are monitored', () => {
      const states = service.getAllProcessStates();
      expect(states).toEqual([]);
    });
  });

  describe('transitionState', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      await service.onModuleInit();
      await service.startMonitoring('test-task-123', 12345);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should transition state and emit event', async () => {
      const pid = 12345;
      const newState = TaskState.COMPLETED;
      const reason = 'Task completed successfully';

      await service.transitionState(pid, newState, reason);

      const processState = service.getProcessState(pid);
      expect(processState?.state).toBe(newState);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'process.stateTransition',
        expect.objectContaining({
          taskId: 'test-task-123',
          pid,
          fromState: TaskState.RUNNING,
          toState: newState,
          reason,
        })
      );
    });

    it('should warn when transitioning non-monitored process', async () => {
      const consoleSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      
      await service.transitionState(99999, TaskState.COMPLETED, 'Test reason');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Attempted state transition on non-monitored process',
        expect.objectContaining({
          pid: 99999,
          newState: TaskState.COMPLETED,
          reason: 'Test reason',
        })
      );
    });

    it('should stop monitoring when transitioning to terminal state', async () => {
      const pid = 12345;
      
      await service.transitionState(pid, TaskState.COMPLETED, 'Task completed');

      // Fast-forward past the cleanup delay
      jest.advanceTimersByTime(1500);

      expect(service.getProcessState(pid)).toBeUndefined();
    });
  });

  describe('updateActivity', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      await service.onModuleInit();
      await service.startMonitoring('test-task-123', 12345);
      
      // Transition to idle first
      await service.transitionState(12345, TaskState.IDLE, 'Test idle state');
      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should update activity timestamp and transition from idle to active', () => {
      const pid = 12345;
      
      service.updateActivity(pid);

      const processState = service.getProcessState(pid);
      expect(processState?.lastActivity).toBeDefined();
      
      // Should have triggered transition from idle to active
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'process.stateTransition',
        expect.objectContaining({
          fromState: TaskState.IDLE,
          toState: TaskState.ACTIVE,
          reason: 'Activity detected',
        })
      );
    });

    it('should reset inactivity timeout', () => {
      const pid = 12345;
      
      service.updateActivity(pid);

      // Fast-forward to just before inactivity timeout
      jest.advanceTimersByTime(mockWorkerConfig.inactivityTimeoutMs - 1000);
      
      // Should not have transitioned to idle yet
      const processState = service.getProcessState(pid);
      expect(processState?.state).toBe(TaskState.ACTIVE);
    });
  });

  describe('PID health monitoring', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      await service.onModuleInit();
      await service.startMonitoring('test-task-123', 12345);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should detect healthy process', () => {
      process.kill = jest.fn(() => true);
      
      // Trigger health check
      jest.advanceTimersByTime(mockWorkerConfig.pidCheckIntervalMs);
      
      const processState = service.getProcessState(12345);
      expect(processState?.state).toBe(TaskState.RUNNING);
      expect(process.kill).toHaveBeenCalledWith(12345, 0);
    });

    it('should detect failed process and transition to failed state', () => {
      process.kill = jest.fn(() => {
        throw new Error('ESRCH');
      });
      
      // Trigger health check
      jest.advanceTimersByTime(mockWorkerConfig.pidCheckIntervalMs);
      
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'process.stateTransition',
        expect.objectContaining({
          taskId: 'test-task-123',
          pid: 12345,
          toState: TaskState.FAILED,
          reason: expect.stringContaining('Process health check failed'),
        })
      );
    });
  });

  describe('file system monitoring', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      await service.onModuleInit();
      await service.startMonitoring('test-task-123', 12345, 'session-logs/test-session');
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should set up file system monitoring', () => {
      expect(chokidar.watch).toHaveBeenCalledWith([], expect.objectContaining({
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: expect.objectContaining({
          stabilityThreshold: 100,
          pollInterval: 50,
        }),
      }));

      expect(mockWatcher.add).toHaveBeenCalledWith('/tmp/claude-logs/session-logs/test-session');
      expect(mockWatcher.on).toHaveBeenCalledWith('add', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('change', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('unlink', expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle file system events and emit activity events', () => {
      // Get the file change handler
      const addHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'add')?.[1];
      expect(addHandler).toBeDefined();

      // Simulate file addition
      const filePath = '/tmp/claude-logs/session-logs/test-session/output.log';
      addHandler(filePath);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'fileSystem.activity',
        expect.objectContaining({
          taskId: 'test-task-123',
          pid: 12345,
          filePath,
          eventType: 'add',
        })
      );
    });

    it('should remove path from monitoring when no more processes watching', async () => {
      await service.stopMonitoring(12345);

      expect(mockWatcher.unwatch).toHaveBeenCalledWith('/tmp/claude-logs/session-logs/test-session');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      await service.onModuleInit();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle file watcher errors gracefully', () => {
      const consoleSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      
      // Get the error handler
      const errorHandler = mockWatcher.on.mock.calls.find(call => call[0] === 'error')?.[1];
      expect(errorHandler).toBeDefined();

      // Simulate error
      const error = new Error('File system error');
      errorHandler(error);

      expect(consoleSpy).toHaveBeenCalledWith(
        'File watcher error',
        expect.objectContaining({
          error: 'File system error',
        })
      );
    });

    it('should handle missing configuration gracefully', () => {
      const configServiceWithoutConfig = {
        get: jest.fn(() => undefined),
      };

      expect(() => {
        new StateMonitorService(
          configServiceWithoutConfig as any,
          eventEmitter
        );
      }).toThrow();
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      jest.useFakeTimers();
      await service.onModuleInit();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should handle multiple processes monitoring same path', async () => {
      await service.startMonitoring('task-1', 12345, 'shared-session');
      await service.startMonitoring('task-2', 12346, 'shared-session');

      // Both processes should be tracked
      expect(service.getProcessState(12345)).toBeDefined();
      expect(service.getProcessState(12346)).toBeDefined();

      // Only one watcher should be created
      expect(mockWatcher.add).toHaveBeenCalledTimes(2);
      expect(mockWatcher.add).toHaveBeenCalledWith('/tmp/claude-logs/shared-session');
    });

    it('should handle rapid state transitions', async () => {
      await service.startMonitoring('test-task-123', 12345);

      // Rapid transitions
      await service.transitionState(12345, TaskState.ACTIVE, 'Active');
      await service.transitionState(12345, TaskState.IDLE, 'Idle');
      await service.transitionState(12345, TaskState.COMPLETED, 'Completed');

      expect(eventEmitter.emit).toHaveBeenCalledTimes(3);
    });
  });
});