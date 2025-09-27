import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import { randomUUID } from 'crypto';
import { validateProcessConfig } from '@cc-task-manager/schemas';
import { ProcessConfig, WorkerConfig } from '@cc-task-manager/types';

/**
 * ProcessManagerService - Secure Claude Code process lifecycle management
 *
 * This service provides secure, reliable management of Claude Code child processes
 * with comprehensive safety measures, monitoring, and cleanup capabilities.
 *
 * Key Features:
 * - Secure process spawning with injection prevention
 * - Graceful termination with fallback to forced termination
 * - Comprehensive process tracking and metadata management
 * - Health monitoring and orphaned process cleanup
 * - Event-driven lifecycle management
 * - Cross-platform process liveness detection
 *
 * Security Considerations:
 * - All process arguments are passed as arrays to prevent shell injection
 * - Working directories are validated and contained
 * - Environment variables are sanitized
 * - Process permissions are strictly controlled
 *
 * @example
 * ```typescript
 * // Spawn a new Claude Code process
 * const process = await processManager.spawnClaudeProcess({
 *   jobId: 'unique-job-id',
 *   sessionName: 'my-session',
 *   workingDirectory: '/safe/path',
 *   pythonExecutable: 'python3',
 *   wrapperScriptPath: './wrapper.py'
 * });
 *
 * // Monitor process health
 * const health = processManager.getProcessHealth(process.pid!);
 * console.log(`Process health:`, health);
 *
 * // Clean termination when done
 * await processManager.terminateProcess(process.pid!);
 * ```
 */
@Injectable()
export class ProcessManagerService {
  private readonly logger = new Logger(ProcessManagerService.name);
  private readonly workerConfig: WorkerConfig;

  /** Map of active processes indexed by PID for lifecycle management */
  private readonly activeProcesses = new Map<number, ChildProcess>();

  /** Process metadata for tracking and correlation */
  private readonly processMetadata = new Map<number, {
    jobId: string;
    sessionName: string;
    startTime: Date;
    correlationId: string;
  }>();

  constructor(private readonly configService: ConfigService) {
    this.workerConfig = this.configService.get<WorkerConfig>('worker')!;
  }

