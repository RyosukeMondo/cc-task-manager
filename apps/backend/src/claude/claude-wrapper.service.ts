import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { join } from 'path';

/**
 * Interface for Claude Code wrapper options
 * Following contract-driven design principles
 */
export interface ClaudeWrapperOptions {
  cwd?: string;
  working_directory?: string;
  session_id?: string;
  resume_last_session?: boolean;
  exit_on_complete?: boolean;
  permission_mode?: 'ask' | 'bypassPermissions';
  [key: string]: any;
}

/**
 * Interface for Claude Code command payload
 * Ensures type safety for STDIO protocol
 */
export interface ClaudeCommandPayload {
  action: 'prompt' | 'cancel' | 'status' | 'shutdown';
  prompt?: string;
  run_id?: string;
  options?: ClaudeWrapperOptions;
}

/**
 * Interface for Claude Code responses
 * Provides structured response handling
 */
export interface ClaudeResponse {
  event: string;
  timestamp: string;
  run_id?: string;
  state?: string;
  payload?: any;
  error?: string;
  [key: string]: any;
}

/**
 * Claude Code Python wrapper service
 *
 * Implements Node.js service to interface with Claude Code Python wrapper
 * using STDIO communication protocol following SOLID principles:
 *
 * - Single Responsibility: Manage Claude Code process communication
 * - Open/Closed: Extensible for new command types
 * - Liskov Substitution: Can be substituted with other wrapper implementations
 * - Interface Segregation: Focused interface for Claude Code operations
 * - Dependency Inversion: Depends on abstractions, not concrete implementations
 *
 * Applies KISS principle for simple process communication
 * Ensures DRY/SSOT compliance with centralized wrapper logic
 * Implements fail-fast validation and comprehensive error handling
 */
