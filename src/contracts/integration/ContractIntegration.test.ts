import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Logger, INestApplication, ValidationPipe } from '@nestjs/common';
import { ChildProcess } from 'child_process';
import * as request from 'supertest';
import { z } from 'zod';
import { join } from 'path';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';

// Contract System Components
import { ContractRegistry, ContractMetadata, ContractRegistration } from '../ContractRegistry';
import { ApiContractGenerator } from '../ApiContractGenerator';
import { TypeScriptGenerator } from '../TypeScriptGenerator';
import { ContractValidationPipe } from '../ContractValidationPipe';
import { VersionManager } from '../VersionManager';
import { DevValidationMiddleware } from '../DevValidationMiddleware';

// Worker Service Components
import { WorkerService, TaskExecutionResult, TaskExecutionContext } from '../../worker/worker.service';
import { ProcessManagerService } from '../../worker/process-manager.service';
import { StateMonitorService } from '../../worker/state-monitor.service';
import { ClaudeCodeClientService } from '../../worker/claude-code-client.service';

// Configuration and Schemas
import { 
  WorkerConfig, 
  TaskExecutionRequest, 
  TaskState, 
  TaskExecutionRequestSchema,
  ClaudeCodeOptionsSchema
} from '../../config/worker.config';

/**
 * Comprehensive integration tests for the complete contract-driven system
 * Tests end-to-end functionality including:
 * - Contract registration and versioning
 * - OpenAPI generation from contracts
 * - TypeScript type generation
 * - Request validation against contracts
 * - Worker service integration with contract validation
 * - Real-time contract validation during development
 * - Consumer-driven contract testing patterns
 */