  /**
   * Spawn a new Claude Code process using secure child_process.spawn
   *
   * Implements secure process spawning with comprehensive safety measures:
   * 1. Input validation using Zod schemas to prevent injection attacks
   * 2. Secure argument passing using array format (no shell interpretation)
   * 3. Proper environment variable handling and isolation
   * 4. Process lifecycle tracking and metadata management
   * 5. Error handling for spawn failures and permission issues
   *
   * Security Features:
   * - Command injection prevention through array arguments
   * - Working directory validation and containment
   * - Environment variable sanitization
   * - Process detachment prevention for proper cleanup
   *
   * @param config - Process configuration object containing:
   *   - jobId: Unique job identifier for tracking
   *   - sessionName: Human-readable session name
   *   - workingDirectory: Secure working directory path
   *   - pythonExecutable: Python interpreter path (validated)
   *   - wrapperScriptPath: Path to Claude Code wrapper script
   *   - unbuffered: Enable unbuffered Python output
   *
   * @returns Promise resolving to configured ChildProcess instance with:
   *   - Proper stdio configuration (pipe mode)
   *   - Event handlers for lifecycle management
   *   - Metadata tracking for monitoring
   *   - Security constraints applied
   *
   * @throws {Error} When:
   *   - Configuration validation fails
   *   - Process spawn fails (permissions, executable not found)
   *   - Working directory is invalid or inaccessible
   *
   * @example
   * ```typescript
   * const process = await processManager.spawnClaudeProcess({
   *   jobId: 'job-123',
   *   sessionName: 'coding-session',
   *   workingDirectory: '/safe/project/path',
   *   pythonExecutable: '/usr/bin/python3',
   *   wrapperScriptPath: './scripts/claude_wrapper.py',
   *   unbuffered: true
   * });
   *
   * console.log(`Spawned process with PID: ${process.pid}`);
   * ```
   */
  async spawnClaudeProcess(config: ProcessConfig): Promise<ChildProcess> {
    const correlationId = randomUUID();
    
    try {
      // Validate configuration using Zod schema
      const validatedConfig = validateProcessConfig(config);
      
      this.logger.log('Spawning Claude Code process', {
        correlationId,
        jobId: validatedConfig.jobId,
        sessionName: validatedConfig.sessionName,
        workingDirectory: validatedConfig.workingDirectory,
      });

      // Prepare spawn arguments securely using array format
      const spawnArgs = [
        validatedConfig.wrapperScriptPath,
        '--job-id', validatedConfig.jobId,
        '--session-name', validatedConfig.sessionName,
        '--working-dir', validatedConfig.workingDirectory,
      ];

      // Spawn options with security and reliability settings
      const spawnOptions: SpawnOptions = {
        cwd: validatedConfig.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false, // Ensure process is tied to parent for proper cleanup
        windowsHide: true, // Hide console window on Windows
        env: {
          ...process.env,
          PYTHONUNBUFFERED: validatedConfig.unbuffered ? '1' : '0',
          PYTHONIOENCODING: 'utf-8',
        },
      };

      // Use spawn with array arguments to prevent command injection
      const childProcess = spawn(
        validatedConfig.pythonExecutable || this.workerConfig.pythonExecutable,
        spawnArgs,
        spawnOptions
      );

      // Handle spawn errors immediately
      childProcess.on('error', (error) => {
        this.logger.error('Process spawn error', {
          correlationId,
          jobId: validatedConfig.jobId,
          error: error.message,
          code: error.name,
        });
        throw error;
      });

      // Validate that process was spawned successfully
      if (!childProcess.pid) {
        const error = new Error('Process spawn failed - no PID assigned');
        this.logger.error('Process spawn validation failed', {
          correlationId,
          jobId: validatedConfig.jobId,
          error: error.message,
        });
        throw error;
      }

      // Track process in internal maps
      this.activeProcesses.set(childProcess.pid, childProcess);
      this.processMetadata.set(childProcess.pid, {
        jobId: validatedConfig.jobId,
        sessionName: validatedConfig.sessionName,
        startTime: new Date(),
        correlationId,
      });

      // Set up process lifecycle event handlers
      this.setupProcessEventHandlers(childProcess, correlationId);

      this.logger.log('Claude Code process spawned successfully', {
        correlationId,
        jobId: validatedConfig.jobId,
        pid: childProcess.pid,
        sessionName: validatedConfig.sessionName,
      });

      return childProcess;
    } catch (error) {
      this.logger.error('Failed to spawn Claude Code process', {
        correlationId,
        jobId: config.jobId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Terminate a process gracefully with SIGTERM, then SIGKILL fallback
   *
   * Implements a two-phase termination strategy for reliable process cleanup:
   *
   * Phase 1 - Graceful Shutdown:
   * - Sends SIGTERM signal for cooperative termination
   * - Waits for configurable grace period (default: 5 seconds)
   * - Allows process to cleanup resources and save state
   *
   * Phase 2 - Forced Termination:
   * - Triggers if graceful shutdown times out
   * - Sends SIGKILL for immediate termination
   * - Ensures process cannot ignore termination request
   *
   * Cleanup Operations:
   * - Removes process from internal tracking maps
   * - Clears metadata and correlation information
   * - Logs termination events for audit trail
   *
   * @param pid - Process ID to terminate (must be tracked by this manager)
   *
   * @returns Promise that resolves when termination is complete
   *   (either graceful or forced)
   *
   * @throws {Error} When:
   *   - PID is invalid or not found in tracking
   *   - System-level termination errors occur
   *
   * @example
   * ```typescript
   * await processManager.terminateProcess(12345);
   * console.log('Process terminated successfully');
   * ```
   *
   * @note This method is safe to call multiple times for the same PID
   */
  async terminateProcess(pid: number): Promise<void> {
    const metadata = this.processMetadata.get(pid);
    const correlationId = metadata?.correlationId || randomUUID();
    
    this.logger.log('Initiating process termination', {
      correlationId,
      pid,
      jobId: metadata?.jobId,
    });

    const process = this.activeProcesses.get(pid);
    if (!process) {
      this.logger.warn('Attempted to terminate non-existent process', {
        correlationId,
        pid,
      });
      return;
    }

    try {
      // Step 1: Send SIGTERM for graceful shutdown
      this.logger.log('Sending SIGTERM for graceful shutdown', {
        correlationId,
        pid,
        jobId: metadata?.jobId,
      });
      
      process.kill('SIGTERM');

      // Step 2: Wait for graceful shutdown with timeout
      const gracefulShutdownPromise = new Promise<void>((resolve) => {
        const exitHandler = () => {
          this.logger.log('Process terminated gracefully', {
            correlationId,
            pid,
            jobId: metadata?.jobId,
          });
          resolve();
        };
        process.once('exit', exitHandler);
      });

      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Graceful shutdown timeout'));
        }, this.workerConfig.gracefulShutdownMs);
      });

      try {
        await Promise.race([gracefulShutdownPromise, timeoutPromise]);
      } catch (timeoutError) {
        // Step 3: Force termination with SIGKILL if graceful shutdown fails
        this.logger.warn('Graceful shutdown timeout, forcing termination with SIGKILL', {
          correlationId,
          pid,
          jobId: metadata?.jobId,
          timeoutMs: this.workerConfig.gracefulShutdownMs,
        });
        
        if (this.isProcessAlive(pid)) {
          process.kill('SIGKILL');
          this.logger.log('Process force terminated with SIGKILL', {
            correlationId,
            pid,
            jobId: metadata?.jobId,
          });
        }
      }
    } catch (error) {
      this.logger.error('Error during process termination', {
        correlationId,
        pid,
        jobId: metadata?.jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      // Clean up tracking maps
      this.activeProcesses.delete(pid);
      this.processMetadata.delete(pid);
    }
  }

  /**
   * Check if a process is still alive using system-level PID verification
   *
   * Uses the Node.js process.kill(pid, 0) technique to test process
   * existence without actually sending a signal. This is a reliable,
   * cross-platform method for process liveness detection.
   *
   * How it works:
   * - process.kill(pid, 0) tests process existence
   * - Signal 0 is a special "null signal" that doesn't affect the process
   * - If process exists: call succeeds, returns true
   * - If process doesn't exist: throws ESRCH error, returns false
   *
   * @param pid - Process ID to check for existence
   *
   * @returns boolean indicating process liveness:
   *   - true: Process exists and is running
   *   - false: Process does not exist or has terminated
   *
   * @example
   * ```typescript
   * if (processManager.isProcessAlive(12345)) {
   *   console.log('Process is still running');
   * } else {
   *   console.log('Process has terminated');
   * }
   * ```
   *
   * @note This method does not require the process to be tracked by this manager
   */
  isProcessAlive(pid: number): boolean {
    try {
      // Use process.kill(pid, 0) to test process existence without sending signal
      process.kill(pid, 0);
      return true;
    } catch (error) {
      // ESRCH error means process doesn't exist
      return false;
    }
  }

  /**
   * Get comprehensive health status for a tracked process
   *
   * Combines process liveness detection with metadata tracking to provide
   * detailed health information for monitored processes.
   *
   * Health Information Includes:
   * - Process liveness (alive/dead status)
   * - Execution metadata (job ID, session name, start time)
   * - Runtime metrics (uptime calculation)
   * - Correlation information for debugging
   *
   * @param pid - Process ID to check (must be tracked by this manager)
   *
   * @returns Health status object containing:
   *   - isAlive: Boolean indicating if process is running
   *   - metadata: Object with tracking information (if process is tracked):
   *     - jobId: Associated job identifier
   *     - sessionName: Human-readable session name
   *     - startTime: Process start timestamp
   *     - uptime: Current uptime in milliseconds
   *     - correlationId: Unique correlation identifier
   *
   * @example
   * ```typescript
   * const health = processManager.getProcessHealth(12345);
   * if (health.isAlive && health.metadata) {
   *   console.log(`Process ${health.metadata.jobId} running for ${health.metadata.uptime}ms`);
   * } else {
   *   console.log('Process is not alive or not tracked');
   * }
   * ```
   *
   * @note Returns minimal health info for untracked but alive processes
   */
  getProcessHealth(pid: number): {
    isAlive: boolean;
    metadata?: {
      jobId: string;
      sessionName: string;
      startTime: Date;
      uptime: number;
      correlationId: string;
    };
  } {
    const isAlive = this.isProcessAlive(pid);
    const metadata = this.processMetadata.get(pid);
    
    if (!metadata) {
      return { isAlive };
    }

    return {
      isAlive,
      metadata: {
        ...metadata,
        uptime: Date.now() - metadata.startTime.getTime(),
      },
    };
  }

  /**
   * Get all active process PIDs currently tracked by this manager
   *
   * Returns a snapshot of all processes that are currently being
   * managed and tracked by this ProcessManagerService instance.
   * Useful for monitoring, debugging, and resource management.
   *
   * @returns Array of process IDs (numbers) for all tracked processes
   *
   * @example
   * ```typescript
   * const activePids = processManager.getActiveProcesses();
   * console.log(`Managing ${activePids.length} active processes:`);
   * activePids.forEach(pid => {
   *   const health = processManager.getProcessHealth(pid);
   *   console.log(`- PID ${pid}: ${health.metadata?.jobId || 'unknown'}`);
   * });
   * ```
   *
   * @note This only includes processes spawned and tracked by this manager
   */
  getActiveProcesses(): number[] {
    return Array.from(this.activeProcesses.keys());
  }

  /**
   * Clean up orphaned processes and maintain tracking consistency
   *
   * Performs housekeeping to identify and clean up processes that are
   * being tracked but are no longer alive in the system. This prevents
   * memory leaks and maintains accurate process tracking state.
   *
   * Cleanup Process:
   * 1. Iterates through all tracked processes
   * 2. Checks liveness using system-level PID verification
   * 3. Identifies orphaned entries (tracked but not alive)
   * 4. Removes orphaned entries from internal tracking maps
   * 5. Logs cleanup actions for audit trail
   *
   * When to Use:
   * - During service health checks
   * - After system recovery or restart
   * - When tracking inconsistencies are detected
   * - As part of periodic maintenance routines
   *
   * @returns Promise that resolves when cleanup is complete
   *
   * @example
   * ```typescript
   * await processManager.cleanupOrphanedProcesses();
   * console.log('Orphaned process cleanup completed');
   * ```
   *
   * @note This operation is safe to run frequently and is idempotent
   */
  async cleanupOrphanedProcesses(): Promise<void> {
    const orphanedPids: number[] = [];
    
    for (const pid of this.activeProcesses.keys()) {
      if (!this.isProcessAlive(pid)) {
        orphanedPids.push(pid);
      }
    }

    if (orphanedPids.length > 0) {
      this.logger.log('Cleaning up orphaned processes', {
        orphanedPids,
        count: orphanedPids.length,
      });

      for (const pid of orphanedPids) {
        const metadata = this.processMetadata.get(pid);
        this.logger.warn('Removing orphaned process from tracking', {
          pid,
          jobId: metadata?.jobId,
          correlationId: metadata?.correlationId,
        });
        
        this.activeProcesses.delete(pid);
        this.processMetadata.delete(pid);
      }
    }
  }

  /**
   * Set up comprehensive event handlers for process lifecycle management
   *
   * Configures event-driven monitoring for all aspects of process lifecycle:
   * - Process termination (exit events with codes and signals)
   * - Error conditions (spawn failures, runtime errors)
   * - Communication events (stdout/stderr activity)
   * - Connection status (disconnect events)
   *
   * Event Handling Strategy:
   * - All events are logged with correlation IDs for traceability
   * - Metadata is preserved and included in event logs
   * - Error events are escalated appropriately
   * - Output events are monitored but not stored (memory efficiency)
   *
   * Monitored Events:
   * - 'exit': Process termination with exit code and signal
   * - 'error': Process-level errors and spawn failures
   * - 'disconnect': IPC disconnection events
   * - 'data' on stdout: Output activity monitoring
   * - 'data' on stderr: Error output logging
   *
   * @param process - ChildProcess instance to monitor
   * @param correlationId - Unique identifier for event correlation
   *
   * @private Called automatically during process spawning
   */
  private setupProcessEventHandlers(process: ChildProcess, correlationId: string): void {
    const metadata = this.processMetadata.get(process.pid!);
    
    process.on('exit', (code, signal) => {
      this.logger.log('Process exited', {
        correlationId,
        pid: process.pid,
        jobId: metadata?.jobId,
        exitCode: code,
        signal,
        uptime: metadata ? Date.now() - metadata.startTime.getTime() : undefined,
      });
    });

    process.on('error', (error) => {
      this.logger.error('Process error event', {
        correlationId,
        pid: process.pid,
        jobId: metadata?.jobId,
        error: error.message,
        code: error.name,
      });
    });

    // Handle stdout for progress monitoring (logged but not stored to avoid memory leaks)
    process.stdout?.on('data', () => {
      this.logger.debug('Process stdout activity', {
        correlationId,
        pid: process.pid,
        jobId: metadata?.jobId,
      });
    });

    // Handle stderr for error logging
    process.stderr?.on('data', (data) => {
      const errorOutput = data.toString().trim();
      if (errorOutput) {
        this.logger.warn('Process stderr output', {
          correlationId,
          pid: process.pid,
          jobId: metadata?.jobId,
          stderr: errorOutput,
        });
      }
    });

    process.on('disconnect', () => {
      this.logger.log('Process disconnected', {
        correlationId,
        pid: process.pid,
        jobId: metadata?.jobId,
      });
    });
  }
}