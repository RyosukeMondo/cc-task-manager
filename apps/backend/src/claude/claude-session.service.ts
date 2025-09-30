import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  ClaudeWrapperService,
  ClaudeWrapperOptions,
  ClaudeResponse
} from './claude-wrapper.service';
import {
  ClaudeCommandService,
  ClaudeCommandType,
  CommandExecutionContext
} from './claude-command.service';

/**
 * Interface for Claude session configuration
 * Following contract-driven design principles
 */
export interface ClaudeSessionConfig {
  sessionId?: string;
  maxIdleTime?: number; // milliseconds
  maxSessionTime?: number; // milliseconds
  maxConcurrentCommands?: number;
  autoCleanup?: boolean;
  workingDirectory?: string;
  permissionMode?: 'ask' | 'bypassPermissions';
  resumeLastSession?: boolean;
}

/**
 * Interface for Claude session metadata
 * Tracks session state and resource usage
 */
export interface ClaudeSessionMetadata {
  sessionId: string;
  userId?: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt?: Date;
  status: 'initializing' | 'active' | 'idle' | 'suspended' | 'terminated';
  commandCount: number;
  activeCommands: number;
  workingDirectory?: string;
  permissionMode: 'ask' | 'bypassPermissions';
  resourceUsage: {
    memoryUsage?: number;
    cpuTime?: number;
    diskSpace?: number;
  };
}

/**
 * Interface for session statistics
 * Provides insights into session performance
 */
export interface SessionStatistics {
  totalSessions: number;
  activeSessions: number;
  idleSessions: number;
  averageSessionDuration: number;
  totalCommands: number;
  averageCommandsPerSession: number;
  sessionsByStatus: Record<string, number>;
}

/**
 * Interface for session resource limits
 * Implements resource management constraints
 */
export interface SessionResourceLimits {
  maxMemoryUsage?: number; // bytes
  maxCpuTime?: number; // milliseconds
  maxDiskSpace?: number; // bytes
  maxCommands?: number;
  maxIdleTime?: number; // milliseconds
  maxSessionTime?: number; // milliseconds
}

/**
 * Claude Code session management and state tracking service
 *
 * Implements session lifecycle management for Claude Code instances following SOLID principles:
 *
 * - Single Responsibility: Manages Claude Code session lifecycle and state
 * - Open/Closed: Extensible for new session types and management strategies
 * - Liskov Substitution: Can be substituted with other session management implementations
 * - Interface Segregation: Focused interface for session operations
 * - Dependency Inversion: Depends on Claude wrapper and command service abstractions
 *
 * Applies KISS principle for simple session management workflow
 * Ensures DRY/SSOT compliance with centralized session state tracking
 * Implements fail-fast validation and comprehensive error handling
 * Provides proper resource cleanup and prevents memory leaks
 */
