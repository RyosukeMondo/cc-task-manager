import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { ClaudeWrapperService, ClaudeResponse } from './claude-wrapper.service';
import { ClaudeCommandService, CommandExecutionContext } from './claude-command.service';
import { ClaudeSessionService } from './claude-session.service';

/**
 * Enum for Claude Code error categories
 * Following contract-driven design for error classification
 */
export enum ClaudeErrorCategory {
  WRAPPER_ERROR = 'wrapper_error',
  COMMAND_ERROR = 'command_error',
  SESSION_ERROR = 'session_error',
  COMMUNICATION_ERROR = 'communication_error',
  VALIDATION_ERROR = 'validation_error',
  TIMEOUT_ERROR = 'timeout_error',
  RESOURCE_ERROR = 'resource_error',
  SYSTEM_ERROR = 'system_error',
}

/**
 * Enum for error severity levels
 * Implements error priority classification
 */
export enum ClaudeErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Enum for recovery strategies
 * Defines available error recovery approaches
 */
export enum ClaudeRecoveryStrategy {
  RETRY = 'retry',
  RESTART = 'restart',
  FALLBACK = 'fallback',
  ESCALATE = 'escalate',
  IGNORE = 'ignore',
  MANUAL = 'manual',
}

/**
 * Interface for Claude Code error details
 * Provides comprehensive error information structure
 */
export interface ClaudeError {
  id: string;
  timestamp: Date;
  category: ClaudeErrorCategory;
  severity: ClaudeErrorSeverity;
  code: string;
  message: string;
  originalError?: Error | any;
  context: {
    sessionId?: string;
    runId?: string;
    commandType?: string;
    userId?: string;
    workingDirectory?: string;
    [key: string]: any;
  };
  stack?: string;
  recoverable: boolean;
  retryCount: number;
  maxRetries: number;
  recoveryStrategy: ClaudeRecoveryStrategy;
}

/**
 * Interface for retry configuration
 * Defines retry behavior parameters
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  retryCondition?: (error: ClaudeError) => boolean;
}

/**
 * Interface for error recovery context
 * Tracks recovery attempt progress and state
 */
export interface ErrorRecoveryContext {
  errorId: string;
  strategy: ClaudeRecoveryStrategy;
  attemptCount: number;
  maxAttempts: number;
  startTime: Date;
  lastAttemptTime?: Date;
  recoveryState: 'pending' | 'in_progress' | 'success' | 'failed' | 'abandoned';
  recoveryData?: any;
}

/**
 * Interface for error statistics and metrics
 * Provides insights into error patterns and system health
 */
export interface ErrorStatistics {
  totalErrors: number;
  errorsByCategory: Record<ClaudeErrorCategory, number>;
  errorsBySeverity: Record<ClaudeErrorSeverity, number>;
  errorsByStrategy: Record<ClaudeRecoveryStrategy, number>;
  averageRecoveryTime: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  recoverySuccessRate: number;
  recentErrors: ClaudeError[];
  criticalErrorsLast24h: number;
}

/**
 * Interface for error handling configuration
 * Defines system-wide error handling behavior
 */
export interface ErrorHandlingConfig {
  enabledCategories: ClaudeErrorCategory[];
  globalRetryConfig: RetryConfig;
  categorySpecificRetry: Partial<Record<ClaudeErrorCategory, RetryConfig>>;
  escalationThreshold: number;
  circuitBreakerEnabled: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  gracefulDegradationEnabled: boolean;
  errorReportingEnabled: boolean;
  maxErrorHistory: number;
}

/**
 * Claude Code error handling and recovery mechanisms service
 *
 * Implements comprehensive error handling for Claude Code integration following SOLID principles:
 *
 * - Single Responsibility: Manages Claude Code error handling and recovery
 * - Open/Closed: Extensible for new error types and recovery strategies
 * - Liskov Substitution: Can be substituted with other error handling implementations
 * - Interface Segregation: Focused interface for error handling operations
 * - Dependency Inversion: Depends on Claude service abstractions
 *
 * Applies KISS principle for simple error handling workflow
 * Ensures DRY/SSOT compliance with centralized error management
 * Implements fail-fast validation and comprehensive error handling
 * Provides automatic retry logic and graceful degradation
 */
@Injectable()
export class ClaudeErrorService extends EventEmitter {
  private readonly logger = new Logger(ClaudeErrorService.name);
  private readonly errorHistory = new Map<string, ClaudeError>();
  private readonly recoveryContexts = new Map<string, ErrorRecoveryContext>();
  private readonly circuitBreakers = new Map<string, { failures: number; lastFailureTime: Date; isOpen: boolean }>();

