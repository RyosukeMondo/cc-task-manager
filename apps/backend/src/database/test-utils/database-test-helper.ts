import { PrismaClient, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Database Test Helper Utilities
 *
 * Purpose: Support comprehensive testing of database operations with isolation
 * Follows SOLID principles:
 * - SRP: Focused test utilities for database operations
 * - ISP: Segregated interfaces for different test scenarios
 * - DIP: Abstract test contracts for dependency injection
 *
 * Implements KISS principle with simple, reusable test helpers
 * Ensures DRY/SSOT compliance with centralized test utilities
 * Provides fail-fast validation for test data integrity
 */

/**
 * Test Database Transaction Manager
 * Handles transaction isolation for database tests
 */
export class TestTransactionManager {
  private prisma: PrismaClient;
  private activeTransactions = new Map<string, any>();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create isolated transaction for test
   * Each test gets its own transaction that can be rolled back
   */
  async createIsolatedTransaction(): Promise<{
    id: string;
    prisma: Prisma.TransactionClient;
    rollback: () => Promise<void>;
  }> {
    const transactionId = uuidv4();

    return new Promise((resolve, reject) => {
      this.prisma.$transaction(async (prisma) => {
        // Store transaction reference
        this.activeTransactions.set(transactionId, prisma);

        // Create rollback function
        const rollback = async () => {
          this.activeTransactions.delete(transactionId);
          throw new Error('ROLLBACK_TEST_TRANSACTION'); // Forces transaction rollback
        };

        // Return transaction context
        resolve({
          id: transactionId,
          prisma: prisma as Prisma.TransactionClient,
          rollback,
        });

        // Wait indefinitely until rollback is called
        return new Promise(() => {});
      }).catch((error) => {
        if (error.message === 'ROLLBACK_TEST_TRANSACTION') {
          // Expected rollback, not an actual error
          return;
        }
        reject(error);
      });
    });
  }

  /**
   * Clean up all active transactions
   */
  async cleanup(): Promise<void> {
    this.activeTransactions.clear();
  }
}

/**
 * Test Data Factory Interface
 * Defines contract for creating test data
 */
export interface ITestDataFactory<T> {
  create(overrides?: Partial<T>): T;
  createMany(count: number, overrides?: Partial<T>): T[];
  createMinimal(): T;
}

/**
 * User Test Data Factory
 * Creates test user data with proper defaults
 */
export class UserTestDataFactory implements ITestDataFactory<any> {
  create(overrides?: any): any {
    const baseUser = {
      id: uuidv4(),
      email: `test-user-${Date.now()}@example.com`,
      name: 'Test User',
      role: 'user' as const,
      hashedPassword: '$2b$10$test.hash.for.testing.purposes.only',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { ...baseUser, ...overrides };
  }

  createMany(count: number, overrides?: any): any[] {
    return Array.from({ length: count }, (_, index) =>
      this.create({
        email: `test-user-${Date.now()}-${index}@example.com`,
        name: `Test User ${index + 1}`,
        ...overrides
      })
    );
  }

  createMinimal(): any {
    return {
      id: uuidv4(),
      email: `minimal-user-${Date.now()}@example.com`,
      name: 'Minimal User',
      hashedPassword: '$2b$10$test.hash',
    };
  }
}

/**
 * Project Test Data Factory
 */
export class ProjectTestDataFactory implements ITestDataFactory<any> {
  create(overrides?: any): any {
    const baseProject = {
      id: uuidv4(),
      name: `Test Project ${Date.now()}`,
      description: 'Test project description',
      status: 'active' as const,
      ownerId: overrides?.ownerId || uuidv4(),
      settings: JSON.stringify({ testMode: true }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { ...baseProject, ...overrides };
  }

  createMany(count: number, overrides?: any): any[] {
    return Array.from({ length: count }, (_, index) =>
      this.create({
        name: `Test Project ${Date.now()}-${index}`,
        ...overrides
      })
    );
  }

  createMinimal(): any {
    return {
      id: uuidv4(),
      name: `Minimal Project ${Date.now()}`,
      ownerId: uuidv4(),
    };
  }
}

/**
 * Claude Task Test Data Factory
 */
export class ClaudeTaskTestDataFactory implements ITestDataFactory<any> {
  create(overrides?: any): any {
    const baseTask = {
      id: uuidv4(),
      title: `Test Claude Task ${Date.now()}`,
      description: 'Test task description',
      status: 'PENDING' as const,
      priority: 'MEDIUM' as const,
      createdById: overrides?.createdById || overrides?.userId || uuidv4(),
      projectId: overrides?.projectId || null,
      prompt: 'Test prompt for Claude task',
      config: { testMode: true },
      estimatedDuration: 1800, // 30 minutes
      tags: ['test', 'claude'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { ...baseTask, ...overrides };
  }

  createMany(count: number, overrides?: any): any[] {
    return Array.from({ length: count }, (_, index) =>
      this.create({
        title: `Test Claude Task ${Date.now()}-${index}`,
        ...overrides
      })
    );
  }

  createMinimal(): any {
    return {
      id: uuidv4(),
      title: `Minimal Claude Task ${Date.now()}`,
      prompt: 'Minimal test prompt',
      createdById: uuidv4(),
    };
  }
}

/**
 * Task Execution Test Data Factory
 */
export class TaskExecutionTestDataFactory implements ITestDataFactory<any> {
  create(overrides?: any): any {
    const baseExecution = {
      id: uuidv4(),
      taskId: overrides?.taskId || overrides?.claudeTaskId || uuidv4(),
      status: 'RUNNING' as const,
      startedAt: new Date(),
      progress: 0,
      createdAt: new Date(),
    };

    return { ...baseExecution, ...overrides };
  }

  createMany(count: number, overrides?: any): any[] {
    return Array.from({ length: count }, (_, index) =>
      this.create({
        progress: Math.min(index * 0.25, 1.0),
        ...overrides
      })
    );
  }

  createMinimal(): any {
    return {
      id: uuidv4(),
      taskId: uuidv4(),
      status: 'INITIALIZING' as const,
    };
  }
}

/**
 * Queue Job Test Data Factory
 */
export class QueueJobTestDataFactory implements ITestDataFactory<any> {
  create(overrides?: any): any {
    const baseJob = {
      id: uuidv4(),
      queueName: 'claude-tasks',
      jobId: `job-${uuidv4()}`,
      status: 'WAITING' as const,
      priority: 0,
      jobData: { testJob: true },
      taskId: overrides?.taskId || overrides?.claudeTaskId || uuidv4(),
      maxAttempts: 3,
      backoffType: 'EXPONENTIAL' as const,
      backoffDelay: 2000,
      createdAt: new Date(),
    };

    return { ...baseJob, ...overrides };
  }

  createMany(count: number, overrides?: any): any[] {
    return Array.from({ length: count }, (_, index) =>
      this.create({
        priority: index,
        jobData: { testJob: true, index },
        ...overrides
      })
    );
  }

  createMinimal(): any {
    return {
      id: uuidv4(),
      queueName: 'claude-tasks',
      jobId: `job-${uuidv4()}`,
      jobData: { minimal: true },
      taskId: uuidv4(),
    };
  }
}

/**
 * Execution Log Test Data Factory
 */
export class ExecutionLogTestDataFactory implements ITestDataFactory<any> {
  create(overrides?: any): any {
    const baseLog = {
      id: uuidv4(),
      executionId: overrides?.executionId || overrides?.taskExecutionId || uuidv4(),
      level: 'INFO' as const,
      source: 'SYSTEM' as const,
      message: 'Test log message',
      details: { testLog: true },
      timestamp: new Date(),
    };

    return { ...baseLog, ...overrides };
  }

  createMany(count: number, overrides?: any): any[] {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const;

    return Array.from({ length: count }, (_, index) =>
      this.create({
        level: levels[index % levels.length],
        message: `Test log message ${index + 1}`,
        timestamp: new Date(Date.now() + index * 1000),
        ...overrides
      })
    );
  }

  createMinimal(): any {
    return {
      id: uuidv4(),
      executionId: uuidv4(),
      level: 'INFO' as const,
      source: 'SYSTEM' as const,
      message: 'Minimal log',
    };
  }
}

/**
 * Database Test Helper
 * Main utility class for database testing
 */
export class DatabaseTestHelper {
  private prisma: PrismaClient;
  private transactionManager: TestTransactionManager;

  // Data Factories
  public readonly userFactory = new UserTestDataFactory();
  public readonly projectFactory = new ProjectTestDataFactory();
  public readonly claudeTaskFactory = new ClaudeTaskTestDataFactory();
  public readonly taskExecutionFactory = new TaskExecutionTestDataFactory();
  public readonly queueJobFactory = new QueueJobTestDataFactory();
  public readonly executionLogFactory = new ExecutionLogTestDataFactory();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.transactionManager = new TestTransactionManager(prisma);
  }

  /**
   * Create isolated transaction for test
   */
  async createTransaction() {
    return this.transactionManager.createIsolatedTransaction();
  }

  /**
   * Create test user with proper relationships
   */
  async createTestUser(overrides?: any, transaction?: Prisma.TransactionClient): Promise<any> {
    const client = transaction || this.prisma;
    const userData = this.userFactory.create(overrides);

    try {
      return await client.user.create({
        data: userData,
      });
    } catch (error) {
      throw new Error(`Failed to create test user: ${error.message}`);
    }
  }

  /**
   * Create test project with owner relationship
   */
  async createTestProject(ownerId?: string, overrides?: any, transaction?: Prisma.TransactionClient) {
    const client = transaction || this.prisma;

    // Create owner if not provided
    let actualOwnerId = ownerId;
    if (!actualOwnerId) {
      const owner = await this.createTestUser(undefined, transaction);
      actualOwnerId = owner.id;
    }

    const projectData = this.projectFactory.create({
      ownerId: actualOwnerId,
      ...overrides
    });

    try {
      return await client.project.create({
        data: projectData,
      });
    } catch (error) {
      throw new Error(`Failed to create test project: ${error.message}`);
    }
  }

  /**
   * Create test Claude task with relationships
   */
  async createTestClaudeTask(userId?: string, projectId?: string, overrides?: any, transaction?: Prisma.TransactionClient): Promise<any> {
    const client = transaction || this.prisma;

    // Create user if not provided
    let actualUserId = userId;
    if (!actualUserId) {
      const user = await this.createTestUser(undefined, transaction);
      actualUserId = user.id;
    }

    const taskData = this.claudeTaskFactory.create({
      createdById: actualUserId,
      projectId,
      ...overrides
    });

    try {
      return await client.claudeTask.create({
        data: taskData,
        include: {
          createdBy: true,
          project: true,
        },
      });
    } catch (error) {
      throw new Error(`Failed to create test Claude task: ${error.message}`);
    }
  }

  /**
   * Create complete task execution scenario
   */
  async createTaskExecutionScenario(overrides?: {
    user?: any;
    project?: any;
    task?: any;
    execution?: any;
    logs?: any[];
    queueJob?: any;
  }, transaction?: Prisma.TransactionClient): Promise<any> {
    const client = transaction || this.prisma;

    // Create user
    const user = await this.createTestUser(overrides?.user, transaction);

    // Create project (optional)
    let project = null;
    if (overrides?.project !== false) {
      project = await this.createTestProject(user.id, overrides?.project, transaction);
    }

    // Create Claude task
    const task = await this.createTestClaudeTask(
      user.id,
      project?.id,
      overrides?.task,
      transaction
    );

    // Create task execution
    const executionData = this.taskExecutionFactory.create({
      taskId: task.id,
      ...overrides?.execution
    });

    const execution = await client.taskExecution.create({
      data: executionData,
      include: {
        task: true,
      },
    });

    // Create execution logs
    const logs = [];
    const logCount = overrides?.logs?.length || 3;
    for (let i = 0; i < logCount; i++) {
      const logData = this.executionLogFactory.create({
        executionId: execution.id,
        ...overrides?.logs?.[i]
      });

      const log = await client.executionLog.create({
        data: logData,
      });

      logs.push(log);
    }

    // Create queue job
    let queueJob = null;
    if (overrides?.queueJob !== false) {
      const jobData = this.queueJobFactory.create({
        taskId: task.id,
        ...overrides?.queueJob
      });

      queueJob = await client.queueJob.create({
        data: jobData,
      });
    }

    return {
      user,
      project,
      task,
      execution,
      logs,
      queueJob,
    };
  }

  /**
   * Clean up test data by pattern
   */
  async cleanupTestData(patterns: {
    userEmails?: string[];
    projectNames?: string[];
    taskTitles?: string[];
  } = {}, transaction?: Prisma.TransactionClient) {
    const client = transaction || this.prisma;

    try {
      // Clean up in dependency order
      if (patterns.userEmails) {
        await client.executionLog.deleteMany({
          where: {
            execution: {
              task: {
                createdBy: {
                  email: { in: patterns.userEmails }
                }
              }
            }
          }
        });

        await client.queueJob.deleteMany({
          where: {
            task: {
              createdBy: {
                email: { in: patterns.userEmails }
              }
            }
          }
        });

        await client.taskExecution.deleteMany({
          where: {
            task: {
              createdBy: {
                email: { in: patterns.userEmails }
              }
            }
          }
        });

        await client.claudeTask.deleteMany({
          where: {
            createdBy: {
              email: { in: patterns.userEmails }
            }
          }
        });

        await client.user.deleteMany({
          where: {
            email: { in: patterns.userEmails }
          }
        });
      }

      if (patterns.projectNames) {
        await client.claudeTask.deleteMany({
          where: {
            project: {
              name: { in: patterns.projectNames }
            }
          }
        });

        await client.project.deleteMany({
          where: {
            name: { in: patterns.projectNames }
          }
        });
      }

      if (patterns.taskTitles) {
        await client.executionLog.deleteMany({
          where: {
            execution: {
              task: {
                title: { in: patterns.taskTitles }
              }
            }
          }
        });

        await client.queueJob.deleteMany({
          where: {
            task: {
              title: { in: patterns.taskTitles }
            }
          }
        });

        await client.taskExecution.deleteMany({
          where: {
            task: {
              title: { in: patterns.taskTitles }
            }
          }
        });

        await client.claudeTask.deleteMany({
          where: {
            title: { in: patterns.taskTitles }
          }
        });
      }
    } catch (error) {
      throw new Error(`Failed to cleanup test data: ${error.message}`);
    }
  }

  /**
   * Cleanup all test data with timestamp-based filtering
   */
  async cleanupAllTestData(olderThanMinutes: number = 0, transaction?: Prisma.TransactionClient) {
    const client = transaction || this.prisma;
    const cutoffDate = new Date(Date.now() - olderThanMinutes * 60 * 1000);

    try {
      // Clean up test data based on timestamps and test patterns
      await client.executionLog.deleteMany({
        where: {
          OR: [
            { timestamp: { lt: cutoffDate } },
            { message: { contains: 'Test log' } }
          ]
        }
      });

      await client.queueJob.deleteMany({
        where: {
          createdAt: { lt: cutoffDate }
        }
      });

      await client.taskExecution.deleteMany({
        where: {
          createdAt: { lt: cutoffDate }
        }
      });

      await client.claudeTask.deleteMany({
        where: {
          OR: [
            { createdAt: { lt: cutoffDate } },
            { title: { contains: 'Test Claude Task' } }
          ]
        }
      });

      await client.project.deleteMany({
        where: {
          OR: [
            { createdAt: { lt: cutoffDate } },
            { name: { contains: 'Test Project' } }
          ]
        }
      });

      await client.user.deleteMany({
        where: {
          OR: [
            { createdAt: { lt: cutoffDate } },
            { email: { contains: 'test-user-' } }
          ]
        }
      });
    } catch (error) {
      throw new Error(`Failed to cleanup all test data: ${error.message}`);
    }
  }

  /**
   * Validate data integrity for testing
   */
  async validateDataIntegrity(transaction?: Prisma.TransactionClient): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const client = transaction || this.prisma;
    const errors: string[] = [];

    try {
      // Check for orphaned task executions
      const orphanedExecutions = await client.taskExecution.count({
        where: {
          task: null
        }
      });

      if (orphanedExecutions > 0) {
        errors.push(`Found ${orphanedExecutions} orphaned task executions`);
      }

      // Check for orphaned execution logs
      const orphanedLogs = await client.executionLog.count({
        where: {
          execution: null
        }
      });

      if (orphanedLogs > 0) {
        errors.push(`Found ${orphanedLogs} orphaned execution logs`);
      }

      // Check for orphaned queue jobs
      const orphanedJobs = await client.queueJob.count({
        where: {
          task: null
        }
      });

      if (orphanedJobs > 0) {
        errors.push(`Found ${orphanedJobs} orphaned queue jobs`);
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`]
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.transactionManager.cleanup();
  }
}

/**
 * Test Database Setup Utility
 * Handles test database initialization and teardown
 */
export class TestDatabaseSetup {
  private prisma: PrismaClient;

  constructor(databaseUrl?: string) {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl || process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db'
        }
      }
    });
  }

  /**
   * Setup test database
   */
  async setup(): Promise<DatabaseTestHelper> {
    try {
      await this.prisma.$connect();

      // Verify database connection
      await this.prisma.$queryRaw`SELECT 1`;

      return new DatabaseTestHelper(this.prisma);
    } catch (error) {
      throw new Error(`Failed to setup test database: ${error.message}`);
    }
  }

  /**
   * Teardown test database
   */
  async teardown(helper?: DatabaseTestHelper): Promise<void> {
    try {
      if (helper) {
        await helper.cleanup();
      }

      await this.prisma.$disconnect();
    } catch (error) {
      throw new Error(`Failed to teardown test database: ${error.message}`);
    }
  }

  /**
   * Reset test database
   */
  async reset(): Promise<void> {
    try {
      // Clean up all test data
      const helper = new DatabaseTestHelper(this.prisma);
      await helper.cleanupAllTestData();

      // Validate integrity after cleanup
      const integrity = await helper.validateDataIntegrity();
      if (!integrity.isValid) {
        console.warn('Data integrity issues after reset:', integrity.errors);
      }
    } catch (error) {
      throw new Error(`Failed to reset test database: ${error.message}`);
    }
  }
}

// Export convenience function for quick setup
export const createTestDatabaseHelper = async (databaseUrl?: string): Promise<{
  helper: DatabaseTestHelper;
  teardown: () => Promise<void>;
}> => {
  const setup = new TestDatabaseSetup(databaseUrl);
  const helper = await setup.setup();

  return {
    helper,
    teardown: () => setup.teardown(helper)
  };
};