import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import { randomUUID } from 'crypto';
import { 
  ProcessConfig, 
  WorkerConfig, 
  validateProcessConfig 
} from '../config/worker.config';

@Injectable()
export class ProcessManagerService {
  private readonly logger = new Logger(ProcessManagerService.name);
  private readonly workerConfig: WorkerConfig;
  private readonly activeProcesses = new Map<number, ChildProcess>();
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
   * @param config Process configuration with validation
   * @returns Promise resolving to spawned ChildProcess
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
   * @param pid Process ID to terminate
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
   * Check if a process is still alive by PID
   * @param pid Process ID to check
   * @returns boolean indicating if process exists and is running
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
   * Get health status for a tracked process
   * @param pid Process ID to check
   * @returns Health status information
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
   * Get all active process PIDs
   * @returns Array of active process PIDs
   */
  getActiveProcesses(): number[] {
    return Array.from(this.activeProcesses.keys());
  }

  /**
   * Clean up orphaned processes (tracked processes that are no longer alive)
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
   * Set up comprehensive event handlers for process lifecycle
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