import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { ChildProcess } from 'child_process';
import {
  ClaudeCodeClientService,
  ClaudeCodeEvent,
  ClaudeCodePromptPayload,
  ParsedResponse,
  StructuredError,
  ErrorCode
} from '../claude-code-client.service';
import { WorkerConfig } from '../../../../packages/types/src';
import { ClaudeCodeOptionsSchema } from '../../../../packages/schemas/src';


describe('ClaudeCodeClientService', () => {
  let service: ClaudeCodeClientService;
  let eventEmitter: EventEmitter2;
  let configService: ConfigService;
  let mockWorkerConfig: WorkerConfig;
  let mockProcess: Partial<ChildProcess>;

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

    mockProcess = {
      pid: 12345,
      stdin: {
        writable: true,
        write: jest.fn(),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaudeCodeClientService,
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

    service = module.get<ClaudeCodeClientService>(ClaudeCodeClientService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    configService = module.get<ConfigService>(ConfigService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('sendPrompt', () => {
    const mockOptions = {
      model: 'claude-3-sonnet',
      timeout: 300,
    };

    it('should send prompt successfully', async () => {
      const prompt = 'Test prompt for Claude Code';

      await service.sendPrompt(mockProcess as ChildProcess, prompt, mockOptions);

      expect(mockProcess.stdin?.write).toHaveBeenCalledWith(
        expect.stringContaining('"command":"claude code --model claude-3-sonnet')
      );
      expect(mockProcess.stdin?.write).toHaveBeenCalledWith(
        expect.stringContaining('"timeout":300')
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'claude.prompt.sent',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          pid: 12345,
        })
      );
    });

    it('should escape quotes in prompt', async () => {
      const prompt = 'Test prompt with "quotes" for Claude Code';

      await service.sendPrompt(mockProcess as ChildProcess, prompt, mockOptions);

      expect(mockProcess.stdin?.write).toHaveBeenCalledWith(
        expect.stringContaining('\\"quotes\\"')
      );
    });

    it('should throw error when stdin is not writable', async () => {
      const processWithoutStdin = {
        ...mockProcess,
        stdin: { writable: false },
      };

      await expect(
        service.sendPrompt(processWithoutStdin as ChildProcess, 'test', mockOptions)
      ).rejects.toThrow('Process stdin is not available or writable');
    });

    it('should throw error when stdin is null', async () => {
      const processWithNullStdin = {
        ...mockProcess,
        stdin: null,
      };

      await expect(
        service.sendPrompt(processWithNullStdin as ChildProcess, 'test', mockOptions)
      ).rejects.toThrow('Process stdin is not available or writable');
    });

    it('should handle write errors', async () => {
      const writeError = new Error('Write failed');
      mockProcess.stdin!.write = jest.fn().mockImplementation(() => {
        throw writeError;
      });

      await expect(
        service.sendPrompt(mockProcess as ChildProcess, 'test', mockOptions)
      ).rejects.toMatchObject({
        type: 'process',
        message: 'Write failed',
      });
    });

    it('should build command without model when not provided', async () => {
      const optionsWithoutModel = { timeout: 300 };

      await service.sendPrompt(mockProcess as ChildProcess, 'test', optionsWithoutModel);

      expect(mockProcess.stdin?.write).toHaveBeenCalledWith(
        expect.stringContaining('"command":"claude code \\"test\\""')
      );
    });

    it('should use default timeout when not provided', async () => {
      const optionsWithoutTimeout = { model: 'claude-3-sonnet' };

      await service.sendPrompt(mockProcess as ChildProcess, 'test', optionsWithoutTimeout);

      expect(mockProcess.stdin?.write).toHaveBeenCalledWith(
        expect.stringContaining('"timeout":300')
      );
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response successfully', () => {
      const jsonOutput = JSON.stringify({
        status: 'completed',
        timestamp: '2025-09-25T10:00:00Z',
        message: 'Task completed successfully',
        pid: 12345,
        return_code: 0,
      });

      const result = service.parseResponse(jsonOutput);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.data).toBeDefined();
      expect(result.data?.pid).toBe(12345);
      expect(result.data?.return_code).toBe(0);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'claude.response.received',
        expect.objectContaining({
          status: 'completed',
          pid: 12345,
        })
      );
    });

    it('should handle empty response', () => {
      const result = service.parseResponse('');

      expect(result.success).toBe(false);
      expect(result.status).toBe('error');
      expect(result.error).toBe('Empty response received');
    });

    it('should handle invalid JSON', () => {
      const result = service.parseResponse('invalid json {');

      expect(result.success).toBe(false);
      expect(result.status).toBe('error');
      expect(result.error).toContain('JSON parsing failed');
    });

    it('should handle JSON that fails schema validation', () => {
      const invalidJson = JSON.stringify({
        status: 'invalid-status', // Not in enum
        timestamp: '2025-09-25T10:00:00Z',
      });

      const result = service.parseResponse(invalidJson);

      expect(result.success).toBe(false);
      expect(result.status).toBe('error');
      expect(result.error).toContain('JSON parsing failed');
    });

    it('should handle whitespace-only response', () => {
      const result = service.parseResponse('   \n  \t  ');

      expect(result.success).toBe(false);
      expect(result.status).toBe('error');
      expect(result.error).toBe('Empty response received');
    });

    it('should parse response with error information', () => {
      const jsonOutput = JSON.stringify({
        status: 'failed',
        timestamp: '2025-09-25T10:00:00Z',
        error: 'Command execution failed',
        error_output: 'Permission denied',
        return_code: 1,
      });

      const result = service.parseResponse(jsonOutput);

      expect(result.success).toBe(true);
      expect(result.status).toBe('failed');
      expect(result.data?.error).toBe('Command execution failed');
      expect(result.data?.error_output).toBe('Permission denied');
    });
  });

  describe('handleError', () => {
    it('should structure error with specified type', () => {
      const errorData = {
        type: 'validation',
        message: 'Invalid configuration',
        details: { field: 'model' },
        correlationId: 'test-id',
      };

      const result = service.handleError(errorData);

      expect(result.type).toBe('validation');
      expect(result.message).toBe('Invalid configuration');
      expect(result.details).toEqual({ field: 'model' });
      expect(result.correlationId).toBe('test-id');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'claude.client.error',
        expect.objectContaining({
          type: 'validation',
          message: 'Invalid configuration',
        })
      );
    });

    it('should infer error type from message content', () => {
      const cases = [
        { message: 'Validation failed for input', expectedType: 'validation' },
        { message: 'Request timed out after 30 seconds', expectedType: 'timeout' },
        { message: 'Child process spawn error', expectedType: 'process' },
        { message: 'Claude SDK returned error', expectedType: 'sdk' },
        { message: 'Some random error', expectedType: 'unknown' },
      ];

      cases.forEach(({ message, expectedType }) => {
        const result = service.handleError({ message });
        expect(result.type).toBe(expectedType);
      });
    });

    it('should generate correlation ID when not provided', () => {
      const result = service.handleError({ message: 'Test error' });
      
      expect(result.correlationId).toBe('test-correlation-id');
    });

    it('should use current timestamp when not provided', () => {
      const before = new Date();
      const result = service.handleError({ message: 'Test error' });
      const after = new Date();

      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('validateConfiguration', () => {
    it('should validate correct configuration', () => {
      const validConfig = {
        model: 'claude-3-sonnet',
        timeout: 300,
        maxTokens: 1000,
      };

      const result = service.validateConfiguration(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should detect invalid configuration', () => {
      const invalidConfig = {
        model: '', // Empty string invalid
        timeout: -1, // Negative timeout invalid
      };

      const result = service.validateConfiguration(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should validate minimal configuration', () => {
      const minimalConfig = {};

      const result = service.validateConfiguration(minimalConfig);

      expect(result.valid).toBe(true);
    });

    it('should handle validation error gracefully', () => {
      const result = service.validateConfiguration({ timeout: 'invalid' as any });

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('isSuccessResponse', () => {
    it('should return true for completed response with zero return code', () => {
      const response: ParsedResponse = {
        success: true,
        event: 'run_completed',
        status: 'completed',
        data: {
          status: 'completed',
          timestamp: '2025-09-25T10:00:00Z',
          return_code: 0,
        },
        correlationId: 'test-id',
      };

      expect(service.isSuccessResponse(response)).toBe(true);
    });

    it('should return true for completed response without return code', () => {
      const response: ParsedResponse = {
        success: true,
        event: 'run_completed',
        status: 'completed',
        data: {
          status: 'completed',
          timestamp: '2025-09-25T10:00:00Z',
        },
        correlationId: 'test-id',
      };

      expect(service.isSuccessResponse(response)).toBe(true);
    });

    it('should return false for failed response', () => {
      const response: ParsedResponse = {
        success: false,
        event: 'run_failed',
        status: 'failed',
        error: 'Something went wrong',
        correlationId: 'test-id',
      };

      expect(service.isSuccessResponse(response)).toBe(false);
    });

    it('should return false for completed response with non-zero return code', () => {
      const response: ParsedResponse = {
        success: true,
        event: 'run_completed',
        status: 'completed',
        data: {
          status: 'completed',
          timestamp: '2025-09-25T10:00:00Z',
          return_code: 1,
        },
        correlationId: 'test-id',
      };

      expect(service.isSuccessResponse(response)).toBe(false);
    });

    it('should return false for running response', () => {
      const response: ParsedResponse = {
        success: true,
        event: 'stream',
        status: 'running',
        data: {
          status: 'running',
          timestamp: '2025-09-25T10:00:00Z',
        },
        correlationId: 'test-id',
      };

      expect(service.isSuccessResponse(response)).toBe(false);
    });
  });

  describe('isFailureResponse', () => {
    it('should return true for unsuccessful response', () => {
      const response: ParsedResponse = {
        success: false,
        event: 'error',
        status: 'error',
        error: 'Something went wrong',
        correlationId: 'test-id',
      };

      expect(service.isFailureResponse(response)).toBe(true);
    });

    it('should return true for failed status', () => {
      const response: ParsedResponse = {
        success: true,
        event: 'run_failed',
        status: 'failed',
        data: {
          status: 'failed',
          timestamp: '2025-09-25T10:00:00Z',
        },
        correlationId: 'test-id',
      };

      expect(service.isFailureResponse(response)).toBe(true);
    });

    it('should return true for error status', () => {
      const response: ParsedResponse = {
        success: true,
        event: 'error',
        status: 'error',
        data: {
          status: 'error',
          timestamp: '2025-09-25T10:00:00Z',
        },
        correlationId: 'test-id',
      };

      expect(service.isFailureResponse(response)).toBe(true);
    });

    it('should return true for timeout status', () => {
      const response: ParsedResponse = {
        success: true,
        event: 'timeout',
        status: 'timeout',
        data: {
          status: 'timeout',
          timestamp: '2025-09-25T10:00:00Z',
        },
        correlationId: 'test-id',
      };

      expect(service.isFailureResponse(response)).toBe(true);
    });

    it('should return true for non-zero return code', () => {
      const response: ParsedResponse = {
        success: true,
        event: 'run_completed',
        status: 'completed',
        data: {
          status: 'completed',
          timestamp: '2025-09-25T10:00:00Z',
          return_code: 1,
        },
        correlationId: 'test-id',
      };

      expect(service.isFailureResponse(response)).toBe(true);
    });

    it('should return false for successful completed response', () => {
      const response: ParsedResponse = {
        success: true,
        event: 'run_completed',
        status: 'completed',
        data: {
          status: 'completed',
          timestamp: '2025-09-25T10:00:00Z',
          return_code: 0,
        },
        correlationId: 'test-id',
      };

      expect(service.isFailureResponse(response)).toBe(false);
    });

    it('should return false for running response', () => {
      const response: ParsedResponse = {
        success: true,
        event: 'stream',
        status: 'running',
        data: {
          status: 'running',
          timestamp: '2025-09-25T10:00:00Z',
        },
        correlationId: 'test-id',
      };

      expect(service.isFailureResponse(response)).toBe(false);
    });
  });

  describe('extractErrorMessage', () => {
    it('should extract error from unsuccessful response', () => {
      const response: ParsedResponse = {
        success: false,
        event: 'error',
        status: 'error',
        error: 'Parse error occurred',
        correlationId: 'test-id',
      };

      expect(service.extractErrorMessage(response)).toBe('Parse error occurred');
    });

    it('should extract error from data.error', () => {
      const response: ParsedResponse = {
        success: true,
        event: 'run_failed',
        status: 'failed',
        data: {
          status: 'failed',
          timestamp: '2025-09-25T10:00:00Z',
          error: 'SDK execution error',
        },
        correlationId: 'test-id',
      };

      expect(service.extractErrorMessage(response)).toBe('SDK execution error');
    });

    it('should extract error from data.error_output', () => {
      const response: ParsedResponse = {
        success: true,
        event: 'run_failed',
        status: 'failed',
        data: {
          status: 'failed',
          timestamp: '2025-09-25T10:00:00Z',
          error_output: 'Permission denied',
        },
        correlationId: 'test-id',
      };

      expect(service.extractErrorMessage(response)).toBe('Permission denied');
    });

    it('should extract error from failed status message', () => {
      const response: ParsedResponse = {
        success: true,
        event: 'run_failed',
        status: 'failed',
        data: {
          status: 'failed',
          timestamp: '2025-09-25T10:00:00Z',
          message: 'Task execution failed',
        },
        correlationId: 'test-id',
      };

      expect(service.extractErrorMessage(response)).toBe('Task execution failed');
    });

    it('should return undefined when no error information available', () => {
      const response: ParsedResponse = {
        success: true,
        event: 'run_completed',
        status: 'completed',
        data: {
          status: 'completed',
          timestamp: '2025-09-25T10:00:00Z',
        },
        correlationId: 'test-id',
      };

      expect(service.extractErrorMessage(response)).toBeUndefined();
    });

    it('should prioritize error over error_output', () => {
      const response: ParsedResponse = {
        success: true,
        event: 'run_failed',
        status: 'failed',
        data: {
          status: 'failed',
          timestamp: '2025-09-25T10:00:00Z',
          error: 'Primary error',
          error_output: 'Secondary error output',
        },
        correlationId: 'test-id',
      };

      expect(service.extractErrorMessage(response)).toBe('Primary error');
    });
  });

  describe('error scenarios', () => {
    it('should handle null process gracefully', async () => {
      await expect(
        service.sendPrompt(null as any, 'test', {})
      ).rejects.toThrow();
    });

    it('should handle configuration validation errors', () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);
      
      expect(() => {
        new ClaudeCodeClientService(configService, eventEmitter);
      }).toThrow();
    });
  });

  describe('logging and events', () => {
    it('should emit prompt sent event', async () => {
      await service.sendPrompt(mockProcess as ChildProcess, 'test', {});

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'claude.prompt.sent',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          pid: 12345,
          timestamp: expect.any(Date),
        })
      );
    });

    it('should emit response received event', () => {
      const jsonOutput = JSON.stringify({
        status: 'completed',
        timestamp: '2025-09-25T10:00:00Z',
        pid: 12345,
      });

      service.parseResponse(jsonOutput);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'claude.response.received',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          status: 'completed',
          pid: 12345,
          timestamp: expect.any(Date),
        })
      );
    });

    it('should emit error event', () => {
      service.handleError({ message: 'Test error' });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'claude.client.error',
        expect.objectContaining({
          type: 'unknown',
          message: 'Test error',
          timestamp: expect.any(Date),
        })
      );
    });
  });
});