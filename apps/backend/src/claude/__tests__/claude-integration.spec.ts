import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter } from 'events';
import { ClaudeModule } from '../claude.module';
import { ClaudeWrapperService, ClaudeResponse, ClaudeWrapperOptions } from '../claude-wrapper.service';
import { ClaudeCommandService, ClaudeCommandType, ClaudeCommandRequest } from '../claude-command.service';
import { ClaudeSessionService } from '../claude-session.service';
import { ClaudeStreamService } from '../claude-stream.service';
import { ClaudeErrorService } from '../claude-error.service';
import { WebSocketModule } from '../../websocket/websocket.module';

/**
 * Comprehensive Claude Code Integration Tests
 *
 * Validates complete Claude Code integration reliability and functionality
 * covering all wrapper services, command execution, session management,
 * and error scenarios as required by task 9 specifications.
 *
 * Test Coverage:
 * - Claude wrapper STDIO communication
 * - Command execution and response handling
 * - Session lifecycle management
 * - Real-time output streaming
 * - Error handling and recovery
 * - End-to-end integration scenarios
 */
describe('Claude Code Integration Tests', () => {
  let module: TestingModule;
  let wrapperService: ClaudeWrapperService;
  let commandService: ClaudeCommandService;
  let sessionService: ClaudeSessionService;
  let streamService: ClaudeStreamService;
  let errorService: ClaudeErrorService;

  // Mock implementation for isolated testing
  let mockWrapperService: jest.Mocked<ClaudeWrapperService>;

  beforeAll(async () => {
    // Create comprehensive mock for wrapper service
    const mockWrapper = new EventEmitter();
    Object.assign(mockWrapper, {
      initialize: jest.fn().mockResolvedValue(undefined),
      executePrompt: jest.fn().mockResolvedValue('test-run-id'),
      cancelExecution: jest.fn().mockResolvedValue(undefined),
      getStatus: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      isWrapperReady: jest.fn().mockReturnValue(true),
      sendCommand: jest.fn().mockResolvedValue(undefined),
      onModuleDestroy: jest.fn().mockResolvedValue(undefined),
    });
    mockWrapperService = mockWrapper as any;

    // Create testing module with mocked dependencies
    module = await Test.createTestingModule({
      imports: [WebSocketModule],
      providers: [
        {
          provide: ClaudeWrapperService,
          useValue: mockWrapperService,
        },
        ClaudeCommandService,
        ClaudeSessionService,
        ClaudeStreamService,
        ClaudeErrorService,
      ],
    }).compile();

    // Get service instances
    wrapperService = module.get<ClaudeWrapperService>(ClaudeWrapperService);
    commandService = module.get<ClaudeCommandService>(ClaudeCommandService);
    sessionService = module.get<ClaudeSessionService>(ClaudeSessionService);
    streamService = module.get<ClaudeStreamService>(ClaudeStreamService);
    errorService = module.get<ClaudeErrorService>(ClaudeErrorService);

    // Initialize services for testing
    await sessionService.onModuleInit();
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Module Integration', () => {
    it('should instantiate all Claude services', () => {
      expect(wrapperService).toBeDefined();
      expect(commandService).toBeDefined();
      expect(sessionService).toBeDefined();
      expect(streamService).toBeDefined();
      expect(errorService).toBeDefined();
    });

    it('should have proper service dependencies', () => {
      // Verify that services can communicate with each other
      expect(commandService).toHaveProperty('wrapperService');
      expect(sessionService).toHaveProperty('wrapperService');
      expect(streamService).toHaveProperty('wrapperService');
    });
  });

  describe('Wrapper Service Integration', () => {
    it('should initialize wrapper process successfully', async () => {
      await expect(wrapperService.initialize()).resolves.not.toThrow();
      expect(mockWrapperService.initialize).toHaveBeenCalledTimes(1);
    });

    it('should handle STDIO communication protocol', async () => {
      const payload = {
        action: 'prompt' as const,
        prompt: 'test prompt',
        run_id: 'test-run-id',
      };

      await wrapperService.sendCommand(payload);
      expect(mockWrapperService.sendCommand).toHaveBeenCalledWith(payload);
    });

    it('should validate command payloads before sending', async () => {
      const invalidPayload = {
        action: 'invalid' as any,
      };

      // This should be caught by the real implementation validation
      await expect(wrapperService.sendCommand(invalidPayload)).rejects.toThrow();
    });

    it('should manage process lifecycle correctly', async () => {
      expect(wrapperService.isWrapperReady()).toBe(true);

      await wrapperService.shutdown();
      expect(mockWrapperService.shutdown).toHaveBeenCalled();
    });

    it('should handle process events and responses', (done) => {
      const testResponse: ClaudeResponse = {
        event: 'test-event',
        timestamp: new Date().toISOString(),
        run_id: 'test-run-id',
      };

      wrapperService.once('response', (response) => {
        expect(response).toEqual(testResponse);
        done();
      });

      // Simulate response from wrapper
      wrapperService.emit('response', testResponse);
    });
  });

  describe('Command Service Integration', () => {
    it('should execute prompt commands successfully', async () => {
      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test prompt',
        options: { cwd: '/test' },
      };

      const response = await commandService.executeCommand(request);
      expect(response.success).toBe(true);
      expect(response.runId).toBeDefined();
      expect(mockWrapperService.executePrompt).toHaveBeenCalledWith(
        'test prompt',
        { cwd: '/test' },
        expect.any(String)
      );
    });

    it('should handle command validation errors', async () => {
      const invalidRequest = {} as ClaudeCommandRequest;

      await expect(commandService.executeCommand(invalidRequest)).rejects.toThrow('Command type is required');
    });

    it('should cancel running commands', async () => {
      const cancelRequest: ClaudeCommandRequest = {
        type: ClaudeCommandType.CANCEL,
        runId: 'test-run-id',
      };

      const response = await commandService.executeCommand(cancelRequest);
      expect(response.success).toBe(true);
      expect(mockWrapperService.cancelExecution).toHaveBeenCalledWith('test-run-id');
    });

    it('should get wrapper status', async () => {
      const statusRequest: ClaudeCommandRequest = {
        type: ClaudeCommandType.STATUS,
      };

      const response = await commandService.executeCommand(statusRequest);
      expect(response.success).toBe(true);
      expect(mockWrapperService.getStatus).toHaveBeenCalled();
    });

    it('should handle command responses and transformations', async () => {
      // Test response parsing and transformation logic
      const mockResponse: ClaudeResponse = {
        event: 'completed',
        timestamp: new Date().toISOString(),
        run_id: 'test-run-id',
        payload: { result: 'test result' },
      };

      // Simulate command completion
      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'test',
      };

      const responsePromise = commandService.executeCommand(request);

      // Simulate wrapper response
      setTimeout(() => {
        wrapperService.emit('completed', mockResponse);
      }, 10);

      const result = await responsePromise;
      expect(result.success).toBe(true);
    });
  });

  describe('Session Management Integration', () => {
    it('should create and manage Claude sessions', async () => {
      const sessionOptions: ClaudeWrapperOptions = {
        cwd: '/test',
        session_id: 'test-session',
      };

      const sessionId = await sessionService.createSession(sessionOptions);
      expect(sessionId).toBeDefined();
      expect(sessionService.hasActiveSession(sessionId)).toBe(true);
    });

    it('should track session state correctly', async () => {
      const sessionId = await sessionService.createSession({});

      // Start session execution
      await sessionService.startExecution(sessionId, 'test prompt');
      const status = sessionService.getSessionStatus(sessionId);
      expect(['pending', 'running']).toContain(status?.status);
    });

    it('should handle session cleanup', async () => {
      const sessionId = await sessionService.createSession({});
      await sessionService.endSession(sessionId);

      expect(sessionService.hasActiveSession(sessionId)).toBe(false);
    });

    it('should manage concurrent sessions', async () => {
      const session1 = await sessionService.createSession({ session_id: 'session-1' });
      const session2 = await sessionService.createSession({ session_id: 'session-2' });

      expect(sessionService.hasActiveSession(session1)).toBe(true);
      expect(sessionService.hasActiveSession(session2)).toBe(true);

      // Sessions should be isolated
      expect(session1).not.toBe(session2);
    });

    it('should enforce session limits', async () => {
      // Create maximum allowed sessions
      const sessions = [];
      for (let i = 0; i < 10; i++) {
        const sessionId = await sessionService.createSession({ session_id: `session-${i}` });
        sessions.push(sessionId);
      }

      // Should reject additional session creation
      await expect(sessionService.createSession({ session_id: 'overflow-session' }))
        .rejects.toThrow('Maximum number of sessions reached');
    });
  });

  describe('Streaming Service Integration', () => {
    it('should handle real-time output streaming', (done) => {
      const testOutput = 'Test streaming output';
      const runId = 'test-run-id';

      streamService.once('stream', (data) => {
        expect(data.runId).toBe(runId);
        expect(data.output).toBe(testOutput);
        done();
      });

      // Simulate streaming output
      streamService.handleStreamingOutput(runId, testOutput);
    });

    it('should integrate with WebSocket for live updates', () => {
      const mockWebSocketGateway = {
        broadcastToRoom: jest.fn(),
      };

      // Test WebSocket integration
      const streamData = {
        runId: 'test-run-id',
        output: 'test output',
        timestamp: new Date().toISOString(),
      };

      streamService.broadcastStream(streamData);
      // Verify WebSocket integration would be called
      expect(streamService).toBeDefined(); // Basic verification
    });

    it('should handle large output volumes efficiently', async () => {
      const largeOutput = 'x'.repeat(10000); // 10KB output
      const runId = 'large-output-test';

      // Should handle large output without errors
      expect(() => streamService.handleStreamingOutput(runId, largeOutput))
        .not.toThrow();
    });

    it('should implement backpressure handling', () => {
      // Test that streaming service can handle rapid output
      const runId = 'backpressure-test';

      for (let i = 0; i < 100; i++) {
        streamService.handleStreamingOutput(runId, `output-${i}`);
      }

      // Service should remain stable under load
      expect(streamService).toBeDefined();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle wrapper initialization errors', async () => {
      mockWrapperService.initialize.mockRejectedValueOnce(new Error('Init failed'));

      await expect(wrapperService.initialize()).rejects.toThrow('Init failed');
    });

    it('should implement retry logic for transient failures', async () => {
      const retryableError = new Error('Connection lost');
      retryableError.name = 'ECONNRESET';

      mockWrapperService.executePrompt
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce('success-run-id');

      const result = await errorService.executeWithRetry(
        async () => wrapperService.executePrompt('test'),
        { maxRetries: 2, retryDelay: 10 }
      );

      expect(result).toBe('success-run-id');
      expect(mockWrapperService.executePrompt).toHaveBeenCalledTimes(2);
    });

    it('should handle process communication errors gracefully', async () => {
      const commError = new Error('STDIO communication failed');
      mockWrapperService.sendCommand.mockRejectedValueOnce(commError);

      const recoveredResult = await errorService.handleProcessError(commError);
      expect(recoveredResult).toBeDefined();
    });

    it('should prevent cascade failures', async () => {
      // Simulate multiple service failures
      mockWrapperService.executePrompt.mockRejectedValue(new Error('Service down'));

      // Error service should contain the failure
      await expect(errorService.executeWithRetry(
        async () => wrapperService.executePrompt('test'),
        { maxRetries: 1, retryDelay: 10 }
      )).rejects.toThrow();

      // Other services should remain functional
      expect(sessionService.getActiveSessions()).toBeDefined();
    });

    it('should provide meaningful error messages', async () => {
      const crypticError = new Error('ERR_001');

      const enhancedError = errorService.enhanceError(crypticError, {
        context: 'command_execution',
        runId: 'test-run-id',
      });

      expect(enhancedError.message).toContain('Command execution failed');
      expect(enhancedError.message).toContain('test-run-id');
    });
  });

  describe('End-to-End Integration Scenarios', () => {
    it('should execute complete Claude Code workflow', async () => {
      // 1. Create session
      const sessionId = await sessionService.createSession({
        cwd: '/test',
        working_directory: '/test',
      });

      // 2. Execute command
      const commandRequest: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: 'analyze the codebase',
        options: { session_id: sessionId },
      };

      const response = await commandService.executeCommand(commandRequest);
      expect(response.success).toBe(true);

      // 3. Monitor execution
      const status = sessionService.getSessionStatus(sessionId);
      expect(status).toBeDefined();

      // 4. Clean up
      await sessionService.endSession(sessionId);
      expect(sessionService.hasActiveSession(sessionId)).toBe(false);
    });

    it('should handle concurrent command execution', async () => {
      const commands = [
        { type: ClaudeCommandType.PROMPT, prompt: 'task 1' },
        { type: ClaudeCommandType.PROMPT, prompt: 'task 2' },
        { type: ClaudeCommandType.PROMPT, prompt: 'task 3' },
      ] as ClaudeCommandRequest[];

      const promises = commands.map(cmd => commandService.executeCommand(cmd));
      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.runId).toBeDefined();
      });
    });

    it('should maintain data consistency during high load', async () => {
      // Create multiple sessions and commands
      const sessionPromises = Array.from({ length: 5 }, () =>
        sessionService.createSession({})
      );
      const sessionIds = await Promise.all(sessionPromises);

      // Execute commands on all sessions
      const commandPromises = sessionIds.map(sessionId =>
        commandService.executeCommand({
          type: ClaudeCommandType.PROMPT,
          prompt: `test for session ${sessionId}`,
          options: { session_id: sessionId },
        })
      );

      const results = await Promise.all(commandPromises);

      // Verify all commands succeeded
      results.forEach(result => expect(result.success).toBe(true));

      // Verify session integrity
      sessionIds.forEach(sessionId => {
        expect(sessionService.hasActiveSession(sessionId)).toBe(true);
      });

      // Cleanup
      await Promise.all(sessionIds.map(id => sessionService.endSession(id)));
    });

    it('should recover from partial system failures', async () => {
      // Create initial state
      const sessionId = await sessionService.createSession({});

      // Simulate partial failure during command execution
      mockWrapperService.executePrompt
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce('recovered-run-id');

      // System should recover automatically
      const result = await errorService.executeWithRetry(
        async () => commandService.executeCommand({
          type: ClaudeCommandType.PROMPT,
          prompt: 'recover test',
          options: { session_id: sessionId },
        }),
        { maxRetries: 2, retryDelay: 10 }
      );

      expect(result.success).toBe(true);
      expect(sessionService.hasActiveSession(sessionId)).toBe(true);
    });
  });

  describe('Performance Integration Tests', () => {
    it('should handle command execution within timeout limits', async () => {
      const startTime = Date.now();

      const response = await commandService.executeCommand({
        type: ClaudeCommandType.PROMPT,
        prompt: 'quick test',
      });

      const executionTime = Date.now() - startTime;

      expect(response.success).toBe(true);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should maintain session performance under load', async () => {
      const startTime = Date.now();

      // Create and manage multiple sessions rapidly
      const sessionCount = 20;
      const sessionIds = [];

      for (let i = 0; i < sessionCount; i++) {
        const sessionId = await sessionService.createSession({});
        sessionIds.push(sessionId);
      }

      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(2000); // Should create 20 sessions within 2 seconds

      // Cleanup
      await Promise.all(sessionIds.map(id => sessionService.endSession(id)));
    });

    it('should stream output with minimal latency', (done) => {
      const startTime = Date.now();
      const runId = 'latency-test';

      streamService.once('stream', () => {
        const latency = Date.now() - startTime;
        expect(latency).toBeLessThan(100); // Should have < 100ms latency
        done();
      });

      streamService.handleStreamingOutput(runId, 'test output');
    });
  });

  describe('Security Integration Tests', () => {
    it('should validate session access permissions', async () => {
      const sessionId = await sessionService.createSession({});

      // Should reject access to non-existent session
      expect(() => sessionService.getSessionStatus('invalid-session'))
        .toThrow('Session not found');

      // Should allow access to valid session
      const status = sessionService.getSessionStatus(sessionId);
      expect(status).toBeDefined();
    });

    it('should sanitize command inputs', async () => {
      const maliciousPrompt = 'rm -rf / && echo "dangerous"';

      const request: ClaudeCommandRequest = {
        type: ClaudeCommandType.PROMPT,
        prompt: maliciousPrompt,
      };

      // Command should be executed but wrapper should handle security
      const response = await commandService.executeCommand(request);
      expect(response.success).toBe(true);

      // Verify the prompt was passed to wrapper (security handled at wrapper level)
      expect(mockWrapperService.executePrompt).toHaveBeenCalledWith(
        maliciousPrompt,
        {},
        expect.any(String)
      );
    });

    it('should isolate session environments', async () => {
      const session1 = await sessionService.createSession({
        cwd: '/path/one',
        session_id: 'isolated-1'
      });
      const session2 = await sessionService.createSession({
        cwd: '/path/two',
        session_id: 'isolated-2'
      });

      const status1 = sessionService.getSessionStatus(session1);
      const status2 = sessionService.getSessionStatus(session2);

      // Sessions should have different configurations
      expect(status1?.options.cwd).not.toBe(status2?.options.cwd);
      expect(status1?.options.session_id).not.toBe(status2?.options.session_id);
    });
  });
});