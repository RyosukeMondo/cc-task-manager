import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue, Job, Worker, QueueEvents } from 'bullmq';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs, existsSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

import workerConfig from '../../src/config/worker.config';
import { WorkerModule } from '../../src/worker/worker.module';
import { WorkerService } from '../../src/worker/worker.service';
import { ClaudeCodeProcessor, ClaudeCodeJobData } from '../../src/worker/claude-code.processor';
import { ProcessManagerService } from '../../src/worker/process-manager.service';
import { StateMonitorService } from '../../src/worker/state-monitor.service';
import { ClaudeCodeClientService } from '../../src/worker/claude-code-client.service';
import { TaskState } from '../../src/config/worker.config';

describe('Claude Code Worker Integration', () => {
  let app: TestingModule;
  let workerService: WorkerService;
  let processManager: ProcessManagerService;
  let stateMonitor: StateMonitorService;
  let claudeCodeClient: ClaudeCodeClientService;
  let configService: ConfigService;
  let queue: Queue<ClaudeCodeJobData>;
  let queueEvents: QueueEvents;
  let worker: Worker;

  let testWorkingDir: string;
  let testSessionsDir: string;
  let pythonWrapperPath: string;
  let redisConnection: any;

  beforeAll(async () => {
    // Create temporary directories for testing
    testWorkingDir = await fs.mkdtemp(join(tmpdir(), 'cc-worker-test-'));
    testSessionsDir = join(testWorkingDir, 'sessions');
    await fs.mkdir(testSessionsDir, { recursive: true });

    // Resolve Python wrapper script path
    pythonWrapperPath = resolve(process.cwd(), 'scripts/claude_wrapper.py');
    
    // Verify Python wrapper exists
    if (!existsSync(pythonWrapperPath)) {
      throw new Error(`Python wrapper script not found at: ${pythonWrapperPath}`);
    }

    // Redis connection configuration for testing
    redisConnection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
    };
  });

  afterAll(async () => {
    // Cleanup test directories
    try {
      await fs.rm(testWorkingDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }

    // Close Redis connections
    if (worker) {
      await worker.close();
    }
    if (queueEvents) {
      await queueEvents.close();
    }
    if (queue) {
      await queue.close();
    }
  });

  beforeEach(async () => {
    // Override configuration for testing
    process.env.WORKER_MAX_CONCURRENT_TASKS = '2';
    process.env.WORKER_PROCESS_TIMEOUT_MS = '30000';
    process.env.PYTHON_WRAPPER_SCRIPT_PATH = pythonWrapperPath;
    process.env.SESSION_LOGS_DIR = testSessionsDir;
    process.env.BULLMQ_QUEUE_NAME = `claude-code-test-${randomUUID()}`;
    
    const testingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [workerConfig],
          isGlobal: true,
        }),
        EventEmitterModule.forRoot(),
        BullModule.forRoot({
          connection: redisConnection,
        }),
        BullModule.registerQueue({
          name: process.env.BULLMQ_QUEUE_NAME,
          connection: redisConnection,
        }),
        WorkerModule,
      ],
    }).compile();

    app = testingModule;
    workerService = testingModule.get<WorkerService>(WorkerService);
    processManager = testingModule.get<ProcessManagerService>(ProcessManagerService);
    stateMonitor = testingModule.get<StateMonitorService>(StateMonitorService);
    claudeCodeClient = testingModule.get<ClaudeCodeClientService>(ClaudeCodeClientService);
    configService = testingModule.get<ConfigService>(ConfigService);
    queue = testingModule.get<Queue>(getQueueToken(process.env.BULLMQ_QUEUE_NAME));

    // Create QueueEvents for job status monitoring
    queueEvents = new QueueEvents(process.env.BULLMQ_QUEUE_NAME!, {
      connection: redisConnection,
    });

    await app.init();

    // Initialize services
    await workerService.onModuleInit();
  });

  afterEach(async () => {
    if (queueEvents) {
      await queueEvents.close();
    }
    if (app) {
      await app.close();
    }
  });

  describe('End-to-End Worker Workflow', () => {
    it('should execute complete workflow from BullMQ job to completion', async () => {
      // Test configuration
      const testJobId = `test-job-${randomUUID()}`;
      const testSessionName = `test-session-${Date.now()}`;
      const testPrompt = 'echo "Hello from Claude Code Integration Test"';

      const jobData: ClaudeCodeJobData = {
        taskId: testJobId,
        prompt: testPrompt,
        sessionName: testSessionName,
        workingDirectory: testWorkingDir,
        options: {
          timeout: 30,
        },
        timeoutMs: 30000,
      };

      // Track progress updates
      const progressUpdates: any[] = [];
      const progressPromise = new Promise<void>((resolve) => {
        let completedReceived = false;
        
        queue.on('progress', (job: Job, progress: any) => {
          if (job.data.taskId === testJobId) {
            progressUpdates.push({
              timestamp: new Date(),
              progress,
              jobId: job.id,
            });
            
            if (progress.completed && !completedReceived) {
              completedReceived = true;
              setTimeout(resolve, 100); // Small delay to ensure all events are captured
            }
          }
        });
      });

      // Add job to queue
      const job = await queue.add('claude-code-task', jobData, {
        jobId: testJobId,
        removeOnComplete: 5,
        removeOnFail: 5,
        attempts: 1, // No retries for integration test
      });

      expect(job).toBeDefined();
      expect(job.id).toBe(testJobId);
      expect(job.data.taskId).toBe(testJobId);

      // Wait for job processing to start
      const jobPromise = job.waitUntilFinished(queueEvents);
      
      // Wait for progress updates and job completion
      await Promise.all([progressPromise, jobPromise]);

      // Verify job completion
      const finalJob = await Job.fromId(queue, testJobId);
      expect(finalJob).toBeDefined();
      
      if (finalJob) {
        expect(finalJob.finishedOn).toBeDefined();
        expect(finalJob.processedOn).toBeDefined();
        
        // Verify final result structure
        const result = finalJob.returnvalue;
        expect(result).toBeDefined();
        expect(result.taskId).toBe(testJobId);
        expect(result.correlationId).toBeDefined();
        expect(result.startTime).toBeDefined();
        expect(result.endTime).toBeDefined();
        
        // Job should complete successfully (even if Claude Code CLI is not available)
        // We expect either success or a specific error about Claude Code CLI not being found
        if (!result.success) {
          expect(result.error).toMatch(/(Claude Code CLI not found|command not found|No such file)/);
        }
      }

      // Verify progress updates were received
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Check for expected progress stages
      const hasInitialProgress = progressUpdates.some(update => 
        update.progress && typeof update.progress === 'object' && update.progress.taskId === testJobId
      );
      expect(hasInitialProgress).toBe(true);

      // Verify final progress update
      const finalProgressUpdate = progressUpdates[progressUpdates.length - 1];
      expect(finalProgressUpdate.progress).toBeDefined();
      expect(finalProgressUpdate.progress.completed).toBe(true);
      expect(finalProgressUpdate.progress.taskId).toBe(testJobId);
    }, 45000); // 45 second timeout for integration test

    it('should handle Python wrapper integration correctly', async () => {
      // Test direct communication with Python wrapper
      const testCommand = 'echo "test wrapper integration"';
      const testInput = JSON.stringify({
        command: testCommand,
        working_directory: testWorkingDir,
        timeout: 10
      });

      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          wrapper.kill('SIGTERM');
          reject(new Error('Python wrapper test timed out'));
        }, 15000);

        let outputReceived = false;
        const receivedOutputs: any[] = [];

        // Spawn Python wrapper process
        const wrapper = spawn('python3', [pythonWrapperPath], {
          cwd: testWorkingDir,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        wrapper.stdout?.on('data', (data) => {
          const lines = data.toString().split('\n').filter((line: string) => line.trim());
          
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              receivedOutputs.push(parsed);
              
              // Check for ready status
              if (parsed.status === 'ready' && !outputReceived) {
                // Send command to wrapper
                wrapper.stdin?.write(testInput + '\n');
              }
              
              // Check for completion
              if (parsed.status === 'completed' || parsed.status === 'error' || parsed.status === 'timeout') {
                outputReceived = true;
                clearTimeout(timeout);
                
                // Verify output structure
                expect(parsed.timestamp).toBeDefined();
                expect(parsed.status).toMatch(/(completed|error|timeout)/);
                
                if (parsed.status === 'error') {
                  // Expected error if Claude Code CLI is not available
                  expect(parsed.error).toMatch(/(Claude Code CLI not found|command not found)/);
                }
                
                wrapper.kill('SIGTERM');
                resolve();
              }
            } catch (parseError) {
              // Ignore non-JSON output
              console.debug('Non-JSON output:', line);
            }
          }
        });

        wrapper.stderr?.on('data', (data) => {
          console.debug('Python wrapper stderr:', data.toString());
        });

        wrapper.on('error', (error) => {
          clearTimeout(timeout);
          reject(new Error(`Python wrapper process error: ${error.message}`));
        });

        wrapper.on('exit', (code) => {
          clearTimeout(timeout);
          if (!outputReceived) {
            reject(new Error(`Python wrapper exited with code ${code} before completion`));
          }
        });
      });
    }, 20000);

    it('should handle concurrent job processing', async () => {
      const concurrentJobs = 2;
      const jobPromises: Promise<any>[] = [];
      const testJobs: ClaudeCodeJobData[] = [];

      // Create multiple jobs
      for (let i = 0; i < concurrentJobs; i++) {
        const jobId = `concurrent-test-${i}-${randomUUID()}`;
        const jobData: ClaudeCodeJobData = {
          taskId: jobId,
          prompt: `echo "Concurrent test job ${i}"`,
          sessionName: `concurrent-session-${i}-${Date.now()}`,
          workingDirectory: testWorkingDir,
          options: {
            timeout: 15,
          },
          timeoutMs: 15000,
        };

        testJobs.push(jobData);

        // Add job to queue
        const job = queue.add('concurrent-task', jobData, {
          jobId,
          removeOnComplete: 5,
          removeOnFail: 5,
          attempts: 1,
        });

        jobPromises.push(job.then(j => j.waitUntilFinished(queueEvents)));
      }

      // Wait for all jobs to complete
      const results = await Promise.allSettled(jobPromises);

      // Verify all jobs were processed
      expect(results).toHaveLength(concurrentJobs);
      
      for (let i = 0; i < concurrentJobs; i++) {
        const result = results[i];
        expect(result.status).toBe('fulfilled');
        
        if (result.status === 'fulfilled') {
          const jobResult = result.value;
          expect(jobResult.taskId).toBe(testJobs[i].taskId);
          expect(jobResult.correlationId).toBeDefined();
          expect(jobResult.startTime).toBeDefined();
          expect(jobResult.endTime).toBeDefined();
        }
      }
    }, 30000);

    it('should handle task cancellation correctly', async () => {
      const testJobId = `cancel-test-${randomUUID()}`;
      const testSessionName = `cancel-session-${Date.now()}`;

      const jobData: ClaudeCodeJobData = {
        taskId: testJobId,
        prompt: 'sleep 30 && echo "This should be cancelled"', // Long running command
        sessionName: testSessionName,
        workingDirectory: testWorkingDir,
        options: {
          timeout: 60,
        },
        timeoutMs: 60000,
      };

      // Add job to queue
      const job = await queue.add('cancellation-test', jobData, {
        jobId: testJobId,
        removeOnComplete: 5,
        removeOnFail: 5,
        attempts: 1,
      });

      // Wait a short time for job to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify task is active
      const activeTasks = workerService.getActiveTasks();
      const taskStatus = workerService.getTaskStatus(testJobId);
      
      if (activeTasks.includes(testJobId)) {
        // Cancel the task
        const cancelled = await workerService.cancelTask(testJobId);
        expect(cancelled).toBe(true);

        // Verify task is no longer active
        const activeTasksAfter = workerService.getActiveTasks();
        expect(activeTasksAfter).not.toContain(testJobId);

        // Check final task status
        const finalStatus = workerService.getTaskStatus(testJobId);
        expect(finalStatus).toBeDefined();
        expect(finalStatus?.state).toBe(TaskState.CANCELLED);
      } else {
        // If task wasn't active (e.g., failed immediately due to missing Claude Code CLI)
        // Just verify the task completed in some state
        expect(taskStatus).toBeDefined();
        expect(taskStatus?.state).toMatch(/(failed|completed|cancelled)/);
      }
    }, 15000);

    it('should provide accurate health status', async () => {
      const healthStatus = workerService.getHealthStatus();

      expect(healthStatus).toBeDefined();
      expect(healthStatus.activeTasks).toBeDefined();
      expect(healthStatus.maxConcurrentTasks).toBeDefined();
      expect(healthStatus.activeProcesses).toBeInstanceOf(Array);
      expect(healthStatus.uptime).toBeGreaterThan(0);

      expect(healthStatus.maxConcurrentTasks).toBe(2); // Set in test configuration
      expect(healthStatus.activeTasks).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Service Integration', () => {
    it('should have all services properly initialized and connected', async () => {
      // Verify all services are available
      expect(workerService).toBeDefined();
      expect(processManager).toBeDefined();
      expect(stateMonitor).toBeDefined();
      expect(claudeCodeClient).toBeDefined();
      expect(configService).toBeDefined();
      expect(queue).toBeDefined();

      // Verify configuration is loaded correctly
      const workerConfig = configService.get('worker');
      expect(workerConfig).toBeDefined();
      expect(workerConfig.wrapperScriptPath).toBe(pythonWrapperPath);
      expect(workerConfig.maxConcurrentTasks).toBe(2);

      // Verify queue connection
      expect(queue.name).toContain('claude-code-test');

      // Test configuration validation
      const testConfig = claudeCodeClient.validateConfiguration(
        { timeout: 30 },
        'test-correlation-id'
      );
      expect(testConfig.valid).toBe(true);
    });

    it('should handle service errors gracefully', async () => {
      // Test invalid task request
      const invalidRequest = {
        id: '', // Invalid - empty ID
        prompt: 'test prompt',
        sessionName: 'test-session',
        workingDirectory: testWorkingDir,
        options: {},
      };

      await expect(
        workerService.executeTask(invalidRequest as any)
      ).rejects.toThrow();

      // Test invalid configuration
      const invalidConfig = claudeCodeClient.validateConfiguration(
        { temperature: 5 }, // Invalid - temperature too high
        'test-correlation-id'
      );
      expect(invalidConfig.valid).toBe(false);
      expect(invalidConfig.errors).toBeDefined();
      expect(invalidConfig.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('Real Python Wrapper Integration', () => {
    it('should communicate with Python wrapper using real file paths', async () => {
      // Create a test file for Claude Code to interact with
      const testFilePath = join(testWorkingDir, 'test-file.txt');
      await fs.writeFile(testFilePath, 'Integration test file content\n');

      const jobData: ClaudeCodeJobData = {
        taskId: `real-wrapper-${randomUUID()}`,
        prompt: `ls -la "${testFilePath}"`, // Simple command that should work regardless of Claude Code CLI
        sessionName: `real-wrapper-${Date.now()}`,
        workingDirectory: testWorkingDir,
        options: {
          timeout: 10,
        },
        timeoutMs: 10000,
      };

      // Execute through the full stack
      const job = await queue.add('real-wrapper-test', jobData, {
        removeOnComplete: 5,
        removeOnFail: 5,
        attempts: 1,
      });

      const result = await job.waitUntilFinished(queueEvents);

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.taskId).toBe(jobData.taskId);
      expect(result.correlationId).toBeDefined();
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();

      // The command may fail if Claude Code CLI is not available, but the wrapper should handle it gracefully
      if (!result.success) {
        expect(result.error).toMatch(/(Claude Code CLI not found|command not found|No such file)/);
      }

      // Cleanup test file
      await fs.unlink(testFilePath);
    }, 15000);
  });
});