@Injectable()
export class ClaudeWrapperService extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(ClaudeWrapperService.name);
  private process: ChildProcess | null = null;
  private isReady = false;
  private isShuttingDown = false;
  private responseBuffer = '';
  private readonly wrapperPath: string;

  constructor() {
    super();
    // Path to the Python wrapper script
    this.wrapperPath = join(process.cwd(), 'scripts', 'claude_wrapper.py');
  }

  /**
   * Initialize Claude Code wrapper process
   * Implements process lifecycle management with proper error handling
   */
  async initialize(): Promise<void> {
    if (this.process) {
      this.logger.warn('Claude wrapper process already initialized');
      return;
    }

    try {
      this.logger.debug('Starting Claude Code wrapper process');

      // Spawn Python wrapper process with STDIO communication
      this.process = spawn('python3', [this.wrapperPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1', // Ensure unbuffered output
        },
      });

      this.setupProcessHandlers();
      await this.waitForReady();

      this.logger.log('Claude Code wrapper service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Claude wrapper process:', error);
      throw new Error(`Claude wrapper initialization failed: ${error.message}`);
    }
  }

  /**
   * Setup process event handlers
   * Implements comprehensive process management and error handling
   */
  private setupProcessHandlers(): void {
    if (!this.process) {
      throw new Error('Process not initialized');
    }

    // Handle stdout for JSON responses
    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleStdout(data.toString());
    });

    // Handle stderr for logging
    this.process.stderr?.on('data', (data: Buffer) => {
      const message = data.toString().trim();
      if (message) {
        this.logger.debug(`Claude wrapper stderr: ${message}`);
      }
    });

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      this.logger.warn(`Claude wrapper process exited with code ${code}, signal ${signal}`);
      this.isReady = false;
      this.process = null;
      this.emit('process_exit', { code, signal });
    });

    // Handle process errors
    this.process.on('error', (error) => {
      this.logger.error('Claude wrapper process error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Handle stdout data from Python wrapper
   * Implements JSON response parsing with error handling
   */
  private handleStdout(data: string): void {
    this.responseBuffer += data;

    // Process complete JSON lines
    const lines = this.responseBuffer.split('\n');
    this.responseBuffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      try {
        const response: ClaudeResponse = JSON.parse(trimmedLine);
        this.handleResponse(response);
      } catch (error) {
        this.logger.error('Failed to parse JSON response:', error, 'Raw line:', trimmedLine);
      }
    }
  }

  /**
   * Handle parsed JSON responses from wrapper
   * Implements response routing and state management
   */
  private handleResponse(response: ClaudeResponse): void {
    this.logger.debug('Received response:', response.event, response.run_id || '');

    // Handle ready event for initialization
    if (response.event === 'ready') {
      this.isReady = true;
      this.emit('ready');
      return;
    }

    // Handle shutdown event
    if (response.event === 'shutdown') {
      this.isReady = false;
      this.emit('shutdown');
      return;
    }

    // Emit all responses for external handling
    this.emit('response', response);

    // Emit specific event types
    this.emit(response.event, response);
  }

  /**
   * Wait for wrapper process to be ready
   * Implements timeout-based ready detection
   */
  private async waitForReady(timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isReady) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for Claude wrapper to be ready'));
      }, timeoutMs);

      this.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Send command to Claude Code wrapper
   * Implements fail-fast validation and STDIO protocol communication
   */
  async sendCommand(payload: ClaudeCommandPayload): Promise<void> {
    // Fail-fast validation
    if (!this.process || !this.isReady) {
      throw new Error('Claude wrapper not ready. Call initialize() first.');
    }

    if (this.isShuttingDown) {
      throw new Error('Claude wrapper is shutting down');
    }

    this.validateCommandPayload(payload);

    try {
      const jsonCommand = JSON.stringify(payload) + '\n';
      this.logger.debug('Sending command:', payload.action, payload.run_id || '');

      const success = this.process.stdin?.write(jsonCommand, 'utf8');
      if (!success) {
        throw new Error('Failed to write command to process stdin');
      }
    } catch (error) {
      this.logger.error('Failed to send command:', error);
      throw new Error(`Command send failed: ${error.message}`);
    }
  }

  /**
   * Validate command payload
   * Implements contract-driven validation
   */
  private validateCommandPayload(payload: ClaudeCommandPayload): void {
    if (!payload.action) {
      throw new Error('Command action is required');
    }

    const validActions = ['prompt', 'cancel', 'status', 'shutdown'];
    if (!validActions.includes(payload.action)) {
      throw new Error(`Invalid action: ${payload.action}. Must be one of: ${validActions.join(', ')}`);
    }

    if (payload.action === 'prompt' && !payload.prompt) {
      throw new Error('Prompt is required for prompt action');
    }

    if (payload.action === 'cancel' && !payload.run_id) {
      throw new Error('Run ID is required for cancel action');
    }
  }

  /**
   * Execute Claude Code prompt
   * Provides high-level interface for prompt execution
   */
  async executePrompt(
    prompt: string,
    options: ClaudeWrapperOptions = {},
    runId?: string
  ): Promise<string> {
    const commandPayload: ClaudeCommandPayload = {
      action: 'prompt',
      prompt,
      options,
      run_id: runId || this.generateRunId(),
    };

    await this.sendCommand(commandPayload);
    return commandPayload.run_id!;
  }

  /**
   * Cancel running Claude Code execution
   * Implements graceful cancellation
   */
  async cancelExecution(runId: string): Promise<void> {
    const commandPayload: ClaudeCommandPayload = {
      action: 'cancel',
      run_id: runId,
    };

    await this.sendCommand(commandPayload);
  }

  /**
   * Get Claude Code wrapper status
   * Implements status monitoring
   */
  async getStatus(): Promise<void> {
    const commandPayload: ClaudeCommandPayload = {
      action: 'status',
    };

    await this.sendCommand(commandPayload);
  }

  /**
   * Shutdown Claude Code wrapper
   * Implements graceful shutdown with resource cleanup
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown || !this.process) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.debug('Shutting down Claude wrapper process');

    try {
      // Send shutdown command
      const commandPayload: ClaudeCommandPayload = {
        action: 'shutdown',
      };

      await this.sendCommand(commandPayload);

      // Wait for graceful shutdown
      await this.waitForShutdown();
    } catch (error) {
      this.logger.warn('Graceful shutdown failed, forcing termination:', error);
      this.forceTerminate();
    }
  }

  /**
   * Wait for graceful shutdown
   * Implements timeout-based shutdown detection
   */
  private async waitForShutdown(timeoutMs = 5000): Promise<void> {
    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        this.logger.warn('Shutdown timeout, forcing termination');
        this.forceTerminate();
        resolve();
      }, timeoutMs);

      this.once('shutdown', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  /**
   * Force terminate the process
   * Implements forceful process termination
   */
  private forceTerminate(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      }, 2000);
    }
  }

  /**
   * Generate unique run ID
   * Implements simple UUID generation
   */
  private generateRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if wrapper is ready
   * Provides state inspection
   */
  isWrapperReady(): boolean {
    return this.isReady && !!this.process && !this.isShuttingDown;
  }

  /**
   * Module lifecycle cleanup
   * Implements NestJS module cleanup pattern
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.debug('ClaudeWrapperService module destroy called');
    await this.shutdown();
  }
}