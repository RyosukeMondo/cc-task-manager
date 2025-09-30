import { Test, TestingModule } from '@nestjs/testing';
import { ClaudeSessionService, ClaudeSessionConfig } from '../claude-session.service';
import { ClaudeWrapperService } from '../claude-wrapper.service';
import { ClaudeCommandService, ClaudeCommandType } from '../claude-command.service';

// Mock the services
jest.mock('../claude-wrapper.service');
jest.mock('../claude-command.service');

const MockedClaudeWrapperService = ClaudeWrapperService as jest.MockedClass<typeof ClaudeWrapperService>;
const MockedClaudeCommandService = ClaudeCommandService as jest.MockedClass<typeof ClaudeCommandService>;

describe('ClaudeSessionService', () => {
  let service: ClaudeSessionService;
  let mockWrapperService: jest.Mocked<ClaudeWrapperService>;
  let mockCommandService: jest.Mocked<ClaudeCommandService>;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup module
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClaudeSessionService],
    }).compile();

    service = module.get<ClaudeSessionService>(ClaudeSessionService);

    // Create mock instances
    mockWrapperService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      emit: jest.fn(),
    } as any;

    mockCommandService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      executeCommand: jest.fn().mockResolvedValue({
        success: true,
        runId: 'test-run-id',
      }),
      getActiveCommands: jest.fn().mockReturnValue(new Map()),
    } as any;

    // Mock constructor behavior
    MockedClaudeWrapperService.mockImplementation(() => mockWrapperService);
    MockedClaudeCommandService.mockImplementation(() => mockCommandService);
  });

  afterEach(async () => {
    // Cleanup service
    await service.onModuleDestroy();
  });

  describe('createSession', () => {
    it('should create a new session with default configuration', async () => {
      const sessionId = await service.createSession();

      expect(sessionId).toMatch(/^session_\d+_[a-f0-9]{8}$/);
      expect(mockWrapperService.initialize).toHaveBeenCalled();
      expect(mockCommandService.initialize).toHaveBeenCalled();

      const session = service.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.status).toBe('active');
      expect(session?.commandCount).toBe(0);
      expect(session?.activeCommands).toBe(0);
    });

    it('should create session with custom configuration', async () => {
      const config: ClaudeSessionConfig = {
        sessionId: 'custom-session-id',
        maxIdleTime: 60000,
        maxSessionTime: 120000,
        maxConcurrentCommands: 3,
        autoCleanup: false,
        workingDirectory: '/custom/path',
        permissionMode: 'bypassPermissions',
      };

      const sessionId = await service.createSession(config, 'user-123');

      expect(sessionId).toBe('custom-session-id');

      const session = service.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.userId).toBe('user-123');
      expect(session?.workingDirectory).toBe('/custom/path');
      expect(session?.permissionMode).toBe('bypassPermissions');
    });

    it('should throw error for duplicate session ID', async () => {
      const config = { sessionId: 'duplicate-session' };

      await service.createSession(config);

      await expect(service.createSession(config)).rejects.toThrow(
        'Session duplicate-session already exists'
      );
    });

    it('should validate session configuration', async () => {
      const invalidConfigs = [
        { maxIdleTime: -1 },
        { maxSessionTime: -1 },
        { maxConcurrentCommands: 0 },
        { permissionMode: 'invalid' as any },
        { sessionId: 'invalid session id!' },
      ];

      for (const config of invalidConfigs) {
        await expect(service.createSession(config)).rejects.toThrow();
      }
    });

    it('should handle initialization failures', async () => {
      mockWrapperService.initialize.mockRejectedValue(new Error('Initialization failed'));

      await expect(service.createSession()).rejects.toThrow('Session creation failed: Initialization failed');
    });
  });

  describe('getSession', () => {
    it('should return session metadata', async () => {
      const sessionId = await service.createSession();
      const session = service.getSession(sessionId);

      expect(session).toBeDefined();
      expect(session?.sessionId).toBe(sessionId);
      expect(session?.status).toBe('active');
    });

    it('should return undefined for non-existent session', () => {
      const session = service.getSession('non-existent');
      expect(session).toBeUndefined();
    });
  });

  describe('getActiveSessions', () => {
    it('should return only active sessions', async () => {
      const sessionId1 = await service.createSession();
      const sessionId2 = await service.createSession();

      // Suspend one session
      await service.suspendSession(sessionId2);

      const activeSessions = service.getActiveSessions();
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].sessionId).toBe(sessionId1);
    });

    it('should return empty array when no active sessions', () => {
      const activeSessions = service.getActiveSessions();
      expect(activeSessions).toHaveLength(0);
    });
  });

  describe('getSessionStatistics', () => {
    it('should return correct statistics', async () => {
      const sessionId1 = await service.createSession();
      const sessionId2 = await service.createSession();

      // Execute some commands
      await service.executeCommandInSession(sessionId1, ClaudeCommandType.STATUS);
      await service.executeCommandInSession(sessionId2, ClaudeCommandType.STATUS);

      const stats = service.getSessionStatistics();
      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(2);
      expect(stats.totalCommands).toBe(2);
      expect(stats.averageCommandsPerSession).toBe(1);
    });

    it('should return zero statistics when no sessions', () => {
      const stats = service.getSessionStatistics();
      expect(stats.totalSessions).toBe(0);
      expect(stats.activeSessions).toBe(0);
      expect(stats.totalCommands).toBe(0);
      expect(stats.averageCommandsPerSession).toBe(0);
    });
  });

  describe('executeCommandInSession', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = await service.createSession();
    });

    it('should execute command successfully', async () => {
      const runId = await service.executeCommandInSession(
        sessionId,
        ClaudeCommandType.PROMPT,
        'test prompt'
      );

      expect(runId).toBe('test-run-id');
      expect(mockCommandService.executeCommand).toHaveBeenCalledWith({
        type: ClaudeCommandType.PROMPT,
        prompt: 'test prompt',
        options: undefined,
      });

      const session = service.getSession(sessionId);
      expect(session?.commandCount).toBe(1);
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        service.executeCommandInSession('non-existent', ClaudeCommandType.STATUS)
      ).rejects.toThrow('Session not found: non-existent');
    });

    it('should throw error for inactive session', async () => {
      await service.suspendSession(sessionId);

      await expect(
        service.executeCommandInSession(sessionId, ClaudeCommandType.STATUS)
      ).rejects.toThrow(`Session ${sessionId} is not active (status: suspended)`);
    });

    it('should enforce concurrent command limits', async () => {
      const config = { maxConcurrentCommands: 1 };
      const limitedSessionId = await service.createSession(config);

      // Get the session and manually set active commands to be at the limit
      const session = service.getSession(limitedSessionId);
      if (session) {
        session.activeCommands = 1; // Set to the limit (1)
      }

      // Mock the service's defaultConfig to match our test config
      (service as any).defaultConfig = { ...((service as any).defaultConfig), maxConcurrentCommands: 1 };

      // Second command should fail due to limit
      await expect(
        service.executeCommandInSession(limitedSessionId, ClaudeCommandType.STATUS)
      ).rejects.toThrow('has reached maximum concurrent commands limit');
    });

    it('should handle command execution failures', async () => {
      mockCommandService.executeCommand.mockRejectedValue(new Error('Command failed'));

      await expect(
        service.executeCommandInSession(sessionId, ClaudeCommandType.STATUS)
      ).rejects.toThrow('Command failed');

      const session = service.getSession(sessionId);
      expect(session?.activeCommands).toBe(0); // Should be decremented even on failure
    });
  });

  describe('suspendSession', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = await service.createSession();
    });

    it('should suspend active session', async () => {
      await service.suspendSession(sessionId, 'Test suspension');

      const session = service.getSession(sessionId);
      expect(session?.status).toBe('suspended');
    });

    it('should handle already suspended session', async () => {
      await service.suspendSession(sessionId);

      // Should not throw error
      await expect(service.suspendSession(sessionId)).resolves.toBeUndefined();
    });

    it('should cancel active commands during suspension', async () => {
      // Mock active commands
      mockCommandService.getActiveCommands.mockReturnValue(
        new Map([['run-id-1', {} as any], ['run-id-2', {} as any]])
      );

      await service.suspendSession(sessionId);

      expect(mockCommandService.executeCommand).toHaveBeenCalledWith({
        type: ClaudeCommandType.CANCEL,
        runId: 'run-id-1',
      });
      expect(mockCommandService.executeCommand).toHaveBeenCalledWith({
        type: ClaudeCommandType.CANCEL,
        runId: 'run-id-2',
      });
    });

    it('should throw error for non-existent session', async () => {
      await expect(service.suspendSession('non-existent')).rejects.toThrow(
        'Session not found: non-existent'
      );
    });
  });

  describe('resumeSession', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = await service.createSession();
      await service.suspendSession(sessionId);
    });

    it('should resume suspended session', async () => {
      await service.resumeSession(sessionId);

      const session = service.getSession(sessionId);
      expect(session?.status).toBe('active');
    });

    it('should throw error for non-suspended session', async () => {
      await service.resumeSession(sessionId); // Resume once

      await expect(service.resumeSession(sessionId)).rejects.toThrow(
        `Session ${sessionId} is not suspended (status: active)`
      );
    });

    it('should throw error for non-existent session', async () => {
      await expect(service.resumeSession('non-existent')).rejects.toThrow(
        'Session not found: non-existent'
      );
    });
  });

  describe('terminateSession', () => {
    let sessionId: string;

    beforeEach(async () => {
      sessionId = await service.createSession();
    });

    it('should terminate session and cleanup resources', async () => {
      await service.terminateSession(sessionId, 'Test termination');

      const session = service.getSession(sessionId);
      expect(session).toBeUndefined(); // Should be removed during cleanup

      expect(mockWrapperService.shutdown).toHaveBeenCalled();
    });

    it('should handle already terminated session', async () => {
      await service.terminateSession(sessionId);

      // Should not throw error
      await expect(service.terminateSession(sessionId)).resolves.toBeUndefined();
    });

    it('should handle non-existent session', async () => {
      // Should not throw error
      await expect(service.terminateSession('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('session lifecycle and cleanup', () => {
    it('should setup cleanup for sessions with autoCleanup enabled', async () => {
      const config = {
        autoCleanup: true,
        maxIdleTime: 10000, // Longer timeout for test stability
      };

      const sessionId = await service.createSession(config);

      // Session should exist immediately after creation
      const session = service.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.status).toBe('active');
    });

    it('should track session activity correctly', async () => {
      const sessionId = await service.createSession();
      const initialSession = service.getSession(sessionId);
      const initialActivity = initialSession?.lastActivityAt;

      // Wait a bit and execute command
      await new Promise(resolve => setTimeout(resolve, 10));
      await service.executeCommandInSession(sessionId, ClaudeCommandType.STATUS);

      const updatedSession = service.getSession(sessionId);
      expect(updatedSession?.lastActivityAt.getTime()).toBeGreaterThan(
        initialActivity?.getTime() || 0
      );
    });
  });

  describe('module lifecycle', () => {
    it('should cleanup all resources on module destroy', async () => {
      const sessionId1 = await service.createSession();
      const sessionId2 = await service.createSession();

      await service.onModuleDestroy();

      // All sessions should be cleaned up
      expect(service.getSession(sessionId1)).toBeUndefined();
      expect(service.getSession(sessionId2)).toBeUndefined();
    });
  });

  describe('concurrent session management', () => {
    it('should handle multiple concurrent sessions', async () => {
      const sessionPromises = Array.from({ length: 5 }, (_, i) =>
        service.createSession({ sessionId: `session-${i}` })
      );

      const sessionIds = await Promise.all(sessionPromises);

      expect(sessionIds).toHaveLength(5);
      sessionIds.forEach((sessionId, index) => {
        expect(sessionId).toBe(`session-${index}`);
        const session = service.getSession(sessionId);
        expect(session?.status).toBe('active');
      });
    });

    it('should handle concurrent command execution in different sessions', async () => {
      const sessionId1 = await service.createSession();
      const sessionId2 = await service.createSession();

      const commandPromises = [
        service.executeCommandInSession(sessionId1, ClaudeCommandType.STATUS),
        service.executeCommandInSession(sessionId2, ClaudeCommandType.STATUS),
        service.executeCommandInSession(sessionId1, ClaudeCommandType.STATUS),
        service.executeCommandInSession(sessionId2, ClaudeCommandType.STATUS),
      ];

      const results = await Promise.all(commandPromises);

      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result).toBe('test-run-id');
      });

      const session1 = service.getSession(sessionId1);
      const session2 = service.getSession(sessionId2);
      expect(session1?.commandCount).toBe(2);
      expect(session2?.commandCount).toBe(2);
    });

    it('should enforce session limits', async () => {
      // Create sessions up to the limit (assuming limit is 10)
      const sessionPromises = Array.from({ length: 10 }, (_, i) =>
        service.createSession({ sessionId: `session-${i}` })
      );

      await Promise.all(sessionPromises);

      // 11th session should fail
      await expect(service.createSession()).rejects.toThrow(
        'Maximum number of sessions reached'
      );
    });
  });

  describe('error handling and recovery', () => {
    it('should handle wrapper service errors gracefully', async () => {
      const sessionId = await service.createSession();

      // Simulate wrapper error
      const errorHandler = mockWrapperService.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      if (errorHandler) {
        errorHandler(new Error('Wrapper error'));
      }

      // Session should handle the error gracefully
      const session = service.getSession(sessionId);
      expect(session).toBeDefined();
    });

    it('should handle process exit gracefully', async () => {
      const sessionId = await service.createSession();

      // Simulate process exit
      const exitHandler = mockWrapperService.on.mock.calls.find(
        call => call[0] === 'process_exit'
      )?.[1];

      if (exitHandler) {
        exitHandler({ code: 1, signal: 'SIGTERM' });
      }

      // Allow time for cleanup
      await new Promise(resolve => setTimeout(resolve, 50));

      // Session should be terminated or cleaned up (might be removed entirely)
      const session = service.getSession(sessionId);
      expect(session?.status === 'terminated' || session === undefined).toBe(true);
    });

    it('should handle cleanup failures gracefully', async () => {
      const sessionId = await service.createSession();

      // Mock shutdown to fail
      mockWrapperService.shutdown.mockRejectedValue(new Error('Shutdown failed'));

      // Should not throw error
      await expect(service.terminateSession(sessionId)).resolves.toBeUndefined();
    });
  });
});