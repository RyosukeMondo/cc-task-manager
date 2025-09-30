/**
 * Task fixtures and helpers for E2E tests
 */

import { Page } from '@playwright/test';

/**
 * Sample task data for testing
 */
export const SAMPLE_TASKS = {
  basic: {
    name: 'Test Task',
    description: 'This is a test task',
    priority: 'medium',
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  },
  urgent: {
    name: 'Urgent Test Task',
    description: 'This task needs immediate attention',
    priority: 'high',
    dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // tomorrow
  },
  lowPriority: {
    name: 'Low Priority Task',
    description: 'This can wait',
    priority: 'low',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  },
} as const;

export type TaskTemplate = keyof typeof SAMPLE_TASKS;

/**
 * Create a task via API for faster test setup
 */
export async function createTask(
  page: Page,
  template: TaskTemplate = 'basic',
  overrides?: Partial<typeof SAMPLE_TASKS.basic>
): Promise<string> {
  const taskData = { ...SAMPLE_TASKS[template], ...overrides };

  const response = await page.request.post('/api/tasks', {
    data: taskData,
  });

  if (!response.ok()) {
    throw new Error(`Failed to create task: ${response.status()}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Delete a task via API for test cleanup
 */
export async function deleteTask(page: Page, taskId: string): Promise<void> {
  const response = await page.request.delete(`/api/tasks/${taskId}`);

  if (!response.ok() && response.status() !== 404) {
    throw new Error(`Failed to delete task: ${response.status()}`);
  }
}

/**
 * Get all tasks via API
 */
export async function getTasks(page: Page): Promise<any[]> {
  const response = await page.request.get('/api/tasks');

  if (!response.ok()) {
    throw new Error(`Failed to get tasks: ${response.status()}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.tasks || [];
}

/**
 * Clean up all test tasks
 */
export async function cleanupTestTasks(page: Page): Promise<void> {
  const tasks = await getTasks(page);
  const testTasks = tasks.filter(
    (task) => task.name?.includes('Test Task') || task.name?.includes('E2E Test')
  );

  for (const task of testTasks) {
    await deleteTask(page, task.id).catch(() => {
      // Ignore errors during cleanup
    });
  }
}