@Injectable()
export class ClaudeSessionService extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(ClaudeSessionService.name);
  private readonly sessions = new Map<string, ClaudeSessionMetadata>();
  private readonly sessionWrappers = new Map<string, ClaudeWrapperService>();
  private readonly sessionCommands = new Map<string, ClaudeCommandService>();
  private readonly cleanupIntervals = new Map<string, NodeJS.Timeout>();

  // Default configuration
  private readonly defaultConfig: Required<ClaudeSessionConfig> = {
    sessionId: '',
    maxIdleTime: 30 * 60 * 1000, // 30 minutes
    maxSessionTime: 24 * 60 * 60 * 1000, // 24 hours
    maxConcurrentCommands: 5,
    autoCleanup: true,
    workingDirectory: process.cwd(),
    permissionMode: 'ask',
    resumeLastSession: false,
  };

  // Resource limits
  private readonly resourceLimits: SessionResourceLimits = {
    maxMemoryUsage: 512 * 1024 * 1024, // 512 MB
    maxCpuTime: 60 * 60 * 1000, // 1 hour
    maxDiskSpace: 1024 * 1024 * 1024, // 1 GB
    maxCommands: 1000,
    maxIdleTime: 60 * 60 * 1000, // 1 hour
    maxSessionTime: 24 * 60 * 60 * 1000, // 24 hours
  };

  constructor() {
    super();
    this.setupCleanupScheduler();
  }

  /**
   * Create new Claude Code session
   * Implements session initialization with proper resource allocation
   */
  async createSession(
    config: ClaudeSessionConfig = {},
    userId?: string
  ): Promise<string> {
    // Fail-fast validation
    this.validateSessionConfig(config);

    const sessionConfig = { ...this.defaultConfig, ...config };
    const sessionId = sessionConfig.sessionId || this.generateSessionId();

    // Check if session already exists
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    // Check session limits
    this.enforceSessionLimits();

    this.logger.debug(`Creating Claude session: ${sessionId}`);

    try {
      // Initialize session metadata
      const metadata: ClaudeSessionMetadata = {
        sessionId,
        userId,
        createdAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: sessionConfig.maxSessionTime
          ? new Date(Date.now() + sessionConfig.maxSessionTime)
          : undefined,
        status: 'initializing',
        commandCount: 0,
        activeCommands: 0,
        workingDirectory: sessionConfig.workingDirectory,
        permissionMode: sessionConfig.permissionMode,
        resourceUsage: {},
      };

      this.sessions.set(sessionId, metadata);

      // Create dedicated wrapper service for session
      const wrapperService = new ClaudeWrapperService();
      const commandService = new ClaudeCommandService(wrapperService);

      // Initialize services
      await wrapperService.initialize();
      await commandService.initialize();

      // Store service instances
      this.sessionWrappers.set(sessionId, wrapperService);
      this.sessionCommands.set(sessionId, commandService);

      // Setup session event handlers
      this.setupSessionEventHandlers(sessionId, wrapperService, commandService);

      // Setup cleanup if auto-cleanup enabled
      if (sessionConfig.autoCleanup) {
        this.setupSessionCleanup(sessionId, sessionConfig);
      }

      // Update session status
      metadata.status = 'active';
      metadata.lastActivityAt = new Date();

      this.logger.log(`Claude session created successfully: ${sessionId}`);
      this.emit('session_created', { sessionId, userId, metadata });

      return sessionId;
    } catch (error) {
      // Cleanup on failure
      await this.cleanupSession(sessionId);

      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create session ${sessionId}: ${errorMessage}`, error);
      throw new Error(`Session creation failed: ${errorMessage}`);
    }
  }

  /**
   * Get session metadata by ID
   * Implements session state inspection
   */
  getSession(sessionId: string): ClaudeSessionMetadata | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   * Provides overview of session state
   */
  getActiveSessions(): ClaudeSessionMetadata[] {
    return Array.from(this.sessions.values())
      .filter(session => session.status === 'active');
  }

  /**
   * Get session statistics
   * Implements session analytics and monitoring
   */
  getSessionStatistics(): SessionStatistics {
    const allSessions = Array.from(this.sessions.values());
    const activeSessions = allSessions.filter(s => s.status === 'active');
    const idleSessions = allSessions.filter(s => s.status === 'idle');

    const totalCommands = allSessions.reduce((sum, s) => sum + s.commandCount, 0);
    const sessionDurations = allSessions
      .filter(s => s.status === 'terminated')
      .map(s => {
        const endTime = s.expiresAt || new Date();
        return endTime.getTime() - s.createdAt.getTime();
      });

    const averageSessionDuration = sessionDurations.length > 0
      ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
      : 0;

    const sessionsByStatus = allSessions.reduce((counts, session) => {
      counts[session.status] = (counts[session.status] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    return {
      totalSessions: allSessions.length,
      activeSessions: activeSessions.length,
      idleSessions: idleSessions.length,
      averageSessionDuration: averageSessionDuration / 1000, // Convert to seconds
      totalCommands,
      averageCommandsPerSession: allSessions.length > 0 ? totalCommands / allSessions.length : 0,
      sessionsByStatus,
    };
  }

  /**
   * Execute command in session context
   * Implements session-aware command execution
   */
  async executeCommandInSession(
    sessionId: string,
    commandType: ClaudeCommandType,
    prompt?: string,
    options?: ClaudeWrapperOptions
  ): Promise<string> {
    // Fail-fast validation
    const session = this.validateSessionExists(sessionId);
    this.validateSessionActive(session);

    const commandService = this.sessionCommands.get(sessionId);
    if (!commandService) {
      throw new Error(`No command service found for session ${sessionId}`);
    }

    // Check concurrent command limits
    if (session.activeCommands >= this.defaultConfig.maxConcurrentCommands) {
      throw new Error(`Session ${sessionId} has reached maximum concurrent commands limit`);
    }

    // Update session activity
    this.updateSessionActivity(sessionId);

    try {
      session.activeCommands++;
      session.commandCount++;

      // Execute command through session's command service
      const response = await commandService.executeCommand({
        type: commandType,
        prompt,
        options,
      });

      this.logger.debug(`Command executed in session ${sessionId}: ${commandType}`);
      this.emit('command_executed', { sessionId, commandType, success: response.success });

      return response.runId || '';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Command execution failed in session ${sessionId}: ${errorMessage}`, error);
      this.emit('command_failed', { sessionId, commandType, error: errorMessage });
      throw error;
    } finally {
      session.activeCommands--;
    }
  }

  /**
   * Suspend session
   * Implements graceful session suspension
   */
  async suspendSession(sessionId: string, reason?: string): Promise<void> {
    const session = this.validateSessionExists(sessionId);

    if (session.status === 'suspended') {
      this.logger.warn(`Session ${sessionId} is already suspended`);
      return;
    }

    this.logger.debug(`Suspending session ${sessionId}: ${reason || 'No reason provided'}`);

    try {
      // Cancel active commands
      const commandService = this.sessionCommands.get(sessionId);
      if (commandService) {
        const activeCommands = commandService.getActiveCommands();
        for (const [runId] of Array.from(activeCommands)) {
          await commandService.executeCommand({
            type: ClaudeCommandType.CANCEL,
            runId,
          });
        }
      }

      session.status = 'suspended';
      session.lastActivityAt = new Date();

      this.logger.log(`Session suspended: ${sessionId}`);
      this.emit('session_suspended', { sessionId, reason });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to suspend session ${sessionId}: ${errorMessage}`, error);
      throw new Error(`Session suspension failed: ${errorMessage}`);
    }
  }

  /**
   * Resume suspended session
   * Implements session reactivation
   */
  async resumeSession(sessionId: string): Promise<void> {
    const session = this.validateSessionExists(sessionId);

    if (session.status !== 'suspended') {
      throw new Error(`Session ${sessionId} is not suspended (status: ${session.status})`);
    }

    this.logger.debug(`Resuming session ${sessionId}`);

    try {
      session.status = 'active';
      session.lastActivityAt = new Date();

      this.logger.log(`Session resumed: ${sessionId}`);
      this.emit('session_resumed', { sessionId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to resume session ${sessionId}: ${errorMessage}`, error);
      throw new Error(`Session resume failed: ${errorMessage}`);
    }
  }

  /**
   * Terminate session and cleanup resources
   * Implements graceful session termination with resource cleanup
   */
  async terminateSession(sessionId: string, reason?: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      this.logger.warn(`Session ${sessionId} not found for termination`);
      return;
    }

    if (session.status === 'terminated') {
      this.logger.warn(`Session ${sessionId} is already terminated`);
      return;
    }

    this.logger.debug(`Terminating session ${sessionId}: ${reason || 'No reason provided'}`);

    try {
      session.status = 'terminated';
      session.lastActivityAt = new Date();

      await this.cleanupSession(sessionId);

      this.logger.log(`Session terminated: ${sessionId}`);
      this.emit('session_terminated', { sessionId, reason });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to terminate session ${sessionId}: ${errorMessage}`, error);
      throw new Error(`Session termination failed: ${errorMessage}`);
    }
  }

  /**
   * Cleanup session resources
   * Implements comprehensive resource cleanup
   */
  private async cleanupSession(sessionId: string): Promise<void> {
    this.logger.debug(`Cleaning up session resources: ${sessionId}`);

    try {
      // Clear cleanup timers
      const cleanupTimer = this.cleanupIntervals.get(sessionId);
      if (cleanupTimer) {
        clearInterval(cleanupTimer);
        this.cleanupIntervals.delete(sessionId);
      }

      // Shutdown command service
      const commandService = this.sessionCommands.get(sessionId);
      if (commandService) {
        // Cancel any active commands
        const activeCommands = commandService.getActiveCommands();
        for (const [runId] of Array.from(activeCommands)) {
          try {
            await commandService.executeCommand({
              type: ClaudeCommandType.CANCEL,
              runId,
            });
          } catch (error) {
            this.logger.warn(`Failed to cancel command ${runId} during cleanup:`, error);
          }
        }
        this.sessionCommands.delete(sessionId);
      }

      // Shutdown wrapper service
      const wrapperService = this.sessionWrappers.get(sessionId);
      if (wrapperService) {
        await wrapperService.shutdown();
        this.sessionWrappers.delete(sessionId);
      }

      // Remove session metadata
      this.sessions.delete(sessionId);

      this.logger.debug(`Session cleanup completed: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Session cleanup failed for ${sessionId}:`, error);
      // Continue cleanup even if some steps fail
    }
  }

  /**
   * Setup session event handlers
   * Implements event routing for session services
   */
  private setupSessionEventHandlers(
    sessionId: string,
    wrapperService: ClaudeWrapperService,
    commandService: ClaudeCommandService
  ): void {
    // Handle wrapper service events
    wrapperService.on('response', (response: ClaudeResponse) => {
      this.updateSessionActivity(sessionId);
      this.emit('session_response', { sessionId, response });
    });

    wrapperService.on('error', (error: Error) => {
      this.logger.error(`Wrapper error in session ${sessionId}:`, error);
      this.emit('session_error', { sessionId, error });
    });

    wrapperService.on('process_exit', (exitInfo: any) => {
      this.logger.warn(`Wrapper process exited for session ${sessionId}:`, exitInfo);
      this.terminateSession(sessionId, 'Wrapper process exited').catch(error => {
        this.logger.error(`Failed to terminate session after process exit:`, error);
      });
    });
  }

  /**
   * Setup session cleanup scheduler
   * Implements automatic cleanup for expired sessions
   */
  private setupCleanupScheduler(): void {
    const cleanupInterval = setInterval(() => {
      this.performScheduledCleanup();
    }, 60 * 1000); // Run every minute

    // Store cleanup interval for module destruction
    this.cleanupIntervals.set('global', cleanupInterval);
  }

  /**
   * Setup session-specific cleanup
   * Implements session timeout and idle detection
   */
  private setupSessionCleanup(sessionId: string, config: ClaudeSessionConfig): void {
    const checkInterval = Math.min(config.maxIdleTime || 30000, 30000); // Check at least every 30 seconds

    const cleanupTimer = setInterval(() => {
      const session = this.sessions.get(sessionId);
      if (!session) {
        clearInterval(cleanupTimer);
        this.cleanupIntervals.delete(sessionId);
        return;
      }

      const now = Date.now();
      const idleTime = now - session.lastActivityAt.getTime();
      const sessionTime = now - session.createdAt.getTime();

      // Check for idle timeout
      if (config.maxIdleTime && idleTime > config.maxIdleTime) {
        this.logger.debug(`Session ${sessionId} idle timeout (${idleTime}ms > ${config.maxIdleTime}ms)`);
        this.terminateSession(sessionId, 'Idle timeout').catch(error => {
          this.logger.error(`Failed to terminate idle session:`, error);
        });
        return;
      }

      // Check for session timeout
      if (config.maxSessionTime && sessionTime > config.maxSessionTime) {
        this.logger.debug(`Session ${sessionId} session timeout (${sessionTime}ms > ${config.maxSessionTime}ms)`);
        this.terminateSession(sessionId, 'Session timeout').catch(error => {
          this.logger.error(`Failed to terminate expired session:`, error);
        });
        return;
      }

      // Update session to idle if no recent activity
      if (session.status === 'active' && idleTime > 5 * 60 * 1000) { // 5 minutes
        session.status = 'idle';
        this.emit('session_idle', { sessionId });
      }
    }, checkInterval);

    this.cleanupIntervals.set(sessionId, cleanupTimer);
  }

  /**
   * Perform scheduled cleanup
   * Implements periodic cleanup of expired sessions
   */
  private performScheduledCleanup(): void {
    const now = Date.now();
    const sessionsToCleanup: string[] = [];

    for (const [sessionId, session] of Array.from(this.sessions.entries())) {
      // Check expiration
      if (session.expiresAt && now > session.expiresAt.getTime()) {
        sessionsToCleanup.push(sessionId);
        continue;
      }

      // Check resource limits
      if (this.isSessionOverResourceLimits(session)) {
        sessionsToCleanup.push(sessionId);
        continue;
      }
    }

    // Cleanup expired sessions
    for (const sessionId of sessionsToCleanup) {
      this.terminateSession(sessionId, 'Scheduled cleanup').catch(error => {
        this.logger.error(`Scheduled cleanup failed for session ${sessionId}:`, error);
      });
    }

    if (sessionsToCleanup.length > 0) {
      this.logger.debug(`Scheduled cleanup processed ${sessionsToCleanup.length} sessions`);
    }
  }

  /**
   * Update session activity timestamp
   * Implements activity tracking for session lifecycle
   */
  private updateSessionActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = new Date();

      // Reactivate idle sessions
      if (session.status === 'idle') {
        session.status = 'active';
        this.emit('session_reactivated', { sessionId });
      }
    }
  }

  /**
   * Validate session configuration
   * Implements fail-fast validation for session config
   */
  private validateSessionConfig(config: ClaudeSessionConfig): void {
    if (config.maxIdleTime !== undefined && config.maxIdleTime < 0) {
      throw new Error('maxIdleTime must be non-negative');
    }

    if (config.maxSessionTime !== undefined && config.maxSessionTime < 0) {
      throw new Error('maxSessionTime must be non-negative');
    }

    if (config.maxConcurrentCommands !== undefined && config.maxConcurrentCommands < 1) {
      throw new Error('maxConcurrentCommands must be at least 1');
    }

    if (config.permissionMode && !['ask', 'bypassPermissions'].includes(config.permissionMode)) {
      throw new Error('permissionMode must be "ask" or "bypassPermissions"');
    }

    if (config.sessionId && !/^[a-zA-Z0-9_-]+$/.test(config.sessionId)) {
      throw new Error('sessionId must contain only alphanumeric characters, underscores, and hyphens');
    }
  }

  /**
   * Validate session exists
   * Implements existence validation with error handling
   */
  private validateSessionExists(sessionId: string): ClaudeSessionMetadata {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  /**
   * Validate session is active
   * Implements state validation for operations
   */
  private validateSessionActive(session: ClaudeSessionMetadata): void {
    if (session.status !== 'active') {
      throw new Error(`Session ${session.sessionId} is not active (status: ${session.status})`);
    }
  }

  /**
   * Enforce session limits
   * Implements resource limit enforcement
   */
  private enforceSessionLimits(): void {
    const activeSessions = Array.from(this.sessions.values())
      .filter(s => s.status === 'active' || s.status === 'idle');

    // Enforce maximum session limit (prevent resource exhaustion)
    const maxSessions = 10; // Configurable limit
    if (activeSessions.length >= maxSessions) {
      throw new Error(`Maximum number of sessions reached (${maxSessions})`);
    }
  }

  /**
   * Check if session is over resource limits
   * Implements resource limit monitoring
   */
  private isSessionOverResourceLimits(session: ClaudeSessionMetadata): boolean {
    // Check command count limit
    if (this.resourceLimits.maxCommands && session.commandCount > this.resourceLimits.maxCommands) {
      return true;
    }

    // Check memory usage limit
    if (this.resourceLimits.maxMemoryUsage &&
        session.resourceUsage.memoryUsage &&
        session.resourceUsage.memoryUsage > this.resourceLimits.maxMemoryUsage) {
      return true;
    }

    // Check CPU time limit
    if (this.resourceLimits.maxCpuTime &&
        session.resourceUsage.cpuTime &&
        session.resourceUsage.cpuTime > this.resourceLimits.maxCpuTime) {
      return true;
    }

    return false;
  }

  /**
   * Generate unique session ID
   * Implements session ID generation
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${uuidv4().replace(/-/g, '').substring(0, 8)}`;
  }

  /**
   * Module lifecycle cleanup
   * Implements NestJS module cleanup pattern
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.debug('ClaudeSessionService module destroy called');

    // Clear all cleanup timers
    for (const [timerName, timer] of Array.from(this.cleanupIntervals.entries())) {
      clearInterval(timer);
    }
    this.cleanupIntervals.clear();

    // Terminate all active sessions
    const activeSessions = Array.from(this.sessions.keys());
    await Promise.allSettled(
      activeSessions.map(sessionId =>
        this.terminateSession(sessionId, 'Module shutdown')
      )
    );

    this.logger.log('ClaudeSessionService cleanup completed');
  }
}