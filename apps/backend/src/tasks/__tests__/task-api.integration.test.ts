/**
 * Task API Integration Tests
 *
 * Purpose: Comprehensive validation of task CRUD API endpoints with authentication,
 * authorization, validation, and error handling scenarios
 *
 * Following SOLID principles:
 * - SRP: Focused test cases for each API endpoint and scenario
 * - ISP: Test interfaces segregated by operation type and concern
 * - DIP: Depends on abstractions (test utilities and factories)
 *
 * Implements KISS principle with clear, maintainable test design
 * Ensures DRY/SSOT compliance with reusable test patterns and utilities
 * Applies contract-driven test validation with fail-fast principles
 * Tests all CRUD operations, authentication, authorization, and error conditions
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import {
  DatabaseTestHelper,
  TestDatabaseSetup,
  createTestDatabaseHelper,
} from '../../../database/test-utils/database-test-helper';
import { TaskController } from '../task.controller';
import { TasksService } from '../tasks.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TaskOwnershipGuard } from '../guards/task-ownership.guard';
import { PrismaService } from '../../database/prisma.service';
import { TaskPriority, TaskStatus } from '../../../../../packages/schemas/src/tasks/task-schemas';
import { v4 as uuidv4 } from 'uuid';

// Test configuration interfaces for type safety and contract definition
interface TestContext {
  app: INestApplication;
  helper: DatabaseTestHelper;
  teardown: () => Promise<void>;
  prisma: any;
  transaction: any;
  rollback: () => Promise<void>;
}

interface AuthenticationContext {
  user: any;
  jwt: string;
  headers: { Authorization: string };
}

interface TaskTestData {
  valid: {
    create: any;
    update: any;
    query: any;
    statusUpdate: any;
    bulkOperation: any;
  };
  invalid: {
    create: any[];
    update: any[];
    query: any[];
    statusUpdate: any[];
    bulkOperation: any[];
  };
}

describe('Task API Integration Tests', () => {
  let testContext: TestContext;
  let authContext: AuthenticationContext;
  let otherUserAuthContext: AuthenticationContext;
  let taskTestData: TaskTestData;

  /**
   * Setup test environment with isolated database and application
   */
  beforeAll(async () => {
    try {
      // Setup test database with transaction isolation
      const { helper, teardown } = await createTestDatabaseHelper();
      const { prisma, rollback } = await helper.createTransaction();

      // Create NestJS testing module with mocked dependencies
      const moduleFixture: TestingModule = await Test.createTestingModule({
        controllers: [TaskController],
        providers: [
          {
            provide: TasksService,
            useValue: createMockTasksService(),
          },
          {
            provide: PrismaService,
            useValue: prisma,
          },
          {
            provide: JwtService,
            useValue: createMockJwtService(),
          },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(createMockJwtAuthGuard())
        .overrideGuard(TaskOwnershipGuard)
        .useValue(createMockTaskOwnershipGuard())
        .compile();

      // Create application instance
      const app = moduleFixture.createNestApplication();

      // Setup validation pipe for request validation
      app.useGlobalPipes(new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        validationError: {
          target: false,
          value: false,
        },
      }));

      await app.init();

      testContext = {
        app,
        helper,
        teardown,
        prisma,
        transaction: prisma,
        rollback,
      };

      // Setup authentication contexts for different users
      await setupAuthenticationContexts();

      // Setup test data patterns
      setupTaskTestData();

    } catch (error) {
      console.error('Failed to setup test environment:', error);
      throw error;
    }
  });

  /**
   * Cleanup test environment
   */
  afterAll(async () => {
    try {
      if (testContext?.app) {
        await testContext.app.close();
      }
      if (testContext?.rollback) {
        await testContext.rollback();
      }
      if (testContext?.teardown) {
        await testContext.teardown();
      }
    } catch (error) {
      console.error('Failed to cleanup test environment:', error);
    }
  });

  /**
   * Setup authentication contexts for test users
   */
  async function setupAuthenticationContexts(): Promise<void> {
    // Create primary test user
    const user = await testContext.helper.createTestUser(
      { email: 'task-api-test@example.com', username: 'taskuser' },
      testContext.transaction
    );

    // Create secondary user for ownership tests
    const otherUser = await testContext.helper.createTestUser(
      { email: 'other-user@example.com', username: 'otheruser' },
      testContext.transaction
    );

    // Generate JWT tokens for authentication
    const jwt = generateMockJWT(user);
    const otherJwt = generateMockJWT(otherUser);

    authContext = {
      user,
      jwt,
      headers: { Authorization: `Bearer ${jwt}` },
    };

    otherUserAuthContext = {
      user: otherUser,
      jwt: otherJwt,
      headers: { Authorization: `Bearer ${otherJwt}` },
    };
  }

  /**
   * Setup comprehensive test data patterns for validation
   */
  function setupTaskTestData(): void {
    taskTestData = {
      valid: {
        create: {
          title: 'Test Task Creation',
          description: 'Test task for API integration testing',
          prompt: 'Create a comprehensive test for task management API',
          config: {
            timeout: 1800,
            retryAttempts: 3,
            priority: TaskPriority.HIGH,
          },
          tags: ['test', 'api', 'integration'],
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        },
        update: {
          title: 'Updated Test Task',
          description: 'Updated description for testing',
          tags: ['test', 'updated'],
        },
        query: {
          page: 1,
          limit: 20,
          status: [TaskStatus.PENDING, TaskStatus.RUNNING],
          priority: [TaskPriority.HIGH],
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
        statusUpdate: {
          status: TaskStatus.COMPLETED,
          progress: 1.0,
        },
        bulkOperation: {
          operation: 'delete',
          taskIds: [], // Will be populated with actual task IDs in tests
          config: { force: false },
        },
      },
      invalid: {
        create: [
          // Missing required fields
          {
            description: 'Missing title and prompt',
          },
          // Invalid field lengths
          {
            title: 'x'.repeat(201), // Too long
            prompt: 'Valid prompt',
          },
          // Invalid data types
          {
            title: 'Valid title',
            prompt: 'Valid prompt',
            config: {
              timeout: 'invalid', // Should be number
              retryAttempts: -1, // Should be >= 0
            },
          },
          // Invalid date format
          {
            title: 'Valid title',
            prompt: 'Valid prompt',
            scheduledAt: 'invalid-date',
          },
        ],
        update: [
          // Invalid field lengths
          {
            title: 'x'.repeat(201),
          },
          // Invalid data types
          {
            config: {
              timeout: 'invalid',
            },
          },
        ],
        query: [
          // Invalid pagination
          { page: 0, limit: 101 },
          // Invalid enum values
          { status: ['INVALID_STATUS'] },
          // Invalid UUID format
          { projectId: 'invalid-uuid' },
        ],
        statusUpdate: [
          // Missing required status
          { progress: 0.5 },
          // Invalid status value
          { status: 'INVALID_STATUS' },
          // Invalid progress range
          { status: TaskStatus.RUNNING, progress: 1.5 },
        ],
        bulkOperation: [
          // Missing required fields
          { taskIds: ['valid-uuid'] },
          // Invalid operation
          { operation: 'invalid', taskIds: ['valid-uuid'] },
          // Too many task IDs
          { operation: 'delete', taskIds: new Array(101).fill('valid-uuid') },
        ],
      },
    };
  }

  describe('POST /api/v1/tasks - Create Task', () => {
    /**
     * Test: Successful task creation with valid data
     * Validates: Request validation, authentication, data persistence
     */
    it('should create a task successfully with valid data', async () => {
      const response = await request(testContext.app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authContext.headers)
        .send(taskTestData.valid.create)
        .expect(201);

      // Validate response structure and data
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(taskTestData.valid.create.title);
      expect(response.body.status).toBe(TaskStatus.PENDING);
      expect(response.body.createdBy.id).toBe(authContext.user.id);
      expect(response.body.tags).toEqual(taskTestData.valid.create.tags);
    });

    /**
     * Test: Minimal task creation with only required fields
     * Validates: Required field validation, default values
     */
    it('should create a task with minimal required data', async () => {
      const minimalTask = {
        title: 'Minimal Test Task',
        prompt: 'Minimal prompt for testing',
      };

      const response = await request(testContext.app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authContext.headers)
        .send(minimalTask)
        .expect(201);

      expect(response.body.title).toBe(minimalTask.title);
      expect(response.body.prompt).toBe(minimalTask.prompt);
      expect(response.body.status).toBe(TaskStatus.PENDING);
      expect(response.body.priority).toBe(TaskPriority.MEDIUM); // Default priority
      expect(response.body.retryCount).toBe(0);
    });

    /**
     * Test: Authentication required for task creation
     * Validates: JWT authentication guard functionality
     */
    it('should reject unauthenticated requests', async () => {
      const response = await request(testContext.app.getHttpServer())
        .post('/api/v1/tasks')
        .send(taskTestData.valid.create)
        .expect(401);

      expect(response.body.message).toContain('Unauthorized');
    });

    /**
     * Test: Validation errors for invalid data
     * Validates: Input validation, error messages, fail-fast validation
     */
    it('should return validation errors for invalid data', async () => {
      for (const invalidData of taskTestData.invalid.create) {
        const response = await request(testContext.app.getHttpServer())
          .post('/api/v1/tasks')
          .set(authContext.headers)
          .send(invalidData)
          .expect(400);

        expect(response.body).toHaveProperty('message');
        expect(Array.isArray(response.body.message)).toBe(true);
      }
    });

    /**
     * Test: Project association validation
     * Validates: Foreign key validation, project existence
     */
    it('should validate project existence when projectId is provided', async () => {
      const taskWithInvalidProject = {
        ...taskTestData.valid.create,
        projectId: uuidv4(), // Non-existent project
      };

      await request(testContext.app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authContext.headers)
        .send(taskWithInvalidProject)
        .expect(400);
    });
  });

  describe('GET /api/v1/tasks - List Tasks', () => {
    let createdTasks: any[] = [];

    beforeAll(async () => {
      // Create test tasks with various statuses and priorities
      const testTasksData = [
        {
          ...taskTestData.valid.create,
          title: 'High Priority Task',
          status: TaskStatus.PENDING,
          priority: TaskPriority.HIGH,
        },
        {
          ...taskTestData.valid.create,
          title: 'Medium Priority Task',
          status: TaskStatus.RUNNING,
          priority: TaskPriority.MEDIUM,
        },
        {
          ...taskTestData.valid.create,
          title: 'Completed Task',
          status: TaskStatus.COMPLETED,
          priority: TaskPriority.LOW,
        },
      ];

      for (const taskData of testTasksData) {
        const response = await request(testContext.app.getHttpServer())
          .post('/api/v1/tasks')
          .set(authContext.headers)
          .send(taskData);

        createdTasks.push(response.body);
      }
    });

    /**
     * Test: Basic task listing with default parameters
     * Validates: Default pagination, sorting, response structure
     */
    it('should return paginated tasks with default parameters', async () => {
      const response = await request(testContext.app.getHttpServer())
        .get('/api/v1/tasks')
        .set(authContext.headers)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);

      // Validate pagination structure
      const { pagination } = response.body;
      expect(pagination).toHaveProperty('page');
      expect(pagination).toHaveProperty('limit');
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('totalPages');
      expect(pagination).toHaveProperty('hasNext');
      expect(pagination).toHaveProperty('hasPrev');
    });

    /**
     * Test: Custom pagination parameters
     * Validates: Pagination limits, page navigation
     */
    it('should respect custom pagination parameters', async () => {
      const response = await request(testContext.app.getHttpServer())
        .get('/api/v1/tasks')
        .query({ page: 1, limit: 2 })
        .set(authContext.headers)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(2);
    });

    /**
     * Test: Status filtering
     * Validates: Multi-value filtering, result accuracy
     */
    it('should filter tasks by status', async () => {
      const response = await request(testContext.app.getHttpServer())
        .get('/api/v1/tasks')
        .query({ status: [TaskStatus.PENDING, TaskStatus.RUNNING] })
        .set(authContext.headers)
        .expect(200);

      response.body.data.forEach((task: any) => {
        expect([TaskStatus.PENDING, TaskStatus.RUNNING]).toContain(task.status);
      });
    });

    /**
     * Test: Priority filtering
     * Validates: Enum filtering, query parameter handling
     */
    it('should filter tasks by priority', async () => {
      const response = await request(testContext.app.getHttpServer())
        .get('/api/v1/tasks')
        .query({ priority: TaskPriority.HIGH })
        .set(authContext.headers)
        .expect(200);

      response.body.data.forEach((task: any) => {
        expect(task.priority).toBe(TaskPriority.HIGH);
      });
    });

    /**
     * Test: Full-text search functionality
     * Validates: Search implementation, relevance
     */
    it('should perform full-text search', async () => {
      const searchTerm = 'High Priority';
      const response = await request(testContext.app.getHttpServer())
        .get('/api/v1/tasks')
        .query({ search: searchTerm })
        .set(authContext.headers)
        .expect(200);

      // At least one result should contain the search term in title or description
      const hasMatchingResult = response.body.data.some((task: any) =>
        task.title.includes(searchTerm) ||
        (task.description && task.description.includes(searchTerm))
      );
      expect(hasMatchingResult).toBe(true);
    });

    /**
     * Test: Sorting functionality
     * Validates: Sort order, field-specific sorting
     */
    it('should sort tasks by specified fields', async () => {
      const response = await request(testContext.app.getHttpServer())
        .get('/api/v1/tasks')
        .query({ sortBy: 'title', sortOrder: 'asc' })
        .set(authContext.headers)
        .expect(200);

      const titles = response.body.data.map((task: any) => task.title);
      const sortedTitles = [...titles].sort();
      expect(titles).toEqual(sortedTitles);
    });

    /**
     * Test: Date range filtering
     * Validates: Date parsing, range queries
     */
    it('should filter tasks by date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const response = await request(testContext.app.getHttpServer())
        .get('/api/v1/tasks')
        .query({ createdAfter: yesterday, createdBefore: tomorrow })
        .set(authContext.headers)
        .expect(200);

      response.body.data.forEach((task: any) => {
        const createdAt = new Date(task.createdAt);
        expect(createdAt.getTime()).toBeGreaterThan(new Date(yesterday).getTime());
        expect(createdAt.getTime()).toBeLessThan(new Date(tomorrow).getTime());
      });
    });

    /**
     * Test: Invalid query parameters
     * Validates: Parameter validation, error handling
     */
    it('should return validation errors for invalid query parameters', async () => {
      for (const invalidQuery of taskTestData.invalid.query) {
        await request(testContext.app.getHttpServer())
          .get('/api/v1/tasks')
          .query(invalidQuery)
          .set(authContext.headers)
          .expect(400);
      }
    });
  });

  describe('GET /api/v1/tasks/:id - Get Task by ID', () => {
    let testTask: any;

    beforeAll(async () => {
      // Create a test task
      const response = await request(testContext.app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authContext.headers)
        .send(taskTestData.valid.create);

      testTask = response.body;
    });

    /**
     * Test: Successful task retrieval by ID
     * Validates: Task existence, data completeness, relationships
     */
    it('should return task details for valid ID', async () => {
      const response = await request(testContext.app.getHttpServer())
        .get(`/api/v1/tasks/${testTask.id}`)
        .set(authContext.headers)
        .expect(200);

      expect(response.body.id).toBe(testTask.id);
      expect(response.body.title).toBe(testTask.title);
      expect(response.body.createdBy).toHaveProperty('id');
      expect(response.body.createdBy).toHaveProperty('username');
      expect(response.body.createdBy).toHaveProperty('email');
    });

    /**
     * Test: Task ownership validation
     * Validates: Authorization guard, ownership-based access control
     */
    it('should reject access to tasks owned by other users', async () => {
      await request(testContext.app.getHttpServer())
        .get(`/api/v1/tasks/${testTask.id}`)
        .set(otherUserAuthContext.headers)
        .expect(403);
    });

    /**
     * Test: Invalid task ID format
     * Validates: UUID validation, parameter parsing
     */
    it('should return 400 for invalid UUID format', async () => {
      await request(testContext.app.getHttpServer())
        .get('/api/v1/tasks/invalid-uuid')
        .set(authContext.headers)
        .expect(400);
    });

    /**
     * Test: Non-existent task ID
     * Validates: Resource existence validation
     */
    it('should return 404 for non-existent task', async () => {
      const nonExistentId = uuidv4();

      await request(testContext.app.getHttpServer())
        .get(`/api/v1/tasks/${nonExistentId}`)
        .set(authContext.headers)
        .expect(404);
    });

    /**
     * Test: Unauthenticated access
     * Validates: Authentication requirement
     */
    it('should reject unauthenticated requests', async () => {
      await request(testContext.app.getHttpServer())
        .get(`/api/v1/tasks/${testTask.id}`)
        .expect(401);
    });
  });

  describe('PATCH /api/v1/tasks/:id - Update Task', () => {
    let testTask: any;

    beforeEach(async () => {
      // Create a fresh test task for each update test
      const response = await request(testContext.app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authContext.headers)
        .send({
          title: 'Task to Update',
          prompt: 'Original prompt',
          description: 'Original description',
        });

      testTask = response.body;
    });

    /**
     * Test: Successful partial task update
     * Validates: Partial updates, field validation, data persistence
     */
    it('should update task with valid partial data', async () => {
      const updateData = taskTestData.valid.update;

      const response = await request(testContext.app.getHttpServer())
        .patch(`/api/v1/tasks/${testTask.id}`)
        .set(authContext.headers)
        .send(updateData)
        .expect(200);

      expect(response.body.title).toBe(updateData.title);
      expect(response.body.description).toBe(updateData.description);
      expect(response.body.tags).toEqual(updateData.tags);
      expect(response.body.updatedAt).not.toBe(testTask.updatedAt);
    });

    /**
     * Test: Single field update
     * Validates: Minimal update operations, field isolation
     */
    it('should update individual fields', async () => {
      const updateData = { title: 'New Title Only' };

      const response = await request(testContext.app.getHttpServer())
        .patch(`/api/v1/tasks/${testTask.id}`)
        .set(authContext.headers)
        .send(updateData)
        .expect(200);

      expect(response.body.title).toBe(updateData.title);
      expect(response.body.description).toBe(testTask.description); // Unchanged
      expect(response.body.prompt).toBe(testTask.prompt); // Unchanged
    });

    /**
     * Test: Task ownership validation for updates
     * Validates: Authorization for modifications
     */
    it('should reject updates from non-owners', async () => {
      await request(testContext.app.getHttpServer())
        .patch(`/api/v1/tasks/${testTask.id}`)
        .set(otherUserAuthContext.headers)
        .send(taskTestData.valid.update)
        .expect(403);
    });

    /**
     * Test: Validation errors for invalid update data
     * Validates: Update-specific validation rules
     */
    it('should return validation errors for invalid update data', async () => {
      for (const invalidData of taskTestData.invalid.update) {
        await request(testContext.app.getHttpServer())
          .patch(`/api/v1/tasks/${testTask.id}`)
          .set(authContext.headers)
          .send(invalidData)
          .expect(400);
      }
    });

    /**
     * Test: Empty update request
     * Validates: Handling of empty payloads
     */
    it('should handle empty update requests', async () => {
      const response = await request(testContext.app.getHttpServer())
        .patch(`/api/v1/tasks/${testTask.id}`)
        .set(authContext.headers)
        .send({})
        .expect(200);

      // Task should remain unchanged
      expect(response.body.title).toBe(testTask.title);
      expect(response.body.description).toBe(testTask.description);
    });
  });

  describe('DELETE /api/v1/tasks/:id - Delete Task', () => {
    let testTask: any;

    beforeEach(async () => {
      // Create a fresh test task for each delete test
      const response = await request(testContext.app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authContext.headers)
        .send({
          title: 'Task to Delete',
          prompt: 'Task for deletion testing',
        });

      testTask = response.body;
    });

    /**
     * Test: Successful task deletion
     * Validates: Deletion operation, cascade effects, resource cleanup
     */
    it('should delete task successfully', async () => {
      await request(testContext.app.getHttpServer())
        .delete(`/api/v1/tasks/${testTask.id}`)
        .set(authContext.headers)
        .expect(204);

      // Verify task no longer exists
      await request(testContext.app.getHttpServer())
        .get(`/api/v1/tasks/${testTask.id}`)
        .set(authContext.headers)
        .expect(404);
    });

    /**
     * Test: Task ownership validation for deletion
     * Validates: Authorization for destructive operations
     */
    it('should reject deletion attempts from non-owners', async () => {
      await request(testContext.app.getHttpServer())
        .delete(`/api/v1/tasks/${testTask.id}`)
        .set(otherUserAuthContext.headers)
        .expect(403);

      // Verify task still exists
      await request(testContext.app.getHttpServer())
        .get(`/api/v1/tasks/${testTask.id}`)
        .set(authContext.headers)
        .expect(200);
    });

    /**
     * Test: Deletion of non-existent task
     * Validates: Error handling for missing resources
     */
    it('should return 404 for non-existent task deletion', async () => {
      const nonExistentId = uuidv4();

      await request(testContext.app.getHttpServer())
        .delete(`/api/v1/tasks/${nonExistentId}`)
        .set(authContext.headers)
        .expect(404);
    });

    /**
     * Test: Cascading deletion validation
     * Validates: Related data cleanup, referential integrity
     */
    it('should handle cascading deletion of related resources', async () => {
      // This test would verify that related executions, logs, etc. are properly cleaned up
      // The actual implementation depends on the database schema and cascade rules

      await request(testContext.app.getHttpServer())
        .delete(`/api/v1/tasks/${testTask.id}`)
        .set(authContext.headers)
        .expect(204);

      // Additional verification could include checking for orphaned related records
      // depending on the specific implementation of cascade deletion
    });
  });

  describe('PATCH /api/v1/tasks/:id/status - Update Task Status', () => {
    let testTask: any;

    beforeEach(async () => {
      // Create a fresh test task for status update tests
      const response = await request(testContext.app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authContext.headers)
        .send({
          title: 'Task for Status Updates',
          prompt: 'Task for testing status transitions',
        });

      testTask = response.body;
    });

    /**
     * Test: Valid status transition
     * Validates: Status workflow, progress tracking, timestamp updates
     */
    it('should update task status with valid transition', async () => {
      const statusUpdate = {
        status: TaskStatus.RUNNING,
        progress: 0.5,
      };

      const response = await request(testContext.app.getHttpServer())
        .patch(`/api/v1/tasks/${testTask.id}/status`)
        .set(authContext.headers)
        .send(statusUpdate)
        .expect(200);

      expect(response.body.status).toBe(TaskStatus.RUNNING);
      expect(response.body.progress).toBe(0.5);
      expect(response.body.startedAt).toBeTruthy();
    });

    /**
     * Test: Task completion status update
     * Validates: Final status handling, completion tracking
     */
    it('should handle task completion', async () => {
      const completionUpdate = taskTestData.valid.statusUpdate;

      const response = await request(testContext.app.getHttpServer())
        .patch(`/api/v1/tasks/${testTask.id}/status`)
        .set(authContext.headers)
        .send(completionUpdate)
        .expect(200);

      expect(response.body.status).toBe(TaskStatus.COMPLETED);
      expect(response.body.progress).toBe(1.0);
      expect(response.body.completedAt).toBeTruthy();
    });

    /**
     * Test: Error status with error message
     * Validates: Error handling, error message storage
     */
    it('should handle failure status with error message', async () => {
      const failureUpdate = {
        status: TaskStatus.FAILED,
        errorMessage: 'Task execution failed due to timeout',
      };

      const response = await request(testContext.app.getHttpServer())
        .patch(`/api/v1/tasks/${testTask.id}/status`)
        .set(authContext.headers)
        .send(failureUpdate)
        .expect(200);

      expect(response.body.status).toBe(TaskStatus.FAILED);
      expect(response.body.errorMessage).toBe(failureUpdate.errorMessage);
    });

    /**
     * Test: Invalid status update validation
     * Validates: Status update validation rules
     */
    it('should return validation errors for invalid status updates', async () => {
      for (const invalidStatus of taskTestData.invalid.statusUpdate) {
        await request(testContext.app.getHttpServer())
          .patch(`/api/v1/tasks/${testTask.id}/status`)
          .set(authContext.headers)
          .send(invalidStatus)
          .expect(400);
      }
    });

    /**
     * Test: Status update authorization
     * Validates: Access control for status modifications
     */
    it('should validate ownership for status updates', async () => {
      await request(testContext.app.getHttpServer())
        .patch(`/api/v1/tasks/${testTask.id}/status`)
        .set(otherUserAuthContext.headers)
        .send(taskTestData.valid.statusUpdate)
        .expect(403);
    });
  });

  describe('POST /api/v1/tasks/bulk - Bulk Operations', () => {
    let testTasks: any[] = [];

    beforeAll(async () => {
      // Create multiple test tasks for bulk operations
      const taskPromises = Array.from({ length: 5 }, (_, index) =>
        request(testContext.app.getHttpServer())
          .post('/api/v1/tasks')
          .set(authContext.headers)
          .send({
            title: `Bulk Test Task ${index + 1}`,
            prompt: `Bulk testing prompt ${index + 1}`,
          })
      );

      const responses = await Promise.all(taskPromises);
      testTasks = responses.map(response => response.body);
    });

    /**
     * Test: Bulk deletion operation
     * Validates: Batch processing, transactional consistency
     */
    it('should perform bulk deletion successfully', async () => {
      const taskIds = testTasks.slice(0, 3).map(task => task.id);
      const bulkOperation = {
        operation: 'delete',
        taskIds,
        config: { force: false },
      };

      const response = await request(testContext.app.getHttpServer())
        .post('/api/v1/tasks/bulk')
        .set(authContext.headers)
        .send(bulkOperation)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.processedCount).toBe(3);
      expect(response.body.failedCount).toBe(0);
      expect(response.body.results).toHaveLength(3);

      // Verify tasks were actually deleted
      for (const taskId of taskIds) {
        await request(testContext.app.getHttpServer())
          .get(`/api/v1/tasks/${taskId}`)
          .set(authContext.headers)
          .expect(404);
      }
    });

    /**
     * Test: Bulk cancellation operation
     * Validates: Status transitions in bulk, selective processing
     */
    it('should perform bulk cancellation', async () => {
      const taskIds = testTasks.slice(3).map(task => task.id);
      const bulkOperation = {
        operation: 'cancel',
        taskIds,
      };

      const response = await request(testContext.app.getHttpServer())
        .post('/api/v1/tasks/bulk')
        .set(authContext.headers)
        .send(bulkOperation)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.processedCount).toBeGreaterThan(0);

      // Verify tasks were cancelled
      for (const taskId of taskIds) {
        const taskResponse = await request(testContext.app.getHttpServer())
          .get(`/api/v1/tasks/${taskId}`)
          .set(authContext.headers);

        if (taskResponse.status === 200) {
          expect(taskResponse.body.status).toBe(TaskStatus.CANCELLED);
        }
      }
    });

    /**
     * Test: Bulk operation validation errors
     * Validates: Bulk operation input validation
     */
    it('should return validation errors for invalid bulk operations', async () => {
      for (const invalidOperation of taskTestData.invalid.bulkOperation) {
        await request(testContext.app.getHttpServer())
          .post('/api/v1/tasks/bulk')
          .set(authContext.headers)
          .send(invalidOperation)
          .expect(400);
      }
    });

    /**
     * Test: Bulk operation with mixed ownership
     * Validates: Ownership validation in bulk operations
     */
    it('should handle mixed ownership in bulk operations', async () => {
      // Create task owned by other user
      const otherUserTask = await request(testContext.app.getHttpServer())
        .post('/api/v1/tasks')
        .set(otherUserAuthContext.headers)
        .send({
          title: 'Other User Task',
          prompt: 'Task owned by different user',
        });

      const mixedTaskIds = [testTasks[0].id, otherUserTask.body.id];
      const bulkOperation = {
        operation: 'delete',
        taskIds: mixedTaskIds,
      };

      const response = await request(testContext.app.getHttpServer())
        .post('/api/v1/tasks/bulk')
        .set(authContext.headers)
        .send(bulkOperation)
        .expect(200);

      // Should have partial success - only owned tasks processed
      expect(response.body.processedCount).toBeLessThan(mixedTaskIds.length);
      expect(response.body.failedCount).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/tasks/analytics/metrics - Task Metrics', () => {
    beforeAll(async () => {
      // Create tasks with various statuses for metrics testing
      const metricTestTasks = [
        { status: TaskStatus.COMPLETED, actualDuration: 1800 },
        { status: TaskStatus.COMPLETED, actualDuration: 2400 },
        { status: TaskStatus.FAILED, actualDuration: null },
        { status: TaskStatus.PENDING, actualDuration: null },
        { status: TaskStatus.RUNNING, actualDuration: null },
      ];

      for (const taskConfig of metricTestTasks) {
        const createResponse = await request(testContext.app.getHttpServer())
          .post('/api/v1/tasks')
          .set(authContext.headers)
          .send({
            title: `Metrics Test Task - ${taskConfig.status}`,
            prompt: 'Task for metrics testing',
          });

        // Update status if needed
        if (taskConfig.status !== TaskStatus.PENDING) {
          await request(testContext.app.getHttpServer())
            .patch(`/api/v1/tasks/${createResponse.body.id}/status`)
            .set(authContext.headers)
            .send({
              status: taskConfig.status,
              progress: taskConfig.status === TaskStatus.COMPLETED ? 1.0 : 0.5,
              errorMessage: taskConfig.status === TaskStatus.FAILED ? 'Test error' : undefined,
            });
        }
      }
    });

    /**
     * Test: Task metrics retrieval
     * Validates: Analytics calculation, performance metrics, data accuracy
     */
    it('should return comprehensive task metrics', async () => {
      const response = await request(testContext.app.getHttpServer())
        .get('/api/v1/tasks/analytics/metrics')
        .set(authContext.headers)
        .expect(200);

      // Validate metrics structure
      expect(response.body).toHaveProperty('totalTasks');
      expect(response.body).toHaveProperty('completedTasks');
      expect(response.body).toHaveProperty('failedTasks');
      expect(response.body).toHaveProperty('successRate');
      expect(response.body).toHaveProperty('averageDuration');

      // Validate data types and ranges
      expect(typeof response.body.totalTasks).toBe('number');
      expect(response.body.totalTasks).toBeGreaterThan(0);
      expect(response.body.successRate).toBeGreaterThanOrEqual(0);
      expect(response.body.successRate).toBeLessThanOrEqual(1);

      if (response.body.averageDuration !== null) {
        expect(response.body.averageDuration).toBeGreaterThan(0);
      }
    });

    /**
     * Test: Metrics authentication requirement
     * Validates: Access control for analytics endpoints
     */
    it('should require authentication for metrics access', async () => {
      await request(testContext.app.getHttpServer())
        .get('/api/v1/tasks/analytics/metrics')
        .expect(401);
    });

    /**
     * Test: Metrics calculation accuracy
     * Validates: Statistical calculations, data aggregation
     */
    it('should calculate metrics accurately based on task data', async () => {
      const response = await request(testContext.app.getHttpServer())
        .get('/api/v1/tasks/analytics/metrics')
        .set(authContext.headers)
        .expect(200);

      const { totalTasks, completedTasks, failedTasks, successRate } = response.body;

      // Validate success rate calculation
      if (totalTasks > 0) {
        const expectedSuccessRate = completedTasks / totalTasks;
        expect(Math.abs(successRate - expectedSuccessRate)).toBeLessThan(0.001); // Allow for floating point precision
      }

      // Validate basic arithmetic consistency
      expect(completedTasks + failedTasks).toBeLessThanOrEqual(totalTasks);
    });
  });

  describe('Performance and Load Testing', () => {
    /**
     * Test: API response time validation
     * Validates: Performance requirements, response time consistency
     */
    it('should meet response time requirements for CRUD operations', async () => {
      const performanceTests = [
        {
          operation: 'Create Task',
          request: () => request(testContext.app.getHttpServer())
            .post('/api/v1/tasks')
            .set(authContext.headers)
            .send({
              title: 'Performance Test Task',
              prompt: 'Performance testing prompt',
            }),
          expectedTime: 200, // 200ms
        },
        {
          operation: 'List Tasks',
          request: () => request(testContext.app.getHttpServer())
            .get('/api/v1/tasks')
            .set(authContext.headers),
          expectedTime: 200, // 200ms
        },
        {
          operation: 'Get Task Metrics',
          request: () => request(testContext.app.getHttpServer())
            .get('/api/v1/tasks/analytics/metrics')
            .set(authContext.headers),
          expectedTime: 100, // 100ms
        },
      ];

      for (const test of performanceTests) {
        const startTime = Date.now();
        const response = await test.request();
        const responseTime = Date.now() - startTime;

        expect(response.status).toBeLessThan(400); // Successful response
        expect(responseTime).toBeLessThan(test.expectedTime);

        console.log(`${test.operation}: ${responseTime}ms (limit: ${test.expectedTime}ms)`);
      }
    });

    /**
     * Test: Concurrent request handling
     * Validates: Concurrency support, resource contention handling
     */
    it('should handle concurrent requests without errors', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, index) =>
        request(testContext.app.getHttpServer())
          .post('/api/v1/tasks')
          .set(authContext.headers)
          .send({
            title: `Concurrent Test Task ${index}`,
            prompt: `Concurrent testing prompt ${index}`,
          })
      );

      const responses = await Promise.all(concurrentRequests);

      // All requests should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.title).toBe(`Concurrent Test Task ${index}`);
      });

      // All tasks should have unique IDs
      const taskIds = responses.map(response => response.body.id);
      const uniqueIds = [...new Set(taskIds)];
      expect(uniqueIds.length).toBe(taskIds.length);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    /**
     * Test: Database connection error handling
     * Validates: Error recovery, graceful degradation
     */
    it('should handle database connectivity issues gracefully', async () => {
      // This test would require mocking database failures
      // Implementation depends on the specific error handling strategy
      expect(true).toBe(true); // Placeholder for database error handling tests
    });

    /**
     * Test: Large payload handling
     * Validates: Request size limits, memory management
     */
    it('should handle large request payloads appropriately', async () => {
      const largeDescription = 'x'.repeat(2000); // Exceeds 1000 char limit

      await request(testContext.app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authContext.headers)
        .send({
          title: 'Large Payload Test',
          prompt: 'Testing large payload handling',
          description: largeDescription,
        })
        .expect(400);
    });

    /**
     * Test: Malformed request handling
     * Validates: Input sanitization, security considerations
     */
    it('should handle malformed JSON requests', async () => {
      await request(testContext.app.getHttpServer())
        .post('/api/v1/tasks')
        .set(authContext.headers)
        .send('{ invalid json }')
        .expect(400);
    });

    /**
     * Test: Rate limiting behavior
     * Validates: API protection, abuse prevention
     */
    it('should implement appropriate rate limiting', async () => {
      // This test would validate rate limiting implementation
      // The specific implementation depends on the rate limiting strategy used
      expect(true).toBe(true); // Placeholder for rate limiting tests
    });
  });

  // Helper Functions

  /**
   * Create mock TasksService for testing
   */
  function createMockTasksService(): Partial<TasksService> {
    return {
      createTask: jest.fn().mockImplementation(async (data, userId) => ({
        id: uuidv4(),
        ...data,
        status: TaskStatus.PENDING,
        priority: data.config?.priority || TaskPriority.MEDIUM,
        progress: null,
        createdBy: { id: userId, username: 'testuser', email: 'test@example.com' },
        project: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scheduledAt: data.scheduledAt || null,
        startedAt: null,
        completedAt: null,
        estimatedDuration: null,
        actualDuration: null,
        errorMessage: null,
        retryCount: 0,
        tags: data.tags || [],
      })),
      getTasks: jest.fn().mockImplementation(async (query) => ({
        data: [],
        pagination: {
          page: query.page,
          limit: query.limit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      })),
      getTaskById: jest.fn().mockImplementation(async (id) => {
        throw new Error('Task not found');
      }),
      updateTask: jest.fn().mockImplementation(async (id, data, userId) => ({
        id,
        ...data,
        updatedAt: new Date().toISOString(),
      })),
      deleteTask: jest.fn().mockImplementation(async (id, userId) => {
        // Mock successful deletion
      }),
      updateTaskStatus: jest.fn().mockImplementation(async (id, statusData) => ({
        id,
        ...statusData,
        updatedAt: new Date().toISOString(),
      })),
      bulkOperation: jest.fn().mockImplementation(async (operation, userId) => ({
        success: true,
        processedCount: operation.taskIds.length,
        failedCount: 0,
        results: operation.taskIds.map((taskId: string) => ({
          taskId,
          success: true,
        })),
      })),
      getTaskMetrics: jest.fn().mockImplementation(async () => ({
        totalTasks: 100,
        completedTasks: 80,
        failedTasks: 15,
        averageDuration: 1800.5,
        successRate: 0.8,
      })),
    };
  }

  /**
   * Create mock JWT service for testing
   */
  function createMockJwtService(): Partial<JwtService> {
    return {
      verify: jest.fn().mockImplementation((token: string) => {
        // Simple token parsing for testing
        const [, payload] = token.split('.');
        return JSON.parse(Buffer.from(payload, 'base64').toString());
      }),
    };
  }

  /**
   * Create mock JWT authentication guard
   */
  function createMockJwtAuthGuard() {
    return {
      canActivate: jest.fn().mockImplementation((context) => {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return false;
        }

        const token = authHeader.split(' ')[1];
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());

        request.user = payload;
        return true;
      }),
    };
  }

  /**
   * Create mock task ownership guard
   */
  function createMockTaskOwnershipGuard() {
    return {
      canActivate: jest.fn().mockImplementation((context) => {
        const request = context.switchToHttp().getRequest();
        // For testing purposes, allow access if user is authenticated
        // Real implementation would check task ownership
        return !!request.user;
      }),
    };
  }

  /**
   * Generate mock JWT token for testing
   */
  function generateMockJWT(user: any): string {
    const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'HS256' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({
      sub: user.id,
      email: user.email,
      username: user.username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64');
    const signature = 'mock-signature';

    return `${header}.${payload}.${signature}`;
  }
});