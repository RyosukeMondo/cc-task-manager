import { Test, TestingModule } from '@nestjs/testing';
import { ClaudeCommandService, ClaudeCommandType, ClaudeCommandRequest } from '../claude-command.service';
import { ClaudeWrapperService } from '../claude-wrapper.service';

describe('ClaudeCommandService - Basic Tests', () => {
  let service: ClaudeCommandService;
  let mockWrapperService: jest.Mocked<ClaudeWrapperService>;

  beforeEach(async () => {
    // Create a simple mock wrapper service
    mockWrapperService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      executePrompt: jest.fn().mockResolvedValue('test-run-id'),
      cancelExecution: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      isWrapperReady: jest.fn().mockReturnValue(true),
      on: jest.fn(),
      emit: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      setMaxListeners: jest.fn(),
      getMaxListeners: jest.fn().mockReturnValue(10),
      listeners: jest.fn().mockReturnValue([]),
      rawListeners: jest.fn().mockReturnValue([]),
      listenerCount: jest.fn().mockReturnValue(0),
      prependListener: jest.fn(),
      prependOnceListener: jest.fn(),
      eventNames: jest.fn().mockReturnValue([]),
    } as any;

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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('command validation', () => {
    it('should validate command request is required', async () => {
      const invalidRequest = null as any;
      await expect(service.executeCommand(invalidRequest)).rejects.toThrow('Command request is required');
    });

    it('should validate command type is required', async () => {
      const invalidRequest = {} as ClaudeCommandRequest;
      await expect(service.executeCommand(invalidRequest)).rejects.toThrow('Command type is required');
    });

    it('should validate command type is valid', async () => {
      const invalidRequest = { type: 'invalid' as any };
      await expect(service.executeCommand(invalidRequest)).rejects.toThrow('Invalid command type: invalid');
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

    it('should validate invalid permission mode', async () => {
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

  describe('service methods', () => {
    it('should check if service is ready', () => {
      expect(service.isReady()).toBe(true);
      expect(mockWrapperService.isWrapperReady).toHaveBeenCalled();
    });

    it('should initialize service when wrapper is not ready', async () => {
      mockWrapperService.isWrapperReady.mockReturnValue(false);
      await service.initialize();
      expect(mockWrapperService.initialize).toHaveBeenCalled();
    });

    it('should not initialize service when wrapper is already ready', async () => {
      mockWrapperService.isWrapperReady.mockReturnValue(true);
      await service.initialize();
      expect(mockWrapperService.initialize).not.toHaveBeenCalled();
    });

    it('should get active commands map', () => {
      const commands = service.getActiveCommands();
      expect(commands).toBeInstanceOf(Map);
    });

    it('should get command context for valid runId', () => {
      const context = service.getCommandContext('non-existent-run-id');
      expect(context).toBeUndefined();
    });
  });

  describe('direct command execution', () => {
    it('should call cancel execution on wrapper service', async () => {
      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.CANCEL,
        runId: 'test-run-id',
      };

      const result = await service.executeCommand(request);

      expect(result.success).toBe(true);
      expect(result.runId).toBe('test-run-id');
      expect(mockWrapperService.cancelExecution).toHaveBeenCalledWith('test-run-id');
    });

    it('should call shutdown on wrapper service', async () => {
      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.SHUTDOWN,
      };

      const result = await service.executeCommand(request);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ shutdown: true });
      expect(mockWrapperService.shutdown).toHaveBeenCalled();
    });

    it('should handle wrapper service errors', async () => {
      mockWrapperService.cancelExecution.mockRejectedValue(new Error('Wrapper error'));

      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.CANCEL,
        runId: 'test-run-id',
      };

      const result = await service.executeCommand(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Wrapper error');
    });
  });

  describe('option validation', () => {
    it('should validate cwd option type', async () => {
      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test',
        options: { cwd: 123 as any },
      };
      await expect(service.executeCommand(request)).rejects.toThrow('cwd must be a string');
    });

    it('should validate working_directory option type', async () => {
      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test',
        options: { working_directory: 123 as any },
      };
      await expect(service.executeCommand(request)).rejects.toThrow('working_directory must be a string');
    });

    it('should validate exit_on_complete option type', async () => {
      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test',
        options: { exit_on_complete: 'true' as any },
      };
      await expect(service.executeCommand(request)).rejects.toThrow('exit_on_complete must be a boolean');
    });

    it('should validate resume_last_session option type', async () => {
      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test',
        options: { resume_last_session: 'true' as any },
      };
      await expect(service.executeCommand(request)).rejects.toThrow('resume_last_session must be a boolean');
    });

    it('should accept valid permission modes', () => {
      const request1: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test',
        options: { permission_mode: 'ask' },
      };

      const request2: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test',
        options: { permission_mode: 'bypassPermissions' },
      };

      // These should not throw validation errors during validation phase
      expect(() => (service as any).validateCommandRequest(request1)).not.toThrow();
      expect(() => (service as any).validateCommandRequest(request2)).not.toThrow();
    });
  });
});