  // Default configuration
  private readonly defaultConfig: ErrorHandlingConfig = {
    enabledCategories: Object.values(ClaudeErrorCategory),
    globalRetryConfig: {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterEnabled: true,
    },
    categorySpecificRetry: {
      [ClaudeErrorCategory.COMMUNICATION_ERROR]: {
        maxAttempts: 5,
        initialDelayMs: 500,
        maxDelayMs: 10000,
        backoffMultiplier: 1.5,
        jitterEnabled: true,
      },
      [ClaudeErrorCategory.TIMEOUT_ERROR]: {
        maxAttempts: 3,
        initialDelayMs: 2000,
        maxDelayMs: 20000,
        backoffMultiplier: 2,
        jitterEnabled: false,
      },
      [ClaudeErrorCategory.RESOURCE_ERROR]: {
        maxAttempts: 2,
        initialDelayMs: 5000,
        maxDelayMs: 30000,
        backoffMultiplier: 3,
        jitterEnabled: true,
      },
    },
    escalationThreshold: 5,
    circuitBreakerEnabled: true,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000, // 1 minute
    gracefulDegradationEnabled: true,
    errorReportingEnabled: true,
    maxErrorHistory: 1000,
  };

  private config: ErrorHandlingConfig;

  constructor(
    private readonly wrapperService?: ClaudeWrapperService,
    private readonly commandService?: ClaudeCommandService,
    private readonly sessionService?: ClaudeSessionService
  ) {
    super();
    this.config = { ...this.defaultConfig };
    this.setupErrorHandlers();
    this.setupCleanupScheduler();
  }

  /**
   * Handle Claude Code error with automatic recovery
   * Implements comprehensive error processing and recovery coordination
   */
  async handleError(
    originalError: Error | any,
    context: Partial<ClaudeError['context']> = {},
    customConfig?: Partial<ErrorHandlingConfig>
  ): Promise<ClaudeError> {
    // Apply custom configuration if provided (deep merge)
    const effectiveConfig = customConfig ? this.mergeConfig(this.config, customConfig) : this.config;

    // Create structured error object with effective config
    const claudeError = this.createClaudeError(originalError, context, effectiveConfig);

    // Check if error category is enabled for processing
    if (!effectiveConfig.enabledCategories.includes(claudeError.category)) {
      this.logger.debug(`Error category ${claudeError.category} is disabled, skipping processing`);
      return claudeError;
    }

    this.logger.debug(`Processing Claude error: ${claudeError.code} - ${claudeError.message}`);

    try {
      // Store error in history
      this.storeError(claudeError);

      // Check circuit breaker
      if (effectiveConfig.circuitBreakerEnabled && this.isCircuitBreakerOpen(claudeError)) {
        claudeError.recoveryStrategy = ClaudeRecoveryStrategy.ESCALATE;
        claudeError.message += ' (Circuit breaker is open)';
        this.emit('error_handled', claudeError);
        return claudeError;
      }

      // Determine recovery strategy
      claudeError.recoveryStrategy = this.determineRecoveryStrategy(claudeError, effectiveConfig);

      // Update circuit breaker state
      this.updateCircuitBreaker(claudeError);

      // Attempt recovery if appropriate
      if (claudeError.recoverable && claudeError.recoveryStrategy !== ClaudeRecoveryStrategy.MANUAL) {
        await this.attemptRecovery(claudeError, effectiveConfig);
      }

      // Emit error handling completion
      this.emit('error_handled', claudeError);

      return claudeError;
    } catch (recoveryError) {
      this.logger.error('Error during error handling process:', recoveryError);

      claudeError.recoveryStrategy = ClaudeRecoveryStrategy.ESCALATE;
      claudeError.recoverable = false;

      this.emit('error_handling_failed', { originalError: claudeError, recoveryError });
      return claudeError;
    }
  }

