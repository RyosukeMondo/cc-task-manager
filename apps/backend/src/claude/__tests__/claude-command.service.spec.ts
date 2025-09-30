import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter } from 'events';
import { ClaudeCommandService, ClaudeCommandType, ClaudeCommandRequest } from '../claude-command.service';
import { ClaudeWrapperService, ClaudeResponse } from '../claude-wrapper.service';

describe('ClaudeCommandService', () => {
  let service: ClaudeCommandService;
  let mockWrapperService: jest.Mocked<ClaudeWrapperService>;

  beforeEach(async () => {
    // Create mock wrapper service extending EventEmitter
    const mockWrapper = new EventEmitter();
    Object.assign(mockWrapper, {
      initialize: jest.fn().mockResolvedValue(undefined),
      executePrompt: jest.fn().mockResolvedValue('test-run-id'),
      cancelExecution: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      isWrapperReady: jest.fn().mockReturnValue(true),
    });
    mockWrapperService = mockWrapper as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaudeCommandService,
        {
          provide: ClaudeWrapperService,
          useValue: mockWrapperService,
        },
      ],
    }).compile();

    service = module.get<ClaudeCommandService>(ClaudeCommandService);

    // Reduce timeout for faster tests
    (service as any).responseTimeout = 1000;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeCommand', () => {
    it('should validate command request', async () => {
      const invalidRequest = {} as ClaudeCommandRequest;

      await expect(service.executeCommand(invalidRequest)).rejects.toThrow('Command type is required');
    });

    it('should validate prompt command requires prompt', async () => {
      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
      };

      await expect(service.executeCommand(request)).rejects.toThrow('Prompt is required and cannot be empty');
    });

    it('should validate cancel command requires runId', async () => {
      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.CANCEL,
      };

      await expect(service.executeCommand(request)).rejects.toThrow('Run ID is required for cancel command');
    });

    it('should execute prompt command successfully', async () => {
      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test prompt',
      };

      // Mock successful execution - emit immediately to avoid timing issues
      mockWrapperService.executePrompt.mockImplementation(async (prompt, options, runId) => {
        // Emit completion event immediately
        setImmediate(() => {
          const response: ClaudeResponse = {
            event: 'run_completed',
            timestamp: new Date().toISOString(),
            run_id: 'test-run-id',
            payload: { result: 'success' },
          };
          mockWrapperService.emit('run_completed', response);
        });
        return 'test-run-id';
      });

      const result = await service.executeCommand(request);

      expect(result.success).toBe(true);
      expect(result.runId).toBe('test-run-id');
      expect(mockWrapperService.executePrompt).toHaveBeenCalledWith(
        'test prompt',
        {},
        expect.any(String)
      );
    });

    it('should execute cancel command successfully', async () => {
      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.CANCEL,
        runId: 'test-run-id',
      };

      const result = await service.executeCommand(request);

      expect(result.success).toBe(true);
      expect(result.runId).toBe('test-run-id');
      expect(mockWrapperService.cancelExecution).toHaveBeenCalledWith('test-run-id');
    });

    it('should execute status command successfully', async () => {
      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.STATUS,
      };

      // Mock status response - emit immediately
      mockWrapperService.getStatus.mockImplementation(async () => {
        setImmediate(() => {
          const response: ClaudeResponse = {
            event: 'status',
            timestamp: new Date().toISOString(),
            payload: { state: 'idle' },
          };
          mockWrapperService.emit('response', response);
        });
      });

      const result = await service.executeCommand(request);

      expect(result.success).toBe(true);
      expect(mockWrapperService.getStatus).toHaveBeenCalled();
    });

    it('should execute shutdown command successfully', async () => {
      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.SHUTDOWN,
      };

      const result = await service.executeCommand(request);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ shutdown: true });
      expect(mockWrapperService.shutdown).toHaveBeenCalled();
    });

    it('should handle command execution errors', async () => {
      mockWrapperService.executePrompt.mockRejectedValue(new Error('Execution failed'));

      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test prompt',
      };

      const result = await service.executeCommand(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });

    it('should handle streaming callbacks', async () => {
      const onEventMock = jest.fn();
      const onCompleteMock = jest.fn();

      const callback = {
        onEvent: onEventMock,
        onComplete: onCompleteMock,
      };

      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test prompt',
      };

      // Mock stream events - emit immediately
      mockWrapperService.executePrompt.mockImplementation(async (prompt, options, runId) => {
        setImmediate(() => {
          const streamResponse: ClaudeResponse = {
            event: 'stream',
            timestamp: new Date().toISOString(),
            run_id: 'test-run-id',
            payload: { data: 'stream data' },
          };
          mockWrapperService.emit('response', streamResponse);

          setImmediate(() => {
            const completeResponse: ClaudeResponse = {
              event: 'run_completed',
              timestamp: new Date().toISOString(),
              run_id: 'test-run-id',
              payload: { result: 'success' },
            };
            mockWrapperService.emit('run_completed', completeResponse);
          });
        });
        return 'test-run-id';
      });

      const result = await service.executeCommand(request, callback);

      expect(result.success).toBe(true);
      expect(onEventMock).toHaveBeenCalled();
      expect(onCompleteMock).toHaveBeenCalled();
    });

    it('should validate command options', async () => {
      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test prompt',
        options: {
          permission_mode: 'invalid' as any,
        },
      };

      await expect(service.executeCommand(request)).rejects.toThrow(
        "Invalid permission_mode: invalid. Must be 'ask' or 'bypassPermissions'"
      );
    });
  });

  describe('utility methods', () => {
    it('should check if service is ready', () => {
      expect(service.isReady()).toBe(true);
      expect(mockWrapperService.isWrapperReady).toHaveBeenCalled();
    });

    it('should initialize service', async () => {
      await service.initialize();
      expect(mockWrapperService.initialize).toHaveBeenCalled();
    });

    it('should get active commands', () => {
      const commands = service.getActiveCommands();
      expect(commands).toBeInstanceOf(Map);
    });
  });

  describe('wrapper service integration', () => {
    it('should handle wrapper service errors', async () => {
      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test prompt',
      };

      const callback = {
        onError: jest.fn(),
      };

      // Mock executePrompt to emit error immediately
      mockWrapperService.executePrompt.mockImplementation(async (prompt, options, runId) => {
        setImmediate(() => {
          mockWrapperService.emit('error', new Error('Wrapper error'));
        });
        return 'test-run-id';
      });

      const result = await service.executeCommand(request, callback);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Wrapper error');
    });

    it('should handle run cancellation events', async () => {
      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test prompt',
      };

      // Mock executePrompt to emit cancellation immediately
      mockWrapperService.executePrompt.mockImplementation(async (prompt, options, runId) => {
        setImmediate(() => {
          const response: ClaudeResponse = {
            event: 'run_cancelled',
            timestamp: new Date().toISOString(),
            run_id: 'test-run-id',
            payload: { reason: 'user_requested' },
          };
          mockWrapperService.emit('run_cancelled', response);
        });
        return 'test-run-id';
      });

      const result = await service.executeCommand(request);
      expect(result.success).toBe(true);
    });
  });
});