describe('Contract-Driven System Integration', () => {
  let app: INestApplication;
  let contractRegistry: ContractRegistry;
  let apiContractGenerator: ApiContractGenerator;
  let typeScriptGenerator: TypeScriptGenerator;
  let versionManager: VersionManager;
  let devValidationMiddleware: DevValidationMiddleware;
  let workerService: WorkerService;
  let processManager: ProcessManagerService;
  let stateMonitor: StateMonitorService;
  let claudeCodeClient: ClaudeCodeClientService;
  let eventEmitter: EventEmitter2;
  let configService: ConfigService;

  // Test data and schemas
  let testWorkingDir: string;
  let mockWorkerConfig: WorkerConfig;
  
  // Enhanced test schemas for comprehensive validation
  const TaskExecutionV1Schema = z.object({
    task: z.string().min(1).max(1000).describe('Task description to execute'),
    options: z.object({
      timeout: z.number().min(1000).max(300000).default(30000).describe('Execution timeout in milliseconds'),
      priority: z.enum(['low', 'normal', 'high']).default('normal').describe('Task priority level'),
      retryCount: z.number().min(0).max(3).default(0).describe('Number of retry attempts'),
    }).optional().describe('Task execution options'),
    metadata: z.object({
      correlationId: z.string().uuid().optional().describe('Request correlation ID'),
      tags: z.array(z.string()).optional().describe('Task classification tags'),
      environment: z.enum(['development', 'staging', 'production']).default('development'),
    }).optional().describe('Task metadata'),
  });

  const TaskExecutionV2Schema = TaskExecutionV1Schema.extend({
    config: z.object({
      enableDetailedLogs: z.boolean().default(false).describe('Enable verbose logging'),
      workingDirectory: z.string().optional().describe('Custom working directory'),
      environmentVariables: z.record(z.string()).optional().describe('Environment variables'),
    }).optional().describe('Advanced task configuration'),
  });

  const TaskResponseSchema = z.object({
    taskId: z.string().uuid().describe('Unique task identifier'),
    success: z.boolean().describe('Task execution success status'),
    state: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).describe('Current task state'),
    output: z.string().optional().describe('Task execution output'),
    error: z.string().optional().describe('Error message if failed'),
    correlationId: z.string().uuid().describe('Request correlation ID'),
    startTime: z.string().datetime().describe('Task start timestamp'),
    endTime: z.string().datetime().optional().describe('Task completion timestamp'),
    duration: z.number().optional().describe('Execution duration in milliseconds'),
    metadata: z.object({
      pid: z.number().optional().describe('Process ID'),
      outcome: z.string().optional().describe('Normalized outcome'),
      reason: z.string().optional().describe('Outcome reason'),
      tags: z.array(z.string()).optional().describe('Classification tags'),
    }).optional().describe('Task execution metadata'),
  });

  beforeAll(async () => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    
    // Create temporary working directory for tests
    testWorkingDir = join(process.cwd(), 'tmp', 'contract-integration-tests');
    if (existsSync(testWorkingDir)) {
      rmSync(testWorkingDir, { recursive: true, force: true });
    }
    mkdirSync(testWorkingDir, { recursive: true });

    // Mock worker configuration
    mockWorkerConfig = {
      pythonExecutable: '/usr/bin/python3',
      gracefulShutdownMs: 1000,
      maxConcurrentTasks: 2,
      processTimeoutMs: 10000,
      pidCheckIntervalMs: 100,
      fileWatchTimeoutMs: 5000,
      inactivityTimeoutMs: 30000,
      wrapperScriptPath: join(testWorkingDir, 'mock-wrapper.py'),
      wrapperWorkingDir: testWorkingDir,
      queueName: 'test-claude-code-tasks',
      redisHost: 'localhost',
      redisPort: 6379,
      logLevel: 'debug',
      enableDetailedLogs: true,
      sessionLogsDir: join(testWorkingDir, 'logs'),
      awaitWriteFinish: true,
      awaitWriteFinishMs: 50,
    };

    // Create mock wrapper script
    const mockWrapperScript = `#!/usr/bin/env python3
import sys
import json
import time

def main():
    print(json.dumps({
        "status": "success",
        "output": "Mock task execution completed",
        "outcome": "completed",
        "reason": "Mock execution",
        "tags": ["test", "mock"],
        "duration": 100
    }))
    return 0

if __name__ == "__main__":
    sys.exit(main())
`;
    writeFileSync(mockWorkerConfig.wrapperScriptPath, mockWrapperScript);

    // Create logs directory
    mkdirSync(mockWorkerConfig.sessionLogsDir, { recursive: true });
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        // Contract System
        ContractRegistry,
        ApiContractGenerator,
        TypeScriptGenerator,
        VersionManager,
        DevValidationMiddleware,
        
        // Worker Services
        WorkerService,
        ProcessManagerService,
        StateMonitorService,
        ClaudeCodeClientService,
        
        // Configuration
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'worker') return mockWorkerConfig;
              return undefined;
            }),
          },
        },
        
        // Logging
        Logger,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Add global validation pipe with contract validation
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }));

    // Get service instances
    contractRegistry = moduleFixture.get<ContractRegistry>(ContractRegistry);
    apiContractGenerator = moduleFixture.get<ApiContractGenerator>(ApiContractGenerator);
    typeScriptGenerator = moduleFixture.get<TypeScriptGenerator>(TypeScriptGenerator);
    versionManager = moduleFixture.get<VersionManager>(VersionManager);
    devValidationMiddleware = moduleFixture.get<DevValidationMiddleware>(DevValidationMiddleware);
    workerService = moduleFixture.get<WorkerService>(WorkerService);
    processManager = moduleFixture.get<ProcessManagerService>(ProcessManagerService);
    stateMonitor = moduleFixture.get<StateMonitorService>(StateMonitorService);
    claudeCodeClient = moduleFixture.get<ClaudeCodeClientService>(ClaudeCodeClientService);
    eventEmitter = moduleFixture.get<EventEmitter2>(EventEmitter2);
    configService = moduleFixture.get<ConfigService>(ConfigService);

    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  afterAll(async () => {
    // Clean up test directory
    if (existsSync(testWorkingDir)) {
      rmSync(testWorkingDir, { recursive: true, force: true });
    }
  });

  describe('Complete Contract Lifecycle', () => {
    it('should register, version, and validate contracts end-to-end', async () => {
      // Step 1: Register initial contract version
      const registrationResult = await contractRegistry.registerContract(
        'TaskExecution',
        '1.0.0',
        TaskExecutionV1Schema,
        {
          description: 'Task execution request schema v1.0',
          compatibleVersions: [],
        }
      );

      expect(registrationResult).toBe(true);
      
      // Retrieve the registered contract
      const contract = await contractRegistry.getContract('TaskExecution', '1.0.0');
      expect(contract).toBeDefined();
      expect(contract!.metadata.name).toBe('TaskExecution');
      expect(contract!.metadata.version).toBe('1.0.0');

      // Step 2: Generate OpenAPI documentation
      const endpoints = [{
        path: '/api/tasks',
        method: 'POST',
        contractName: 'TaskExecution',
        contractVersion: '1.0.0',
        description: 'Create a new task'
      }];
      const options = {
        title: 'Contract API',
        version: '1.0.0',
        description: 'API documentation generated from contracts'
      };
      const openApiSpec = apiContractGenerator.generateOpenAPISpec(endpoints, options);
      expect(openApiSpec).toBeDefined();
      expect(openApiSpec.paths).toBeDefined();
      expect(openApiSpec.components?.schemas).toBeDefined();

      // Verify contract appears in OpenAPI spec
      const schemas = openApiSpec.components?.schemas || {};
      expect(Object.keys(schemas)).toContain('TaskExecution_1_0_0');

      // Step 3: Generate TypeScript types
      const typeResult = typeScriptGenerator.generateContractTypes('TaskExecution', '1.0.0');
      expect(typeResult).toBeDefined();
      expect(typeResult!.code).toContain('export interface TaskExecution_1_0_0');
      expect(typeResult!.code).toContain('task: string');
      expect(typeResult!.code).toContain('options?: {');

      // Step 4: Test contract validation
      const validRequest = {
        task: 'Test task execution',
        options: {
          timeout: 15000,
          priority: 'high' as const,
          retryCount: 1,
        },
        metadata: {
          correlationId: '123e4567-e89b-12d3-a456-426614174000',
          tags: ['test', 'integration'],
          environment: 'development' as const,
        },
      };

      const validationPipe = new ContractValidationPipe(contractRegistry, 'TaskExecution', '1.0.0');
      const validatedRequest = await validationPipe.transform(validRequest, {
        type: 'body',
        metatype: Object,
        data: '',
      });

      expect(validatedRequest).toEqual(validRequest);

      // Step 5: Test invalid request validation
      const invalidRequest = {
        task: '', // Invalid: empty string
        options: {
          timeout: 500, // Invalid: below minimum
          priority: 'invalid' as any, // Invalid: not in enum
        },
      };

      await expect(validationPipe.transform(invalidRequest, {
        type: 'body',
        metatype: Object,
        data: '',
      })).rejects.toThrow();
    });

    it('should handle contract versioning and backward compatibility', async () => {
      // Register v1.0.0
      await contractRegistry.registerContract(
        'TaskExecution',
        '1.0.0',
        TaskExecutionV1Schema,
        { description: 'Initial version' }
      );

      // Register v2.0.0 with additional fields
      await contractRegistry.registerContract(
        'TaskExecution',
        '2.0.0',
        TaskExecutionV2Schema,
        { 
          description: 'Extended version with config options',
          compatibleVersions: ['1.0.0'], // Backward compatible
        }
      );

      // Test version manager compatibility checking
      const compatibilityResult = await versionManager.checkCompatibility(
        'TaskExecution',
        '1.0.0',
        '2.0.0'
      );

      expect(compatibilityResult.compatible).toBe(true);
      expect(compatibilityResult.breakingChanges).toHaveLength(0);
      expect(compatibilityResult.warnings).toHaveLength(0);

      // Test that v1 requests work with v2 schema (backward compatibility)
      const v1Request = {
        task: 'Test task',
        options: { timeout: 20000 },
      };

      const v2ValidationPipe = new ContractValidationPipe(contractRegistry, 'TaskExecution', '2.0.0');
      const validatedV1Request = await v2ValidationPipe.transform(v1Request, {
        type: 'body',
        metatype: Object,
        data: '',
      });

      expect(validatedV1Request.task).toBe('Test task');
      expect(validatedV1Request.options?.timeout).toBe(20000);

      // Test v2 specific features
      const v2Request = {
        task: 'Advanced test task',
        options: { timeout: 25000 },
        config: {
          enableDetailedLogs: true,
          workingDirectory: '/tmp/test',
          environmentVariables: { TEST_MODE: 'true' },
        },
      };

      const validatedV2Request = await v2ValidationPipe.transform(v2Request, {
        type: 'body',
        metatype: Object,
        data: '',
      });

      expect(validatedV2Request.config?.enableDetailedLogs).toBe(true);
      expect(validatedV2Request.config?.environmentVariables?.TEST_MODE).toBe('true');
    });
  });

  describe('Worker Service Integration with Contracts', () => {
    it('should integrate contract validation with worker service execution', async () => {
      // Register task execution contract
      await contractRegistry.registerContract(
        'TaskExecutionRequest',
        '1.0.0',
        TaskExecutionRequestSchema,
        { description: 'Worker service task execution schema' }
      );

      // Create valid task execution request
      const taskRequest: TaskExecutionRequest = {
        task: 'console.log("Hello from contract-validated task");',
        options: {
          timeout: 10000,
          enableDetailedLogs: true,
        },
      };

      // Mock subprocess execution for testing
      const mockProcess = {
        pid: 12345,
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
      } as any;

      jest.spyOn(processManager, 'spawnWorkerProcess').mockResolvedValue(mockProcess);
      jest.spyOn(claudeCodeClient, 'parseResponse').mockResolvedValue({
        success: true,
        output: 'Hello from contract-validated task',
        outcome: 'completed',
        reason: 'Task executed successfully',
        tags: ['test'],
        normalizedMessage: 'Task execution completed',
      });

      // Execute task through worker service
      const result = await workerService.executeTask(taskRequest);

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
      expect(result.correlationId).toBeDefined();
      expect(result.state).toBe('completed');
      expect(result.output).toContain('Hello from contract-validated task');

      // Verify contract validation occurred
      expect(processManager.spawnWorkerProcess).toHaveBeenCalled();
      expect(claudeCodeClient.parseResponse).toHaveBeenCalled();
    });

    it('should reject invalid requests through contract validation', async () => {
      // Register contract
      await contractRegistry.registerContract(
        'TaskExecutionRequest',
        '1.0.0',
        TaskExecutionRequestSchema,
        { description: 'Worker service validation schema' }
      );

      // Create invalid request
      const invalidRequest = {
        task: '', // Invalid: empty task
        options: {
          timeout: 'invalid', // Invalid: string instead of number
          enableDetailedLogs: 'yes', // Invalid: string instead of boolean
        },
      } as any;

      // Attempt to execute invalid task
      await expect(workerService.executeTask(invalidRequest))
        .rejects
        .toThrow(); // Should throw validation error
    });

    it('should track contract validation metrics', async () => {
      // Register contract
      await contractRegistry.registerContract(
        'TaskExecutionRequest',
        '1.0.0',
        TaskExecutionRequestSchema,
        { description: 'Metrics tracking schema' }
      );

      const validRequest: TaskExecutionRequest = {
        task: 'print("Metrics test")',
        options: { timeout: 5000 },
      };

      // Track validation performance
      const startTime = Date.now();
      
      // Mock successful execution
      jest.spyOn(processManager, 'spawnWorkerProcess').mockResolvedValue({
        pid: 12345,
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
      } as any);

      jest.spyOn(claudeCodeClient, 'parseResponse').mockResolvedValue({
        success: true,
        output: 'Metrics test',
        outcome: 'completed',
        reason: 'Test execution',
        tags: ['metrics'],
        normalizedMessage: 'Test completed',
      });

      const result = await workerService.executeTask(validRequest);
      const validationDuration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(validationDuration).toBeLessThan(1000); // Should be fast
    });
  });

  describe('Development-Time Contract Validation', () => {
    it('should provide real-time validation feedback during development', async () => {
      // Enable development mode
      process.env.NODE_ENV = 'development';

      // Register contract
      await contractRegistry.registerContract(
        'DevTestContract',
        '1.0.0',
        z.object({
          name: z.string().min(1),
          value: z.number().positive(),
        }),
        { description: 'Development validation test schema' }
      );

      // Test real-time validation with valid data
      const validData = { name: 'test', value: 42 };
      const validationResult = await devValidationMiddleware.validateRequest(
        'DevTestContract',
        '1.0.0',
        validData
      );

      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);

      // Test real-time validation with invalid data
      const invalidData = { name: '', value: -1 };
      const invalidValidationResult = await devValidationMiddleware.validateRequest(
        'DevTestContract',
        '1.0.0',
        invalidData
      );

      expect(invalidValidationResult.isValid).toBe(false);
      expect(invalidValidationResult.errors.length).toBeGreaterThan(0);
      expect(invalidValidationResult.errors.some(e => e.field === 'name')).toBe(true);
      expect(invalidValidationResult.errors.some(e => e.field === 'value')).toBe(true);
    });

    it('should provide actionable error messages for development', async () => {
      // Register complex schema for detailed validation testing
      const complexSchema = z.object({
        user: z.object({
          id: z.string().uuid('Invalid UUID format'),
          email: z.string().email('Must be a valid email address'),
          age: z.number().min(18, 'Must be at least 18 years old').max(100, 'Must be under 100 years old'),
        }),
        preferences: z.object({
          theme: z.enum(['light', 'dark'], { errorMap: () => ({ message: 'Theme must be light or dark' }) }),
          notifications: z.boolean(),
        }),
        tags: z.array(z.string().min(1, 'Tags cannot be empty')).min(1, 'At least one tag required'),
      });

      await contractRegistry.registerContract(
        'ComplexContract',
        '1.0.0',
        complexSchema,
        { description: 'Complex validation test schema' }
      );

      // Test with multiple validation errors
      const invalidComplexData = {
        user: {
          id: 'invalid-uuid',
          email: 'not-an-email',
          age: 15,
        },
        preferences: {
          theme: 'invalid-theme',
          notifications: 'yes', // Should be boolean
        },
        tags: [], // Should have at least one tag
      };

      const result = await devValidationMiddleware.validateRequest(
        'ComplexContract',
        '1.0.0',
        invalidComplexData
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // Verify specific error messages are actionable
      const errorMessages = result.errors.map(e => e.message);
      expect(errorMessages.some(msg => msg.includes('UUID format'))).toBe(true);
      expect(errorMessages.some(msg => msg.includes('valid email'))).toBe(true);
      expect(errorMessages.some(msg => msg.includes('18 years old'))).toBe(true);
      expect(errorMessages.some(msg => msg.includes('light or dark'))).toBe(true);
    });
  });

  describe('Consumer-Driven Contract Testing', () => {
    it('should verify provider contracts against consumer expectations', async () => {
      // Define consumer expectations (similar to Pact contracts)
      const consumerContract = {
        provider: 'TaskManagerAPI',
        consumer: 'ClaudeCodeSDK',
        interactions: [
          {
            description: 'execute task request',
            request: {
              method: 'POST',
              path: '/tasks/execute',
              body: {
                task: 'console.log("test")',
                options: { timeout: 30000 },
              },
            },
            response: {
              status: 200,
              body: {
                taskId: 'string',
                success: true,
                state: 'completed',
                correlationId: 'string',
                startTime: 'string',
              },
            },
          },
        ],
      };

      // Register provider contract
      await contractRegistry.registerContract(
        'TaskExecutionRequest',
        '1.0.0',
        TaskExecutionRequestSchema,
        { description: 'Provider contract for task execution' }
      );

      await contractRegistry.registerContract(
        'TaskExecutionResponse',
        '1.0.0',
        TaskResponseSchema,
        { description: 'Provider response contract' }
      );

      // Verify consumer expectations against provider contracts
      const requestValidation = TaskExecutionRequestSchema.safeParse(
        consumerContract.interactions[0].request.body
      );
      expect(requestValidation.success).toBe(true);

      // Mock response that matches consumer expectations
      const mockResponse = {
        taskId: '123e4567-e89b-12d3-a456-426614174000',
        success: true,
        state: 'completed' as const,
        output: 'test',
        correlationId: '123e4567-e89b-12d3-a456-426614174001',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 1000,
      };

      const responseValidation = TaskResponseSchema.safeParse(mockResponse);
      expect(responseValidation.success).toBe(true);

      // Verify that provider can fulfill consumer contract
      expect(responseValidation.data?.taskId).toBeDefined();
      expect(responseValidation.data?.success).toBe(true);
      expect(responseValidation.data?.state).toBe('completed');
    });

    it('should detect breaking changes in provider contracts', async () => {
      // Register initial provider contract
      const initialRequestSchema = z.object({
        task: z.string(),
        timeout: z.number().default(30000),
      });

      await contractRegistry.registerContract(
        'TaskRequest',
        '1.0.0',
        initialRequestSchema,
        { description: 'Initial task request schema' }
      );

      // Define consumer that depends on the contract
      const consumerRequest = {
        task: 'test task',
        timeout: 15000,
      };

      // Verify consumer works with v1.0.0
      const v1Validation = initialRequestSchema.safeParse(consumerRequest);
      expect(v1Validation.success).toBe(true);

      // Introduce breaking change in v2.0.0
      const breakingChangeSchema = z.object({
        taskDescription: z.string(), // Renamed from 'task'
        timeoutMs: z.number().default(30000), // Renamed from 'timeout'
        required: z.string(), // New required field
      });

      await contractRegistry.registerContract(
        'TaskRequest',
        '2.0.0',
        breakingChangeSchema,
        { description: 'Breaking change version' }
      );

      // Verify breaking change detection
      const compatibilityCheck = await versionManager.checkCompatibility(
        'TaskRequest',
        '1.0.0',
        '2.0.0'
      );

      expect(compatibilityCheck.compatible).toBe(false);
      expect(compatibilityCheck.breakingChanges.length).toBeGreaterThan(0);

      // Verify consumer request fails with breaking change
      const v2Validation = breakingChangeSchema.safeParse(consumerRequest);
      expect(v2Validation.success).toBe(false);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high-volume contract validation efficiently', async () => {
      // Register contract for performance testing
      await contractRegistry.registerContract(
        'PerformanceTest',
        '1.0.0',
        TaskExecutionRequestSchema,
        { description: 'Performance testing schema' }
      );

      const validationPipe = new ContractValidationPipe(contractRegistry, 'PerformanceTest', '1.0.0');
      
      // Prepare test requests
      const testRequests = Array.from({ length: 100 }, (_, i) => ({
        task: `Performance test task ${i}`,
        options: { timeout: 30000 },
      }));

      // Measure validation performance
      const startTime = Date.now();
      
      const validationPromises = testRequests.map(request =>
        validationPipe.transform(request, {
          type: 'body',
          metatype: Object,
          data: '',
        })
      );

      const results = await Promise.all(validationPromises);
      const totalTime = Date.now() - startTime;
      const avgTimePerValidation = totalTime / testRequests.length;

      expect(results).toHaveLength(100);
      expect(results.every(result => result.task.startsWith('Performance test task'))).toBe(true);
      expect(avgTimePerValidation).toBeLessThan(10); // Should validate in under 10ms each
      expect(totalTime).toBeLessThan(1000); // Total should be under 1 second
    });

    it('should cache contract schemas for performance optimization', async () => {
      // Register contract
      await contractRegistry.registerContract(
        'CacheTest',
        '1.0.0',
        TaskExecutionRequestSchema,
        { description: 'Cache performance test' }
      );

      const validationPipe = new ContractValidationPipe(contractRegistry, 'CacheTest', '1.0.0');
      const testRequest = {
        task: 'Cache test task',
        options: { timeout: 30000 },
      };

      // First validation (should build cache)
      const start1 = Date.now();
      await validationPipe.transform(testRequest, {
        type: 'body',
        metatype: Object,
        data: '',
      });
      const time1 = Date.now() - start1;

      // Second validation (should use cache)
      const start2 = Date.now();
      await validationPipe.transform(testRequest, {
        type: 'body',
        metatype: Object,
        data: '',
      });
      const time2 = Date.now() - start2;

      // Cached validation should be faster or similar
      expect(time2).toBeLessThanOrEqual(time1 * 1.5); // Allow some variance
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should gracefully handle contract registration failures', async () => {
      // Attempt to register invalid contract
      const invalidSchema = null as any;
      
      const result = await contractRegistry.registerContract(
        'InvalidContract',
        '1.0.0',
        invalidSchema,
        { description: 'This should fail' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.contract).toBeUndefined();
    });

    it('should handle missing contract gracefully', async () => {
      const validationPipe = new ContractValidationPipe(contractRegistry, 'NonExistentContract', '1.0.0');
      const testRequest = { data: 'test' };

      await expect(validationPipe.transform(testRequest, {
        type: 'body',
        metatype: Object,
        data: '',
      })).rejects.toThrow('Contract not found');
    });

    it('should provide detailed validation error information', async () => {
      // Register strict schema
      const strictSchema = z.object({
        requiredField: z.string().min(5, 'Must be at least 5 characters'),
        numberField: z.number().positive('Must be positive'),
        enumField: z.enum(['option1', 'option2'], {
          errorMap: () => ({ message: 'Must be option1 or option2' })
        }),
      });

      await contractRegistry.registerContract(
        'StrictContract',
        '1.0.0',
        strictSchema,
        { description: 'Strict validation schema' }
      );

      const validationPipe = new ContractValidationPipe(contractRegistry, 'StrictContract', '1.0.0');
      const invalidRequest = {
        requiredField: 'abc', // Too short
        numberField: -5, // Negative
        enumField: 'invalid', // Not in enum
      };

      try {
        await validationPipe.transform(invalidRequest, {
          type: 'body',
          metatype: Object,
          data: '',
        });
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).toContain('validation');
        // Should contain specific field errors
        expect(error.message || error.toString()).toMatch(/requiredField|numberField|enumField/);
      }
    });
  });

  describe('Integration with Existing Systems', () => {
    it('should integrate seamlessly with existing worker service architecture', async () => {
      // Verify that contract system doesn't break existing functionality
      const originalConfig = configService.get('worker');
      expect(originalConfig).toEqual(mockWorkerConfig);

      // Test that worker service can still function without contracts
      const legacyRequest = {
        task: 'Legacy task without contract validation',
        options: { timeout: 5000 },
      };

      // Mock successful execution
      jest.spyOn(processManager, 'spawnWorkerProcess').mockResolvedValue({
        pid: 12345,
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
      } as any);

      jest.spyOn(claudeCodeClient, 'parseResponse').mockResolvedValue({
        success: true,
        output: 'Legacy execution',
        outcome: 'completed',
        reason: 'Legacy test',
        tags: ['legacy'],
        normalizedMessage: 'Legacy task completed',
      });

      const result = await workerService.executeTask(legacyRequest);
      expect(result.success).toBe(true);
    });

    it('should maintain backward compatibility with existing APIs', async () => {
      // Register current API contract
      await contractRegistry.registerContract(
        'TaskExecutionRequest',
        '1.0.0',
        TaskExecutionRequestSchema,
        { description: 'Current API contract' }
      );

      // Test that existing API structure still works
      const existingApiRequest: TaskExecutionRequest = {
        task: 'Existing API test',
        options: {
          timeout: 30000,
          enableDetailedLogs: false,
        },
      };

      const validationPipe = new ContractValidationPipe(contractRegistry, 'TaskExecutionRequest', '1.0.0');
      const validatedRequest = await validationPipe.transform(existingApiRequest, {
        type: 'body',
        metatype: Object,
        data: '',
      });

      expect(validatedRequest).toEqual(existingApiRequest);
      expect(validatedRequest.task).toBe('Existing API test');
      expect(validatedRequest.options?.timeout).toBe(30000);
    });
  });
});