  /**
   * Attempt error recovery using determined strategy
   * Implements recovery coordination with proper error handling
   */
  private async attemptRecovery(
    claudeError: ClaudeError,
    config: ErrorHandlingConfig
  ): Promise<void> {
    const recoveryContext: ErrorRecoveryContext = {
      errorId: claudeError.id,
      strategy: claudeError.recoveryStrategy,
      attemptCount: 0,
      maxAttempts: claudeError.maxRetries,
      startTime: new Date(),
      recoveryState: 'pending',
    };

    this.recoveryContexts.set(claudeError.id, recoveryContext);

    try {
      recoveryContext.recoveryState = 'in_progress';

      switch (claudeError.recoveryStrategy) {
        case ClaudeRecoveryStrategy.RETRY:
          await this.executeRetryRecovery(claudeError, recoveryContext, config);
          break;

        case ClaudeRecoveryStrategy.RESTART:
          await this.executeRestartRecovery(claudeError, recoveryContext);
          break;

        case ClaudeRecoveryStrategy.FALLBACK:
          await this.executeFallbackRecovery(claudeError, recoveryContext);
          break;

        case ClaudeRecoveryStrategy.ESCALATE:
          await this.executeEscalationRecovery(claudeError, recoveryContext);
          break;

        default:
          this.logger.warn(`Unknown recovery strategy: ${claudeError.recoveryStrategy}`);
          recoveryContext.recoveryState = 'failed';
      }

      // If recovery state is still in_progress after switch, mark as success
      if (recoveryContext.recoveryState === 'in_progress') {
        recoveryContext.recoveryState = 'success';
      }

      if (recoveryContext.recoveryState === 'success') {
        this.logger.log(`Recovery successful for error ${claudeError.id} using strategy ${claudeError.recoveryStrategy}`);
        this.emit('error_recovered', { error: claudeError, context: recoveryContext });
      }
    } catch (error) {
      recoveryContext.recoveryState = 'failed';
      this.logger.error(`Recovery failed for error ${claudeError.id}:`, error);
      this.emit('recovery_failed', { error: claudeError, context: recoveryContext, recoveryError: error });
    }
  }

