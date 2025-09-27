// Mock child_process module before any imports
const mockSpawn = jest.fn();

jest.mock('child_process', () => ({
  spawn: mockSpawn,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { ChildProcess } from 'child_process';
import { ProcessManagerService } from '../process-manager.service';
import { ProcessConfig, WorkerConfig } from '../../../../packages/types/src';

const mockChildProcess = {
  pid: 12345,
  kill: jest.fn(),
  on: jest.fn(),
  once: jest.fn().mockReturnThis(),
  stdout: { on: jest.fn() },
  stderr: { on: jest.fn() },
} as unknown as ChildProcess;

// Mock process.kill for isProcessAlive tests
const originalProcessKill = process.kill;

describe('ProcessManagerService', () => {
  let service: ProcessManagerService;
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
        ProcessManagerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'worker') return mockWorkerConfig;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ProcessManagerService>(ProcessManagerService);
    configService = module.get<ConfigService>(ConfigService);

    // Clear all mocks
    jest.clearAllMocks();
    mockSpawn.mockReturnValue(mockChildProcess);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.kill = originalProcessKill;
  });

  describe('spawnClaudeProcess', () => {
    const mockConfig: ProcessConfig = {
      jobId: 'test-job-123',
      sessionName: 'test-session',
      workingDirectory: '/tmp/test-dir',
      wrapperScriptPath: '/path/to/wrapper.py',
      pythonExecutable: '/usr/bin/python3',
      unbuffered: true,
    };

    it('should spawn a process successfully with valid config', async () => {
      const result = await service.spawnClaudeProcess(mockConfig);

      expect(mockSpawn).toHaveBeenCalledWith(
        '/usr/bin/python3',
        [
          '/path/to/wrapper.py',
          '--job-id', 'test-job-123',
          '--session-name', 'test-session',
          '--working-dir', '/tmp/test-dir',
        ],
        expect.objectContaining({
          cwd: '/tmp/test-dir',
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: false,
          windowsHide: true,
          env: expect.objectContaining({
            PYTHONUNBUFFERED: '1',
            PYTHONIOENCODING: 'utf-8',
          }),
        })
      );
      expect(result).toBe(mockChildProcess);
      expect(mockChildProcess.on).toHaveBeenCalled();
    });

    it('should use default python executable when not provided in config', async () => {
      const configWithoutPython = { ...mockConfig, pythonExecutable: undefined };
      
      await service.spawnClaudeProcess(configWithoutPython);

      expect(mockSpawn).toHaveBeenCalledWith(
        '/usr/bin/python3',
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('should set PYTHONUNBUFFERED to 0 when unbuffered is false', async () => {
      const configWithBuffered = { ...mockConfig, unbuffered: false };
      
      await service.spawnClaudeProcess(configWithBuffered);

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            PYTHONUNBUFFERED: '0',
          }),
        })
      );
    });

    it('should throw error when spawn fails', async () => {
      const error = new Error('Spawn failed');
      mockSpawn.mockImplementation(() => {
        const failedProcess = {
          ...mockChildProcess,
          on: jest.fn((event, callback) => {
            if (event === 'error') {
              setImmediate(() => callback(error));
            }
          }),
        };
        return failedProcess;
      });

      await expect(service.spawnClaudeProcess(mockConfig)).rejects.toThrow('Spawn failed');
    });

    it('should throw error when no PID is assigned', async () => {
      const processWithoutPid = { ...mockChildProcess, pid: undefined };
      mockSpawn.mockReturnValue(processWithoutPid);

      await expect(service.spawnClaudeProcess(mockConfig)).rejects.toThrow(
        'Process spawn failed - no PID assigned'
      );
    });

    it('should setup event handlers on spawned process', async () => {
      await service.spawnClaudeProcess(mockConfig);

      expect(mockChildProcess.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockChildProcess.on).toHaveBeenCalledWith('exit', expect.any(Function));
      expect(mockChildProcess.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockChildProcess.stdout?.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockChildProcess.stderr?.on).toHaveBeenCalledWith('data', expect.any(Function));
    });
  });

  describe('terminateProcess', () => {
    beforeEach(async () => {
      // Setup a tracked process
      const mockConfig: ProcessConfig = {
        jobId: 'test-job-123',
        sessionName: 'test-session',
        workingDirectory: '/tmp/test-dir',
        wrapperScriptPath: '/path/to/wrapper.py',
        pythonExecutable: '/usr/bin/python3',
        unbuffered: true,
      };
      await service.spawnClaudeProcess(mockConfig);
    });

    it('should terminate process gracefully with SIGTERM', async () => {
      // Mock process exit event to simulate graceful shutdown
      (mockChildProcess.once as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'exit') {
          setTimeout(callback, 100);
        }
        return mockChildProcess;
      });

      await service.terminateProcess(12345);

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(service.getActiveProcesses()).not.toContain(12345);
    });

    it('should force kill with SIGKILL after graceful timeout', async () => {
      // Mock graceful shutdown timeout
      (mockChildProcess.once as jest.Mock).mockImplementation(() => {
        // Don't call the exit callback to simulate timeout
        return mockChildProcess;
      });

      // Mock isProcessAlive to return true
      process.kill = jest.fn(() => true);

      await service.terminateProcess(12345);

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('should handle termination of non-existent process', async () => {
      const consoleSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      
      await service.terminateProcess(99999);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Attempted to terminate non-existent process',
        expect.objectContaining({ pid: 99999 })
      );
    });

    it('should clean up tracking maps after termination', async () => {
      (mockChildProcess.once as jest.Mock).mockImplementation((event, callback) => {
        if (event === 'exit') {
          setTimeout(callback, 100);
        }
        return mockChildProcess;
      });

      expect(service.getActiveProcesses()).toContain(12345);
      
      await service.terminateProcess(12345);

      expect(service.getActiveProcesses()).not.toContain(12345);
      expect(service.getProcessHealth(12345).metadata).toBeUndefined();
    });
  });

  describe('isProcessAlive', () => {
    it('should return true when process exists', () => {
      process.kill = jest.fn(() => true);
      
      const result = service.isProcessAlive(12345);
      
      expect(result).toBe(true);
      expect(process.kill).toHaveBeenCalledWith(12345, 0);
    });

    it('should return false when process does not exist', () => {
      process.kill = jest.fn(() => {
        throw new Error('ESRCH');
      });
      
      const result = service.isProcessAlive(99999);
      
      expect(result).toBe(false);
      expect(process.kill).toHaveBeenCalledWith(99999, 0);
    });
  });

  describe('getProcessHealth', () => {
    beforeEach(async () => {
      const mockConfig: ProcessConfig = {
        jobId: 'test-job-123',
        sessionName: 'test-session',
        workingDirectory: '/tmp/test-dir',
        wrapperScriptPath: '/path/to/wrapper.py',
        pythonExecutable: '/usr/bin/python3',
        unbuffered: true,
      };
      await service.spawnClaudeProcess(mockConfig);
    });

    it('should return health status for tracked process', () => {
      process.kill = jest.fn(() => true);
      
      const health = service.getProcessHealth(12345);
      
      expect(health.isAlive).toBe(true);
      expect(health.metadata).toBeDefined();
      expect(health.metadata?.jobId).toBe('test-job-123');
      expect(health.metadata?.sessionName).toBe('test-session');
      expect(health.metadata?.uptime).toBeGreaterThanOrEqual(0);
      expect(health.metadata?.correlationId).toBe('test-correlation-id');
    });

    it('should return basic health status for untracked process', () => {
      process.kill = jest.fn(() => true);
      
      const health = service.getProcessHealth(99999);
      
      expect(health.isAlive).toBe(true);
      expect(health.metadata).toBeUndefined();
    });
  });

  describe('getActiveProcesses', () => {
    it('should return empty array initially', () => {
      const activeProcesses = service.getActiveProcesses();
      expect(activeProcesses).toEqual([]);
    });

    it('should return PIDs of active processes', async () => {
      const mockConfig: ProcessConfig = {
        jobId: 'test-job-123',
        sessionName: 'test-session',
        workingDirectory: '/tmp/test-dir',
        wrapperScriptPath: '/path/to/wrapper.py',
        pythonExecutable: '/usr/bin/python3',
        unbuffered: true,
      };
      
      await service.spawnClaudeProcess(mockConfig);
      
      const activeProcesses = service.getActiveProcesses();
      expect(activeProcesses).toEqual([12345]);
    });
  });

  describe('cleanupOrphanedProcesses', () => {
    beforeEach(async () => {
      const mockConfig: ProcessConfig = {
        jobId: 'test-job-123',
        sessionName: 'test-session',
        workingDirectory: '/tmp/test-dir',
        wrapperScriptPath: '/path/to/wrapper.py',
        pythonExecutable: '/usr/bin/python3',
        unbuffered: true,
      };
      await service.spawnClaudeProcess(mockConfig);
    });

    it('should clean up processes that are no longer alive', async () => {
      // Mock process as dead
      process.kill = jest.fn(() => {
        throw new Error('ESRCH');
      });

      expect(service.getActiveProcesses()).toContain(12345);
      
      await service.cleanupOrphanedProcesses();
      
      expect(service.getActiveProcesses()).not.toContain(12345);
    });

    it('should not clean up alive processes', async () => {
      // Mock process as alive
      process.kill = jest.fn(() => true);
      
      await service.cleanupOrphanedProcesses();
      
      expect(service.getActiveProcesses()).toContain(12345);
    });

    it('should handle cleanup when no processes are tracked', async () => {
      // Start with empty service
      const cleanService = new ProcessManagerService(configService);
      
      await expect(cleanService.cleanupOrphanedProcesses()).resolves.not.toThrow();
    });
  });

  describe('error scenarios', () => {
    it('should handle invalid configuration gracefully', async () => {
      const invalidConfig = {
        jobId: '', // Invalid empty jobId
        sessionName: 'test-session',
        workingDirectory: '/tmp/test-dir',
        wrapperScriptPath: '/path/to/wrapper.py',
        pythonExecutable: '/usr/bin/python3',
        unbuffered: true,
      };

      await expect(service.spawnClaudeProcess(invalidConfig as ProcessConfig)).rejects.toThrow();
    });

    it('should handle spawn errors during process creation', async () => {
      const error = new Error('Permission denied');
      mockSpawn.mockImplementation(() => {
        throw error;
      });

      await expect(service.spawnClaudeProcess({
        jobId: 'test-job-123',
        sessionName: 'test-session',
        workingDirectory: '/tmp/test-dir',
        wrapperScriptPath: '/path/to/wrapper.py',
        pythonExecutable: '/usr/bin/python3',
        unbuffered: true,
      })).rejects.toThrow('Permission denied');
    });
  });
});