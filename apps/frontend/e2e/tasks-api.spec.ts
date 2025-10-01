/**
 * Tasks API E2E Tests
 *
 * Tests direct API endpoint calls for task management:
 * - POST /api/tasks (creates task, validates input)
 * - GET /api/tasks (returns paginated list, supports filters)
 * - GET /api/tasks/:id (returns single task, 404 for non-existent)
 * - PATCH /api/tasks/:id (updates task, validates ownership)
 * - DELETE /api/tasks/:id (soft-deletes task, validates ownership)
 * - Protected route authentication (401 without JWT)
 *
 * Spec: backend-tasks-api (Task 10)
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3006';
const API_BASE = `${BASE_URL}/api`;

// Generate unique test user for each test run
const timestamp = Date.now();

test.describe('Tasks API - Setup', () => {
  let accessToken: string;
  let userId: string;

  test.beforeAll(async ({ request }) => {
    // Register and login to get authentication token
    const email = `tasks.test.${timestamp}@example.com`;
    const password = 'TasksTest123!';

    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: {
        email,
        password,
        name: 'Tasks Test User',
      },
    });

    const body = await registerResponse.json();
    accessToken = body.accessToken;
    userId = body.user.id;
  });

  test('should have valid authentication token', () => {
    expect(accessToken).toBeTruthy();
    expect(userId).toBeTruthy();
  });
});

test.describe('Tasks API - Create Task (POST /api/tasks)', () => {
  let accessToken: string;

  test.beforeAll(async ({ request }) => {
    const email = `create.tasks.${timestamp}@example.com`;
    const password = 'CreateTest123!';

    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: { email, password, name: 'Create Tasks Test' },
    });

    const body = await registerResponse.json();
    accessToken = body.accessToken;
  });

  test('should create task with valid data (201)', async ({ request }) => {
    const response = await request.post(`${API_BASE}/tasks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        title: 'Test Task',
        description: 'This is a test task',
        priority: 'MEDIUM',
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('title', 'Test Task');
    expect(body).toHaveProperty('description', 'This is a test task');
    expect(body).toHaveProperty('priority', 'MEDIUM');
    expect(body).toHaveProperty('status', 'PENDING');
    expect(body).toHaveProperty('userId');
    expect(body).toHaveProperty('createdAt');
    expect(body).toHaveProperty('updatedAt');
    expect(body.deletedAt).toBeNull();

    console.log('✅ Task created successfully (201)');
  });

  test('should create task without optional description (201)', async ({ request }) => {
    const response = await request.post(`${API_BASE}/tasks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        title: 'Task Without Description',
        priority: 'HIGH',
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.title).toBe('Task Without Description');
    expect(body.description).toBeNull();
    expect(body.priority).toBe('HIGH');

    console.log('✅ Task created without description (201)');
  });

  test('should use default priority MEDIUM when not specified (201)', async ({ request }) => {
    const response = await request.post(`${API_BASE}/tasks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        title: 'Task With Default Priority',
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.priority).toBe('MEDIUM');

    console.log('✅ Default priority applied (201)');
  });

  test('should reject task without title (400)', async ({ request }) => {
    const response = await request.post(`${API_BASE}/tasks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        description: 'No title provided',
      },
    });

    expect(response.status()).toBe(400);
    console.log('✅ Task without title rejected (400)');
  });

  test('should reject task with title exceeding 200 characters (400)', async ({ request }) => {
    const longTitle = 'x'.repeat(201);

    const response = await request.post(`${API_BASE}/tasks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        title: longTitle,
      },
    });

    expect(response.status()).toBe(400);
    console.log('✅ Task with long title rejected (400)');
  });

  test('should reject task with description exceeding 2000 characters (400)', async ({ request }) => {
    const longDescription = 'x'.repeat(2001);

    const response = await request.post(`${API_BASE}/tasks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        title: 'Valid Title',
        description: longDescription,
      },
    });

    expect(response.status()).toBe(400);
    console.log('✅ Task with long description rejected (400)');
  });

  test('should reject task with invalid priority (400)', async ({ request }) => {
    const response = await request.post(`${API_BASE}/tasks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        title: 'Task With Invalid Priority',
        priority: 'INVALID_PRIORITY',
      },
    });

    expect(response.status()).toBe(400);
    console.log('✅ Task with invalid priority rejected (400)');
  });

  test('should reject task creation without authentication (401)', async ({ request }) => {
    const response = await request.post(`${API_BASE}/tasks`, {
      data: {
        title: 'Unauthenticated Task',
      },
    });

    expect(response.status()).toBe(401);
    console.log('✅ Task creation without auth rejected (401)');
  });
});

test.describe('Tasks API - List Tasks (GET /api/tasks)', () => {
  let accessToken: string;
  let taskIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    const email = `list.tasks.${timestamp}@example.com`;
    const password = 'ListTest123!';

    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: { email, password, name: 'List Tasks Test' },
    });

    const body = await registerResponse.json();
    accessToken = body.accessToken;

    // Create multiple tasks for testing
    const tasks = [
      { title: 'Task 1', priority: 'LOW' },
      { title: 'Task 2', priority: 'MEDIUM' },
      { title: 'Task 3', priority: 'HIGH' },
      { title: 'Task 4', priority: 'URGENT' },
    ];

    for (const task of tasks) {
      const createResponse = await request.post(`${API_BASE}/tasks`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: task,
      });
      const createdTask = await createResponse.json();
      taskIds.push(createdTask.id);
    }
  });

  test('should return paginated list of tasks (200)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/tasks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('limit');
    expect(body).toHaveProperty('offset');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.total).toBeGreaterThanOrEqual(body.data.length);

    console.log('✅ Task list returned successfully (200)');
  });

  test('should filter tasks by priority (200)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/tasks?priority=HIGH`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.every((task: any) => task.priority === 'HIGH')).toBe(true);

    console.log('✅ Tasks filtered by priority (200)');
  });

  test('should filter tasks by status (200)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/tasks?status=PENDING`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.every((task: any) => task.status === 'PENDING')).toBe(true);

    console.log('✅ Tasks filtered by status (200)');
  });

  test('should respect pagination limit (200)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/tasks?limit=2`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.limit).toBe(2);
    expect(body.data.length).toBeLessThanOrEqual(2);

    console.log('✅ Pagination limit respected (200)');
  });

  test('should respect pagination offset (200)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/tasks?offset=2`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.offset).toBe(2);

    console.log('✅ Pagination offset respected (200)');
  });

  test('should reject list without authentication (401)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/tasks`);

    expect(response.status()).toBe(401);
    console.log('✅ Task list without auth rejected (401)');
  });
});

test.describe('Tasks API - Get Single Task (GET /api/tasks/:id)', () => {
  let accessToken: string;
  let taskId: string;
  let otherUserAccessToken: string;
  let otherUserTaskId: string;

  test.beforeAll(async ({ request }) => {
    // Create first user and task
    const email = `get.task.${timestamp}@example.com`;
    const password = 'GetTest123!';

    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: { email, password, name: 'Get Task Test' },
    });

    const body = await registerResponse.json();
    accessToken = body.accessToken;

    const createResponse = await request.post(`${API_BASE}/tasks`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { title: 'Test Task for Retrieval' },
    });

    const task = await createResponse.json();
    taskId = task.id;

    // Create second user and task for ownership testing
    const otherEmail = `other.get.task.${timestamp}@example.com`;
    const otherRegisterResponse = await request.post(`${API_BASE}/auth/register`, {
      data: { email: otherEmail, password, name: 'Other User' },
    });

    const otherBody = await otherRegisterResponse.json();
    otherUserAccessToken = otherBody.accessToken;

    const otherCreateResponse = await request.post(`${API_BASE}/tasks`, {
      headers: { Authorization: `Bearer ${otherUserAccessToken}` },
      data: { title: 'Other User Task' },
    });

    const otherTask = await otherCreateResponse.json();
    otherUserTaskId = otherTask.id;
  });

  test('should return task by ID (200)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.id).toBe(taskId);
    expect(body).toHaveProperty('title');
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('priority');

    console.log('✅ Task retrieved by ID (200)');
  });

  test('should return 404 for non-existent task', async ({ request }) => {
    const response = await request.get(`${API_BASE}/tasks/non-existent-id`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(404);
    console.log('✅ Non-existent task returns 404');
  });

  test('should return 404 when accessing another user\'s task', async ({ request }) => {
    const response = await request.get(`${API_BASE}/tasks/${otherUserTaskId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(404);
    console.log('✅ Other user\'s task returns 404 (ownership enforced)');
  });

  test('should reject get task without authentication (401)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/tasks/${taskId}`);

    expect(response.status()).toBe(401);
    console.log('✅ Get task without auth rejected (401)');
  });
});

test.describe('Tasks API - Update Task (PATCH /api/tasks/:id)', () => {
  let accessToken: string;
  let taskId: string;
  let otherUserAccessToken: string;
  let otherUserTaskId: string;

  test.beforeAll(async ({ request }) => {
    // Create first user and task
    const email = `update.task.${timestamp}@example.com`;
    const password = 'UpdateTest123!';

    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: { email, password, name: 'Update Task Test' },
    });

    const body = await registerResponse.json();
    accessToken = body.accessToken;

    const createResponse = await request.post(`${API_BASE}/tasks`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { title: 'Task to Update', priority: 'LOW' },
    });

    const task = await createResponse.json();
    taskId = task.id;

    // Create second user and task for ownership testing
    const otherEmail = `other.update.task.${timestamp}@example.com`;
    const otherRegisterResponse = await request.post(`${API_BASE}/auth/register`, {
      data: { email: otherEmail, password, name: 'Other Update User' },
    });

    const otherBody = await otherRegisterResponse.json();
    otherUserAccessToken = otherBody.accessToken;

    const otherCreateResponse = await request.post(`${API_BASE}/tasks`, {
      headers: { Authorization: `Bearer ${otherUserAccessToken}` },
      data: { title: 'Other User Task for Update' },
    });

    const otherTask = await otherCreateResponse.json();
    otherUserTaskId = otherTask.id;
  });

  test('should update task status (200)', async ({ request }) => {
    const response = await request.patch(`${API_BASE}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        status: 'RUNNING',
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('RUNNING');

    console.log('✅ Task status updated (200)');
  });

  test('should update task priority (200)', async ({ request }) => {
    const response = await request.patch(`${API_BASE}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        priority: 'URGENT',
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.priority).toBe('URGENT');

    console.log('✅ Task priority updated (200)');
  });

  test('should update multiple fields (200)', async ({ request }) => {
    const response = await request.patch(`${API_BASE}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        status: 'COMPLETED',
        priority: 'HIGH',
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('COMPLETED');
    expect(body.priority).toBe('HIGH');

    console.log('✅ Multiple fields updated (200)');
  });

  test('should update error message (200)', async ({ request }) => {
    const response = await request.patch(`${API_BASE}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        status: 'FAILED',
        errorMessage: 'Task failed due to timeout',
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('FAILED');
    expect(body.errorMessage).toBe('Task failed due to timeout');

    console.log('✅ Error message updated (200)');
  });

  test('should return 404 when updating non-existent task', async ({ request }) => {
    const response = await request.patch(`${API_BASE}/tasks/non-existent-id`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        status: 'RUNNING',
      },
    });

    expect(response.status()).toBe(404);
    console.log('✅ Non-existent task update returns 404');
  });

  test('should return 404 when updating another user\'s task', async ({ request }) => {
    const response = await request.patch(`${API_BASE}/tasks/${otherUserTaskId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        status: 'RUNNING',
      },
    });

    expect(response.status()).toBe(404);
    console.log('✅ Other user\'s task update returns 404 (ownership enforced)');
  });

  test('should reject update with invalid status (400)', async ({ request }) => {
    const response = await request.patch(`${API_BASE}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        status: 'INVALID_STATUS',
      },
    });

    expect(response.status()).toBe(400);
    console.log('✅ Invalid status rejected (400)');
  });

  test('should reject update with invalid priority (400)', async ({ request }) => {
    const response = await request.patch(`${API_BASE}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        priority: 'INVALID_PRIORITY',
      },
    });

    expect(response.status()).toBe(400);
    console.log('✅ Invalid priority rejected (400)');
  });

  test('should reject update without authentication (401)', async ({ request }) => {
    const response = await request.patch(`${API_BASE}/tasks/${taskId}`, {
      data: {
        status: 'RUNNING',
      },
    });

    expect(response.status()).toBe(401);
    console.log('✅ Update without auth rejected (401)');
  });
});

test.describe('Tasks API - Delete Task (DELETE /api/tasks/:id)', () => {
  let accessToken: string;
  let taskId: string;
  let otherUserAccessToken: string;
  let otherUserTaskId: string;

  test.beforeAll(async ({ request }) => {
    // Create first user and task
    const email = `delete.task.${timestamp}@example.com`;
    const password = 'DeleteTest123!';

    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: { email, password, name: 'Delete Task Test' },
    });

    const body = await registerResponse.json();
    accessToken = body.accessToken;

    const createResponse = await request.post(`${API_BASE}/tasks`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { title: 'Task to Delete' },
    });

    const task = await createResponse.json();
    taskId = task.id;

    // Create second user and task for ownership testing
    const otherEmail = `other.delete.task.${timestamp}@example.com`;
    const otherRegisterResponse = await request.post(`${API_BASE}/auth/register`, {
      data: { email: otherEmail, password, name: 'Other Delete User' },
    });

    const otherBody = await otherRegisterResponse.json();
    otherUserAccessToken = otherBody.accessToken;

    const otherCreateResponse = await request.post(`${API_BASE}/tasks`, {
      headers: { Authorization: `Bearer ${otherUserAccessToken}` },
      data: { title: 'Other User Task for Delete' },
    });

    const otherTask = await otherCreateResponse.json();
    otherUserTaskId = otherTask.id;
  });

  test('should soft-delete task (204)', async ({ request }) => {
    const response = await request.delete(`${API_BASE}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(204);

    // Verify task is no longer accessible
    const getResponse = await request.get(`${API_BASE}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(getResponse.status()).toBe(404);

    console.log('✅ Task soft-deleted successfully (204)');
  });

  test('should return 404 when deleting non-existent task', async ({ request }) => {
    const response = await request.delete(`${API_BASE}/tasks/non-existent-id`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(404);
    console.log('✅ Non-existent task delete returns 404');
  });

  test('should return 404 when deleting another user\'s task', async ({ request }) => {
    const response = await request.delete(`${API_BASE}/tasks/${otherUserTaskId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(404);
    console.log('✅ Other user\'s task delete returns 404 (ownership enforced)');
  });

  test('should reject delete without authentication (401)', async ({ request }) => {
    // Create a new task for this test
    const createResponse = await request.post(`${API_BASE}/tasks`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { title: 'Task for Auth Test' },
    });

    const task = await createResponse.json();

    const response = await request.delete(`${API_BASE}/tasks/${task.id}`);

    expect(response.status()).toBe(401);
    console.log('✅ Delete without auth rejected (401)');
  });
});

test.describe('Tasks API - Integration Tests', () => {
  let accessToken: string;

  test.beforeAll(async ({ request }) => {
    const email = `integration.task.${timestamp}@example.com`;
    const password = 'IntegrationTest123!';

    const registerResponse = await request.post(`${API_BASE}/auth/register`, {
      data: { email, password, name: 'Integration Test' },
    });

    const body = await registerResponse.json();
    accessToken = body.accessToken;
  });

  test('should complete full task lifecycle (create -> update -> delete)', async ({ request }) => {
    // Create task
    const createResponse = await request.post(`${API_BASE}/tasks`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        title: 'Lifecycle Task',
        description: 'Testing full lifecycle',
        priority: 'MEDIUM',
      },
    });

    expect(createResponse.status()).toBe(201);
    const task = await createResponse.json();
    const taskId = task.id;

    // Update status to RUNNING
    const updateRunningResponse = await request.patch(`${API_BASE}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { status: 'RUNNING' },
    });

    expect(updateRunningResponse.status()).toBe(200);

    // Update status to COMPLETED
    const updateCompletedResponse = await request.patch(`${API_BASE}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { status: 'COMPLETED' },
    });

    expect(updateCompletedResponse.status()).toBe(200);

    // Delete task
    const deleteResponse = await request.delete(`${API_BASE}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(deleteResponse.status()).toBe(204);

    // Verify deletion
    const getResponse = await request.get(`${API_BASE}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(getResponse.status()).toBe(404);

    console.log('✅ Full task lifecycle completed successfully');
  });

  test('should handle multiple tasks per user', async ({ request }) => {
    // Create 5 tasks
    const taskIds: string[] = [];

    for (let i = 1; i <= 5; i++) {
      const createResponse = await request.post(`${API_BASE}/tasks`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          title: `Multi Task ${i}`,
          priority: i % 2 === 0 ? 'HIGH' : 'LOW',
        },
      });

      const task = await createResponse.json();
      taskIds.push(task.id);
    }

    // List all tasks
    const listResponse = await request.get(`${API_BASE}/tasks`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const list = await listResponse.json();
    expect(list.data.length).toBeGreaterThanOrEqual(5);

    console.log('✅ Multiple tasks handled correctly');
  });
});