  /**
   * Execute retry-based recovery
   * Implements intelligent retry logic with exponential backoff
   */
  private async executeRetryRecovery(
    claudeError: ClaudeError,
    recoveryContext: ErrorRecoveryContext,
    config: ErrorHandlingConfig
  ): Promise<void> {
    const retryConfig = config.categorySpecificRetry[claudeError.category] || config.globalRetryConfig;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      recoveryContext.attemptCount = attempt;
      recoveryContext.lastAttemptTime = new Date();

      this.logger.debug(`Retry attempt ${attempt}/${retryConfig.maxAttempts} for error ${claudeError.id}`);

      // Calculate delay with exponential backoff and jitter
      const delay = this.calculateRetryDelay(attempt, retryConfig);

      if (delay > 0) {
        await this.sleep(delay);
      }

      try {
        // Attempt to recreate the original operation
        await this.retryOriginalOperation(claudeError);

        recoveryContext.recoveryState = 'success';
        this.logger.log(`Retry recovery successful on attempt ${attempt} for error ${claudeError.id}`);
        return;
      } catch (retryError) {
        this.logger.debug(`Retry attempt ${attempt} failed for error ${claudeError.id}:`, retryError);

        // Update error with retry information
        claudeError.retryCount = attempt;

        if (attempt === retryConfig.maxAttempts) {
          recoveryContext.recoveryState = 'failed';
          throw new Error(`All retry attempts exhausted for error ${claudeError.id}`);
        }
      }
    }
  }

  /**
   * Execute restart-based recovery
   * Implements service restart recovery for critical errors
   */
  private async executeRestartRecovery(
    claudeError: ClaudeError,
    recoveryContext: ErrorRecoveryContext
  ): Promise<void> {
    this.logger.warn(`Executing restart recovery for error ${claudeError.id}`);

    try {
      if (claudeError.context.sessionId && this.sessionService) {
        // Terminate and recreate session
        await this.sessionService.terminateSession(claudeError.context.sessionId, 'Error recovery restart');

        // Wait a moment before recreating
        await this.sleep(2000);

        // Create new session with same configuration
        const newSessionId = await this.sessionService.createSession({
          workingDirectory: claudeError.context.workingDirectory,
        }, claudeError.context.userId);

        recoveryContext.recoveryData = { newSessionId };
        recoveryContext.recoveryState = 'success';

        this.logger.log(`Restart recovery successful, new session: ${newSessionId}`);
      } else if (this.wrapperService) {
        // Restart wrapper service
        await this.wrapperService.shutdown();
        await this.sleep(1000);
        await this.wrapperService.initialize();

        recoveryContext.recoveryState = 'success';
        this.logger.log(`Wrapper service restarted successfully`);
      }
    } catch (error) {
      recoveryContext.recoveryState = 'failed';
      throw new Error(`Restart recovery failed: ${error.message}`);
    }
  }

  /**
   * Execute fallback recovery
   * Implements graceful degradation with alternative approaches
   */
  private async executeFallbackRecovery(
    claudeError: ClaudeError,
    recoveryContext: ErrorRecoveryContext
  ): Promise<void> {
    this.logger.log(`Executing fallback recovery for error ${claudeError.id}`);

    try {
      switch (claudeError.category) {
        case ClaudeErrorCategory.COMMUNICATION_ERROR:
          // Fallback to simplified communication mode
          recoveryContext.recoveryData = { fallbackMode: 'simplified_communication' };
          break;

        case ClaudeErrorCategory.RESOURCE_ERROR:
          // Fallback to resource-constrained mode
          recoveryContext.recoveryData = { fallbackMode: 'resource_constrained' };
          break;

        case ClaudeErrorCategory.TIMEOUT_ERROR:
          // Fallback to extended timeout mode
          recoveryContext.recoveryData = { fallbackMode: 'extended_timeout' };
          break;

        default:
          // Generic fallback to read-only mode
          recoveryContext.recoveryData = { fallbackMode: 'read_only' };
      }

      recoveryContext.recoveryState = 'success';
      this.logger.log(`Fallback recovery successful with mode: ${recoveryContext.recoveryData.fallbackMode}`);
    } catch (error) {
      recoveryContext.recoveryState = 'failed';
      throw new Error(`Fallback recovery failed: ${error.message}`);
    }
  }

  /**
   * Execute escalation recovery
   * Implements error escalation for manual intervention
   */
  private async executeEscalationRecovery(
    claudeError: ClaudeError,
    recoveryContext: ErrorRecoveryContext
  ): Promise<void> {
    this.logger.warn(`Escalating error ${claudeError.id} for manual intervention`);

    try {
      // Create escalation record
      const escalationData = {
        errorId: claudeError.id,
        severity: claudeError.severity,
        category: claudeError.category,
        context: claudeError.context,
        escalatedAt: new Date(),
        requiresImmediteAttention: claudeError.severity === ClaudeErrorSeverity.CRITICAL,
      };

      recoveryContext.recoveryData = escalationData;
      recoveryContext.recoveryState = 'success';

      // Emit escalation event for external handling
      this.emit('error_escalated', {
        error: claudeError,
        escalationData,
        context: recoveryContext,
      });

      this.logger.warn(`Error escalated successfully: ${claudeError.id}`);
    } catch (error) {
      recoveryContext.recoveryState = 'failed';
      throw new Error(`Escalation failed: ${error.message}`);
    }
  }

  /**
   * Retry original operation that caused the error
   * Implements operation retry based on error context
   */
  private async retryOriginalOperation(claudeError: ClaudeError): Promise<void> {
    const context = claudeError.context;

    if (context.runId && context.commandType && this.commandService) {
      // Retry command execution
      const response = await this.commandService.executeCommand({
        type: context.commandType as any,
        prompt: context.prompt,
        runId: context.runId,
        options: context.options,
      });

      if (!response.success) {
        throw new Error(`Command retry failed: ${response.error}`);
      }
    } else if (context.sessionId && this.sessionService) {
      // Check session health
      const session = this.sessionService.getSession(context.sessionId);
      if (!session || session.status !== 'active') {
        throw new Error(`Session ${context.sessionId} is not available for retry`);
      }
    } else {
      // Generic retry - check wrapper service health
      if (!this.wrapperService?.isWrapperReady()) {
        throw new Error('Wrapper service is not ready for retry');
      }
    }
  }

  /**
   * Create structured Claude error from original error
   * Implements error normalization and classification
   */
  private createClaudeError(
    originalError: Error | any,
    context: Partial<ClaudeError['context']> = {},
    effectiveConfig?: ErrorHandlingConfig
  ): ClaudeError {
    const errorMessage = originalError?.message || String(originalError) || 'Unknown error';
    const errorStack = originalError?.stack || new Error().stack;

    // Classify error
    const category = this.classifyError(originalError, errorMessage);
    const severity = this.determineSeverity(category, errorMessage, context);
    const code = this.generateErrorCode(category, originalError);

    // Determine recoverability
    const recoverable = this.isRecoverable(category, severity, originalError);
    const maxRetries = this.getMaxRetriesWithConfig(category, effectiveConfig || this.config);

    const claudeError: ClaudeError = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      category,
      severity,
      code,
      message: this.createMeaningfulErrorMessage(category, errorMessage, context),
      originalError,
      context: { ...context },
      stack: errorStack,
      recoverable,
      retryCount: 0,
      maxRetries,
      recoveryStrategy: ClaudeRecoveryStrategy.RETRY, // Will be determined later
    };

    return claudeError;
  }

  /**
   * Classify error into appropriate category
   * Implements intelligent error categorization
   */
  private classifyError(originalError: Error | any, message: string): ClaudeErrorCategory {
    const messageL = message.toLowerCase();

    // Check for specific error types
    if (originalError?.name === 'ValidationError' || messageL.includes('validation')) {
      return ClaudeErrorCategory.VALIDATION_ERROR;
    }

    if (messageL.includes('timeout') || messageL.includes('timed out')) {
      return ClaudeErrorCategory.TIMEOUT_ERROR;
    }

    if (messageL.includes('connection') || messageL.includes('network') ||
        messageL.includes('econnrefused') || messageL.includes('enotfound')) {
      return ClaudeErrorCategory.COMMUNICATION_ERROR;
    }

    if (messageL.includes('memory') || messageL.includes('resource') ||
        messageL.includes('limit') || messageL.includes('quota')) {
      return ClaudeErrorCategory.RESOURCE_ERROR;
    }

    if (messageL.includes('session') || messageL.includes('session not found')) {
      return ClaudeErrorCategory.SESSION_ERROR;
    }

    if (messageL.includes('command') || messageL.includes('execution')) {
      return ClaudeErrorCategory.COMMAND_ERROR;
    }

    if (messageL.includes('wrapper') || messageL.includes('process') || messageL.includes('stdio')) {
      return ClaudeErrorCategory.WRAPPER_ERROR;
    }

    // Default to system error
    return ClaudeErrorCategory.SYSTEM_ERROR;
  }

  /**
   * Determine error severity based on category and context
   * Implements severity assessment logic
   */
  private determineSeverity(
    category: ClaudeErrorCategory,
    message: string,
    context: Partial<ClaudeError['context']>
  ): ClaudeErrorSeverity {
    const messageL = message.toLowerCase();

    // Critical severity conditions
    if (category === ClaudeErrorCategory.SYSTEM_ERROR ||
        messageL.includes('critical') ||
        messageL.includes('fatal') ||
        messageL.includes('corrupt')) {
      return ClaudeErrorSeverity.CRITICAL;
    }

    // High severity conditions
    if (category === ClaudeErrorCategory.WRAPPER_ERROR ||
        category === ClaudeErrorCategory.SESSION_ERROR ||
        messageL.includes('failed to initialize') ||
        messageL.includes('service unavailable')) {
      return ClaudeErrorSeverity.HIGH;
    }

    // Medium severity conditions
    if (category === ClaudeErrorCategory.COMMAND_ERROR ||
        category === ClaudeErrorCategory.RESOURCE_ERROR ||
        category === ClaudeErrorCategory.TIMEOUT_ERROR ||
        category === ClaudeErrorCategory.COMMUNICATION_ERROR ||
        messageL.includes('retry') ||
        messageL.includes('limit exceeded')) {
      return ClaudeErrorSeverity.MEDIUM;
    }

    // Default to low severity
    return ClaudeErrorSeverity.LOW;
  }

  /**
   * Generate meaningful error code
   * Implements standardized error coding
   */
  private generateErrorCode(category: ClaudeErrorCategory, originalError: Error | any): string {
    const categoryCode = category.toUpperCase().replace('_', '_');
    const timestamp = Date.now().toString().slice(-6);
    const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase();

    return `CLAUDE_${categoryCode}_${timestamp}_${randomSuffix}`;
  }

  /**
   * Create meaningful error message
   * Implements user-friendly error messaging
   */
  private createMeaningfulErrorMessage(
    category: ClaudeErrorCategory,
    originalMessage: string,
    context: Partial<ClaudeError['context']>
  ): string {
    const contextInfo = [];

    if (context.sessionId) contextInfo.push(`Session: ${context.sessionId}`);
    if (context.runId) contextInfo.push(`Run: ${context.runId}`);
    if (context.commandType) contextInfo.push(`Command: ${context.commandType}`);

    const contextStr = contextInfo.length > 0 ? ` (${contextInfo.join(', ')})` : '';

    switch (category) {
      case ClaudeErrorCategory.WRAPPER_ERROR:
        return `Claude wrapper service error: ${originalMessage}${contextStr}`;

      case ClaudeErrorCategory.COMMAND_ERROR:
        return `Command execution error: ${originalMessage}${contextStr}`;

      case ClaudeErrorCategory.SESSION_ERROR:
        return `Session management error: ${originalMessage}${contextStr}`;

      case ClaudeErrorCategory.COMMUNICATION_ERROR:
        return `Communication error with Claude service: ${originalMessage}${contextStr}`;

      case ClaudeErrorCategory.VALIDATION_ERROR:
        return `Input validation error: ${originalMessage}${contextStr}`;

      case ClaudeErrorCategory.TIMEOUT_ERROR:
        return `Operation timed out: ${originalMessage}${contextStr}`;

      case ClaudeErrorCategory.RESOURCE_ERROR:
        return `Resource limit exceeded: ${originalMessage}${contextStr}`;

      default:
        return `System error: ${originalMessage}${contextStr}`;
    }
  }

  /**
   * Determine if error is recoverable
   * Implements recoverability assessment
   */
  private isRecoverable(
    category: ClaudeErrorCategory,
    severity: ClaudeErrorSeverity,
    originalError: Error | any
  ): boolean {
    // Critical system errors are typically not recoverable
    if (severity === ClaudeErrorSeverity.CRITICAL) {
      return false;
    }

    // Some categories are inherently recoverable
    const recoverableCategories = [
      ClaudeErrorCategory.COMMUNICATION_ERROR,
      ClaudeErrorCategory.TIMEOUT_ERROR,
      ClaudeErrorCategory.RESOURCE_ERROR,
      ClaudeErrorCategory.COMMAND_ERROR,
      ClaudeErrorCategory.WRAPPER_ERROR,
      ClaudeErrorCategory.SESSION_ERROR,
    ];

    if (recoverableCategories.includes(category)) {
      return true;
    }

    // Validation errors are generally not recoverable through retry
    if (category === ClaudeErrorCategory.VALIDATION_ERROR) {
      return false;
    }

    // Default to recoverable for medium and low severity
    return severity === ClaudeErrorSeverity.MEDIUM || severity === ClaudeErrorSeverity.LOW;
  }

  /**
   * Get maximum retry attempts for error category
   * Implements category-specific retry limits
   */
  private getMaxRetriesForCategory(category: ClaudeErrorCategory): number {
    const categoryRetryConfig = this.config.categorySpecificRetry[category];
    if (categoryRetryConfig) {
      return categoryRetryConfig.maxAttempts;
    }
    return this.config.globalRetryConfig.maxAttempts;
  }

  /**
   * Get maximum retry attempts for error category with specific config
   * Implements category-specific retry limits with config override
   */
  private getMaxRetriesWithConfig(category: ClaudeErrorCategory, config: ErrorHandlingConfig): number {
    const categoryRetryConfig = config.categorySpecificRetry[category];
    if (categoryRetryConfig) {
      return categoryRetryConfig.maxAttempts;
    }
    return config.globalRetryConfig.maxAttempts;
  }

  /**
   * Determine recovery strategy for error
   * Implements intelligent strategy selection
   */
  private determineRecoveryStrategy(
    claudeError: ClaudeError,
    config: ErrorHandlingConfig
  ): ClaudeRecoveryStrategy {
    // Check if error should be escalated immediately
    if (claudeError.severity === ClaudeErrorSeverity.CRITICAL) {
      return ClaudeRecoveryStrategy.ESCALATE;
    }

    // Non-recoverable errors get escalated, except validation errors which are manual
    if (!claudeError.recoverable) {
      if (claudeError.category === ClaudeErrorCategory.VALIDATION_ERROR) {
        return ClaudeRecoveryStrategy.MANUAL;
      }
      return ClaudeRecoveryStrategy.ESCALATE;
    }

    // Strategy based on category
    switch (claudeError.category) {
      case ClaudeErrorCategory.WRAPPER_ERROR:
      case ClaudeErrorCategory.SESSION_ERROR:
        return ClaudeRecoveryStrategy.RESTART;

      case ClaudeErrorCategory.COMMUNICATION_ERROR:
      case ClaudeErrorCategory.TIMEOUT_ERROR:
        return ClaudeRecoveryStrategy.RETRY;

      case ClaudeErrorCategory.RESOURCE_ERROR:
        return config.gracefulDegradationEnabled
          ? ClaudeRecoveryStrategy.FALLBACK
          : ClaudeRecoveryStrategy.RETRY;

      case ClaudeErrorCategory.COMMAND_ERROR:
        return ClaudeRecoveryStrategy.RETRY;

      case ClaudeErrorCategory.VALIDATION_ERROR:
        return ClaudeRecoveryStrategy.MANUAL;

      default:
        return ClaudeRecoveryStrategy.RETRY;
    }
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   * Implements intelligent retry timing
   */
  private calculateRetryDelay(attempt: number, config: RetryConfig): number {
    const baseDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(baseDelay, config.maxDelayMs);

    if (config.jitterEnabled) {
      // Add up to 25% jitter
      const jitter = cappedDelay * 0.25 * Math.random();
      return Math.floor(cappedDelay + jitter);
    }

    return cappedDelay;
  }

  /**
   * Check circuit breaker state
   * Implements circuit breaker pattern for error prevention
   */
  private isCircuitBreakerOpen(claudeError: ClaudeError): boolean {
    if (!this.config.circuitBreakerEnabled) {
      return false;
    }

    const breakerKey = `${claudeError.category}_${claudeError.context.sessionId || 'global'}`;
    const breaker = this.circuitBreakers.get(breakerKey);

    if (!breaker) {
      return false;
    }

    // Check if circuit breaker should be reset
    const timeSinceLastFailure = Date.now() - breaker.lastFailureTime.getTime();
    if (breaker.isOpen && timeSinceLastFailure > this.config.circuitBreakerTimeout) {
      breaker.isOpen = false;
      breaker.failures = 0;
      this.logger.log(`Circuit breaker reset for ${breakerKey}`);
      return false;
    }

    return breaker.isOpen;
  }

  /**
   * Update circuit breaker state
   * Implements circuit breaker state management
   */
  private updateCircuitBreaker(claudeError: ClaudeError): void {
    if (!this.config.circuitBreakerEnabled) {
      return;
    }

    const breakerKey = `${claudeError.category}_${claudeError.context.sessionId || 'global'}`;
    let breaker = this.circuitBreakers.get(breakerKey);

    if (!breaker) {
      breaker = { failures: 0, lastFailureTime: new Date(), isOpen: false };
      this.circuitBreakers.set(breakerKey, breaker);
    }

    breaker.failures++;
    breaker.lastFailureTime = new Date();

    // Open circuit breaker if threshold exceeded
    if (breaker.failures >= this.config.circuitBreakerThreshold) {
      breaker.isOpen = true;
      this.logger.warn(`Circuit breaker opened for ${breakerKey} after ${breaker.failures} failures`);
      this.emit('circuit_breaker_opened', { key: breakerKey, failures: breaker.failures });
    }
  }

  /**
   * Store error in history for analysis
   * Implements error history management with size limits
   */
  private storeError(claudeError: ClaudeError): void {
    this.errorHistory.set(claudeError.id, claudeError);

    // Maintain history size limit
    if (this.errorHistory.size > this.config.maxErrorHistory) {
      const oldestError = Array.from(this.errorHistory.keys())[0];
      this.errorHistory.delete(oldestError);
    }

    this.emit('error_stored', claudeError);
  }

  /**
   * Setup error handlers for Claude services
   * Implements centralized error handling integration
   */
  private setupErrorHandlers(): void {
    // Wrapper service error handling
    this.wrapperService?.on('error', (error: Error) => {
      this.handleError(error, { source: 'wrapper_service' }).catch(err => {
        this.logger.error('Failed to handle wrapper service error:', err);
      });
    });

    // Note: CommandService doesn't extend EventEmitter in current implementation
    // This would need to be implemented if command service error events are needed

    // Session service error handling
    this.sessionService?.on('session_error', ({ sessionId, error }: { sessionId: string; error: Error }) => {
      this.handleError(error, { source: 'session_service', sessionId }).catch(err => {
        this.logger.error('Failed to handle session service error:', err);
      });
    });
  }

  /**
   * Setup cleanup scheduler for error history and recovery contexts
   * Implements automatic resource cleanup
   */
  private setupCleanupScheduler(): void {
    setInterval(() => {
      this.performCleanup();
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Perform periodic cleanup of old data
   * Implements resource cleanup and maintenance
   */
  private performCleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Cleanup old recovery contexts
    for (const [errorId, context] of Array.from(this.recoveryContexts.entries())) {
      const age = now - context.startTime.getTime();
      if (age > maxAge && ['success', 'failed', 'abandoned'].includes(context.recoveryState)) {
        this.recoveryContexts.delete(errorId);
      }
    }

    // Cleanup old circuit breaker entries
    for (const [key, breaker] of Array.from(this.circuitBreakers.entries())) {
      const age = now - breaker.lastFailureTime.getTime();
      if (age > maxAge && !breaker.isOpen) {
        this.circuitBreakers.delete(key);
      }
    }

    this.logger.debug('Error service cleanup completed');
  }

  /**
   * Get error statistics and metrics
   * Implements comprehensive error analytics
   */
  getErrorStatistics(): ErrorStatistics {
    const errors = Array.from(this.errorHistory.values());
    const now = Date.now();
    const last24h = 24 * 60 * 60 * 1000;

    // Count errors by category
    const errorsByCategory = {} as Record<ClaudeErrorCategory, number>;
    Object.values(ClaudeErrorCategory).forEach(category => {
      errorsByCategory[category] = 0;
    });
    errors.forEach(error => errorsByCategory[error.category]++);

    // Count errors by severity
    const errorsBySeverity = {} as Record<ClaudeErrorSeverity, number>;
    Object.values(ClaudeErrorSeverity).forEach(severity => {
      errorsBySeverity[severity] = 0;
    });
    errors.forEach(error => errorsBySeverity[error.severity]++);

    // Count errors by strategy
    const errorsByStrategy = {} as Record<ClaudeRecoveryStrategy, number>;
    Object.values(ClaudeRecoveryStrategy).forEach(strategy => {
      errorsByStrategy[strategy] = 0;
    });
    errors.forEach(error => errorsByStrategy[error.recoveryStrategy]++);

    // Calculate recovery statistics
    const recoveryContexts = Array.from(this.recoveryContexts.values());
    const successfulRecoveries = recoveryContexts.filter(ctx => ctx.recoveryState === 'success').length;
    const failedRecoveries = recoveryContexts.filter(ctx => ctx.recoveryState === 'failed').length;
    const totalRecoveries = successfulRecoveries + failedRecoveries;
    const recoverySuccessRate = totalRecoveries > 0 ? successfulRecoveries / totalRecoveries : 0;

    // Calculate average recovery time
    const completedRecoveries = recoveryContexts.filter(ctx =>
      ['success', 'failed'].includes(ctx.recoveryState) && ctx.lastAttemptTime
    );
    const totalRecoveryTime = completedRecoveries.reduce((sum, ctx) => {
      return sum + (ctx.lastAttemptTime!.getTime() - ctx.startTime.getTime());
    }, 0);
    const averageRecoveryTime = completedRecoveries.length > 0
      ? totalRecoveryTime / completedRecoveries.length
      : 0;

    // Get recent errors
    const recentErrors = errors
      .filter(error => (now - error.timestamp.getTime()) < (60 * 60 * 1000)) // Last hour
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    // Get critical errors in last 24 hours
    const criticalErrorsLast24h = errors
      .filter(error =>
        error.severity === ClaudeErrorSeverity.CRITICAL &&
        (now - error.timestamp.getTime()) < last24h
      ).length;

    return {
      totalErrors: errors.length,
      errorsByCategory,
      errorsBySeverity,
      errorsByStrategy,
      averageRecoveryTime: averageRecoveryTime / 1000, // Convert to seconds
      successfulRecoveries,
      failedRecoveries,
      recoverySuccessRate,
      recentErrors,
      criticalErrorsLast24h,
    };
  }

  /**
   * Update error handling configuration
   * Implements runtime configuration management
   */
  updateConfig(newConfig: Partial<ErrorHandlingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.log('Error handling configuration updated');
    this.emit('config_updated', this.config);
  }

  /**
   * Get current error handling configuration
   * Provides configuration inspection
   */
  getConfig(): ErrorHandlingConfig {
    return { ...this.config };
  }

  /**
   * Get error by ID
   * Implements error history lookup
   */
  getError(errorId: string): ClaudeError | undefined {
    return this.errorHistory.get(errorId);
  }

  /**
   * Get recent errors
   * Implements error history filtering
   */
  getRecentErrors(limit: number = 50): ClaudeError[] {
    return Array.from(this.errorHistory.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Clear error history
   * Implements error history management
   */
  clearErrorHistory(): void {
    this.errorHistory.clear();
    this.logger.log('Error history cleared');
    this.emit('error_history_cleared');
  }

  /**
   * Generate unique error ID
   * Implements error identification
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Deep merge configuration objects
   * Implements proper configuration merging
   */
  private mergeConfig(baseConfig: ErrorHandlingConfig, customConfig: Partial<ErrorHandlingConfig>): ErrorHandlingConfig {
    return {
      ...baseConfig,
      ...customConfig,
      globalRetryConfig: customConfig.globalRetryConfig
        ? { ...baseConfig.globalRetryConfig, ...customConfig.globalRetryConfig }
        : baseConfig.globalRetryConfig,
      categorySpecificRetry: customConfig.categorySpecificRetry
        ? { ...baseConfig.categorySpecificRetry, ...customConfig.categorySpecificRetry }
        : baseConfig.categorySpecificRetry,
    };
  }

  /**
   * Sleep utility for retry delays
   * Implements asynchronous delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}