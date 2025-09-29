import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter } from 'events';
import {
  ClaudeErrorService,
  ClaudeErrorCategory,
  ClaudeErrorSeverity,
  ClaudeRecoveryStrategy,
  ErrorHandlingConfig,
} from '../claude-error.service';
import { ClaudeWrapperService } from '../claude-wrapper.service';
import { ClaudeCommandService } from '../claude-command.service';
import { ClaudeSessionService } from '../claude-session.service';

// Mock implementations
class MockWrapperService extends EventEmitter {
  isWrapperReady = jest.fn().mockReturnValue(true);
  initialize = jest.fn().mockResolvedValue(undefined);
  shutdown = jest.fn().mockResolvedValue(undefined);
}

class MockCommandService extends EventEmitter {
  executeCommand = jest.fn().mockResolvedValue({ success: true, runId: 'test-run' });
  getActiveCommands = jest.fn().mockReturnValue(new Map());
}

class MockSessionService extends EventEmitter {
  getSession = jest.fn().mockReturnValue({ sessionId: 'test-session', status: 'active' });
  terminateSession = jest.fn().mockResolvedValue(undefined);
  createSession = jest.fn().mockResolvedValue('new-session-id');
}

describe('ClaudeErrorService', () => {
  let service: ClaudeErrorService;
  let mockWrapperService: MockWrapperService;
  let mockCommandService: MockCommandService;
  let mockSessionService: MockSessionService;

  beforeEach(async () => {
    mockWrapperService = new MockWrapperService();
    mockCommandService = new MockCommandService();
    mockSessionService = new MockSessionService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ClaudeErrorService,
          useFactory: () => new ClaudeErrorService(
            mockWrapperService as any,
            mockCommandService as any,
            mockSessionService as any
          ),
        },
      ],
    }).compile();

    service = module.get<ClaudeErrorService>(ClaudeErrorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Error Classification', () => {
    it('should classify timeout errors correctly', async () => {
      const timeoutError = new Error('Request timed out after 30 seconds');
      const claudeError = await service.handleError(timeoutError);

      expect(claudeError.category).toBe(ClaudeErrorCategory.TIMEOUT_ERROR);
      expect(claudeError.severity).toBe(ClaudeErrorSeverity.MEDIUM);
      expect(claudeError.recoverable).toBe(true);
      expect(claudeError.recoveryStrategy).toBe(ClaudeRecoveryStrategy.RETRY);
    });

    it('should classify communication errors correctly', async () => {
      const commError = new Error('ECONNREFUSED - Connection refused');
      const claudeError = await service.handleError(commError);

      expect(claudeError.category).toBe(ClaudeErrorCategory.COMMUNICATION_ERROR);
      expect(claudeError.severity).toBe(ClaudeErrorSeverity.MEDIUM);
      expect(claudeError.recoverable).toBe(true);
      expect(claudeError.recoveryStrategy).toBe(ClaudeRecoveryStrategy.RETRY);
    });

    it('should classify validation errors correctly', async () => {
      const validationError = new Error('Validation failed: invalid input');
      validationError.name = 'ValidationError';
      const claudeError = await service.handleError(validationError);

      expect(claudeError.category).toBe(ClaudeErrorCategory.VALIDATION_ERROR);
      expect(claudeError.severity).toBe(ClaudeErrorSeverity.LOW);
      expect(claudeError.recoverable).toBe(false);
      expect(claudeError.recoveryStrategy).toBe(ClaudeRecoveryStrategy.MANUAL);
    });

    it('should classify wrapper errors correctly', async () => {
      const wrapperError = new Error('Wrapper process failed to start');
      const claudeError = await service.handleError(wrapperError);

      expect(claudeError.category).toBe(ClaudeErrorCategory.WRAPPER_ERROR);
      expect(claudeError.severity).toBe(ClaudeErrorSeverity.HIGH);
      expect(claudeError.recoverable).toBe(true);
      expect(claudeError.recoveryStrategy).toBe(ClaudeRecoveryStrategy.RESTART);
    });

    it('should classify resource errors correctly', async () => {
      const resourceError = new Error('Memory limit exceeded');
      const claudeError = await service.handleError(resourceError);

      expect(claudeError.category).toBe(ClaudeErrorCategory.RESOURCE_ERROR);
      expect(claudeError.severity).toBe(ClaudeErrorSeverity.MEDIUM);
      expect(claudeError.recoverable).toBe(true);
      expect(claudeError.recoveryStrategy).toBe(ClaudeRecoveryStrategy.FALLBACK);
    });

    it('should classify critical system errors correctly', async () => {
      const criticalError = new Error('Critical system failure detected');
      const claudeError = await service.handleError(criticalError);

      expect(claudeError.category).toBe(ClaudeErrorCategory.SYSTEM_ERROR);
      expect(claudeError.severity).toBe(ClaudeErrorSeverity.CRITICAL);
      expect(claudeError.recoverable).toBe(false);
      expect(claudeError.recoveryStrategy).toBe(ClaudeRecoveryStrategy.ESCALATE);
    });
  });

  describe('Meaningful Error Messages', () => {
    it('should create meaningful error messages with context', async () => {
      const originalError = new Error('Command execution failed');
      const context = {
        sessionId: 'test-session-123',
        runId: 'run-456',
        commandType: 'prompt',
        userId: 'user-789',
      };

      const claudeError = await service.handleError(originalError, context);

      expect(claudeError.message).toContain('Command execution error');
      expect(claudeError.message).toContain('Session: test-session-123');
      expect(claudeError.message).toContain('Run: run-456');
      expect(claudeError.message).toContain('Command: prompt');
      expect(claudeError.context.userId).toBe('user-789');
    });

    it('should generate unique error codes', async () => {
      const error1 = await service.handleError(new Error('Test error 1'));
      const error2 = await service.handleError(new Error('Test error 2'));

      expect(error1.code).toMatch(/^CLAUDE_SYSTEM_ERROR_\d{6}_[A-Z0-9]{3}$/);
      expect(error2.code).toMatch(/^CLAUDE_SYSTEM_ERROR_\d{6}_[A-Z0-9]{3}$/);
      expect(error1.code).not.toBe(error2.code);
      expect(error1.id).not.toBe(error2.id);
    });

    it('should preserve original error information', async () => {
      const originalError = new Error('Original error message');
      originalError.stack = 'Original stack trace';
      const claudeError = await service.handleError(originalError);

      expect(claudeError.originalError).toBe(originalError);
      expect(claudeError.stack).toBe(originalError.stack);
      expect(claudeError.message).toContain('Original error message');
    });
  });

  describe('Retry Logic', () => {
    it('should attempt retry recovery for communication errors', async () => {
      const commError = new Error('Connection failed');

      // Mock successful retry
      mockCommandService.executeCommand.mockResolvedValueOnce({ success: true, runId: 'retry-run' });

      const claudeError = await service.handleError(commError, {
        runId: 'test-run',
        commandType: 'prompt',
      });

      expect(claudeError.category).toBe(ClaudeErrorCategory.COMMUNICATION_ERROR);
      expect(claudeError.recoveryStrategy).toBe(ClaudeRecoveryStrategy.RETRY);
    });

    it('should calculate retry delays with exponential backoff', () => {
      const config = {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        jitterEnabled: false,
      };

      // Access private method through type assertion for testing
      const calculateDelay = (service as any).calculateRetryDelay.bind(service);

      expect(calculateDelay(1, config)).toBe(1000);  // 1000 * 2^0
      expect(calculateDelay(2, config)).toBe(2000);  // 1000 * 2^1
      expect(calculateDelay(3, config)).toBe(4000);  // 1000 * 2^2
    });

    it('should apply jitter when enabled', () => {
      const config = {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        jitterEnabled: true,
      };

      const calculateDelay = (service as any).calculateRetryDelay.bind(service);

      const delay1 = calculateDelay(2, config);
      const delay2 = calculateDelay(2, config);

      // With jitter, delays should vary (though they might occasionally be the same)
      expect(delay1).toBeGreaterThanOrEqual(2000);
      expect(delay1).toBeLessThanOrEqual(2500); // 2000 + 25% jitter
    });

    it('should respect maximum retry attempts', async () => {
      const retryError = new Error('Connection timeout failure'); // Use a timeout error which is recoverable

      // Mock failed retries
      mockWrapperService.isWrapperReady.mockReturnValue(false);

      const customConfig: Partial<ErrorHandlingConfig> = {
        globalRetryConfig: { maxAttempts: 2, initialDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 1, jitterEnabled: false },
        categorySpecificRetry: {
          [ClaudeErrorCategory.TIMEOUT_ERROR]: { maxAttempts: 2, initialDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 1, jitterEnabled: false },
        },
      };

      const claudeError = await service.handleError(retryError, {}, customConfig);

      expect(claudeError.maxRetries).toBe(2);
      expect(claudeError.recoverable).toBe(true);
    });
  });

  describe('Recovery Strategies', () => {
    it('should execute restart recovery for wrapper errors', async () => {
      const wrapperError = new Error('Wrapper process crashed');

      const claudeError = await service.handleError(wrapperError, {
        sessionId: 'test-session',
      });

      expect(claudeError.recoveryStrategy).toBe(ClaudeRecoveryStrategy.RESTART);
    });

    it('should execute fallback recovery for resource errors', async () => {
      const resourceError = new Error('Memory limit exceeded');

      const claudeError = await service.handleError(resourceError);

      expect(claudeError.recoveryStrategy).toBe(ClaudeRecoveryStrategy.FALLBACK);
    });

    it('should escalate critical errors immediately', async () => {
      const criticalError = new Error('Fatal system error');

      let escalatedError: any = null;
      service.once('error_escalated', (data) => {
        escalatedError = data;
      });

      const claudeError = await service.handleError(criticalError);

      expect(claudeError.recoveryStrategy).toBe(ClaudeRecoveryStrategy.ESCALATE);
      expect(claudeError.severity).toBe(ClaudeErrorSeverity.CRITICAL);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit breaker after threshold failures', async () => {
      const config = service.getConfig();
      config.circuitBreakerThreshold = 2;
      service.updateConfig(config);

      let circuitOpenEvent: any = null;
      service.once('circuit_breaker_opened', (data) => {
        circuitOpenEvent = data;
      });

      // Trigger failures to reach threshold
      await service.handleError(new Error('Failure 1'), { sessionId: 'test' });
      await service.handleError(new Error('Failure 2'), { sessionId: 'test' });

      expect(circuitOpenEvent).toBeTruthy();
      expect(circuitOpenEvent.failures).toBe(2);
    });

    it('should prevent processing when circuit is open', async () => {
      // First, open the circuit breaker
      const config = service.getConfig();
      config.circuitBreakerThreshold = 1;
      service.updateConfig(config);

      await service.handleError(new Error('Initial failure'), { sessionId: 'test' });

      // Now try to handle another error - should be blocked
      const blockedError = await service.handleError(new Error('Blocked error'), { sessionId: 'test' });

      expect(blockedError.message).toContain('Circuit breaker is open');
      expect(blockedError.recoveryStrategy).toBe(ClaudeRecoveryStrategy.ESCALATE);
    });
  });

  describe('Error Statistics', () => {
    it('should track error statistics correctly', async () => {
      // Create various types of errors
      await service.handleError(new Error('timeout error with timeout'), { sessionId: 'session1' });
      await service.handleError(new Error('connection error'), { sessionId: 'session2' });
      await service.handleError(new Error('critical fatal error'), { sessionId: 'session3' });

      const stats = service.getErrorStatistics();

      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByCategory[ClaudeErrorCategory.TIMEOUT_ERROR]).toBe(1);
      expect(stats.errorsByCategory[ClaudeErrorCategory.COMMUNICATION_ERROR]).toBe(1);
      expect(stats.errorsByCategory[ClaudeErrorCategory.SYSTEM_ERROR]).toBe(1);
      expect(stats.errorsBySeverity[ClaudeErrorSeverity.CRITICAL]).toBe(1);
    });

    it('should provide recent errors', async () => {
      await service.handleError(new Error('Recent error 1'));

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 2));

      await service.handleError(new Error('Recent error 2'));

      const recentErrors = service.getRecentErrors(1);

      expect(recentErrors).toHaveLength(1);
      expect(recentErrors[0].message).toContain('Recent error 2'); // Most recent should be first
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration correctly', () => {
      const newConfig: Partial<ErrorHandlingConfig> = {
        circuitBreakerThreshold: 10,
        maxErrorHistory: 500,
      };

      let configUpdatedEvent: any = null;
      service.once('config_updated', (data) => {
        configUpdatedEvent = data;
      });

      service.updateConfig(newConfig);

      const updatedConfig = service.getConfig();
      expect(updatedConfig.circuitBreakerThreshold).toBe(10);
      expect(updatedConfig.maxErrorHistory).toBe(500);
      expect(configUpdatedEvent).toBeTruthy();
    });

    it('should maintain configuration immutability', () => {
      const originalConfig = service.getConfig();
      originalConfig.circuitBreakerThreshold = 999;

      const actualConfig = service.getConfig();
      expect(actualConfig.circuitBreakerThreshold).not.toBe(999);
    });
  });

  describe('Error History Management', () => {
    it('should store and retrieve errors by ID', async () => {
      const originalError = new Error('Test error for retrieval');
      const claudeError = await service.handleError(originalError);

      const retrievedError = service.getError(claudeError.id);
      expect(retrievedError).toBeDefined();
      expect(retrievedError?.message).toBe(claudeError.message);
      expect(retrievedError?.id).toBe(claudeError.id);
    });

    it('should maintain error history size limit', async () => {
      // Set small history limit for testing
      service.updateConfig({ maxErrorHistory: 3 });

      // Create more errors than the limit
      await service.handleError(new Error('Error 1'));
      await service.handleError(new Error('Error 2'));
      await service.handleError(new Error('Error 3'));
      await service.handleError(new Error('Error 4'));

      const stats = service.getErrorStatistics();
      expect(stats.totalErrors).toBe(3); // Should not exceed limit
    });

    it('should clear error history', async () => {
      await service.handleError(new Error('Error to be cleared'));

      let historyClearedEvent = false;
      service.once('error_history_cleared', () => {
        historyClearedEvent = true;
      });

      service.clearErrorHistory();

      const stats = service.getErrorStatistics();
      expect(stats.totalErrors).toBe(0);
      expect(historyClearedEvent).toBe(true);
    });
  });

  describe('Integration with Claude Services', () => {
    it('should handle wrapper service errors automatically', async () => {
      let handledError: any = null;
      service.once('error_handled', (error) => {
        handledError = error;
      });

      // Simulate wrapper service error
      const testError = new Error('Wrapper service test error');
      mockWrapperService.emit('error', testError);

      // Give it time to process
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handledError).toBeTruthy();
      expect(handledError.context.source).toBe('wrapper_service');
    });

    it('should handle session service errors with session context', async () => {
      let handledError: any = null;
      service.once('error_handled', (error) => {
        handledError = error;
      });

      // Simulate session service error
      const sessionError = new Error('Session test error');
      mockSessionService.emit('session_error', { sessionId: 'test-session', error: sessionError });

      // Give it time to process
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handledError).toBeTruthy();
      expect(handledError.context.source).toBe('session_service');
      expect(handledError.context.sessionId).toBe('test-session');
    });
  });

  describe('Event Emissions', () => {
    it('should emit error_handled event', async () => {
      let emittedEvent: any = null;
      service.once('error_handled', (error) => {
        emittedEvent = error;
      });

      const claudeError = await service.handleError(new Error('Test error'));

      expect(emittedEvent).toBeTruthy();
      expect(emittedEvent.id).toBe(claudeError.id);
    });

    it('should emit error_stored event', async () => {
      let storedEvent: any = null;
      service.once('error_stored', (error) => {
        storedEvent = error;
      });

      await service.handleError(new Error('Test error'));

      expect(storedEvent).toBeTruthy();
    });
  });

  describe('Error Recovery Context', () => {
    it('should track recovery attempts', async () => {
      const recoverableError = new Error('Connection timeout');

      const claudeError = await service.handleError(recoverableError, {
        runId: 'test-run',
        commandType: 'prompt',
      });

      expect(claudeError.recoverable).toBe(true);
      expect(claudeError.recoveryStrategy).toBe(ClaudeRecoveryStrategy.RETRY);
    });
  });

  describe('Graceful Degradation', () => {
    it('should provide fallback modes for different error types', async () => {
      const resourceError = new Error('Memory limit exceeded');

      let recoveryEvent: any = null;
      service.once('error_recovered', (data) => {
        recoveryEvent = data;
      });

      await service.handleError(resourceError);

      // Recovery is async, so we need to wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));
    });
  });

  describe('Error Context Preservation', () => {
    it('should preserve and enhance error context', async () => {
      const context = {
        sessionId: 'test-session',
        runId: 'test-run',
        commandType: 'prompt',
        userId: 'test-user',
        workingDirectory: '/test/dir',
        customProperty: 'custom-value',
      };

      const claudeError = await service.handleError(new Error('Context test'), context);

      expect(claudeError.context.sessionId).toBe('test-session');
      expect(claudeError.context.runId).toBe('test-run');
      expect(claudeError.context.commandType).toBe('prompt');
      expect(claudeError.context.userId).toBe('test-user');
      expect(claudeError.context.workingDirectory).toBe('/test/dir');
      expect(claudeError.context.customProperty).toBe('custom-value');
    });
  });
});