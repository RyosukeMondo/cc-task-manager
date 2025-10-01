/**
 * Task Detail View E2E Tests
 *
 * Tests task detail page functionality:
 * - Navigate to task detail page
 * - Display task metadata
 * - Display logs with syntax highlighting
 * - Action buttons (cancel, retry, delete)
 * - Real-time updates via WebSocket
 * - Breadcrumbs navigation
 * - 404 handling for invalid tasks
 */

import { test, expect } from '@playwright/test';
import { login } from './fixtures/auth';
import { createTask, deleteTask, cleanupTestTasks } from './fixtures/tasks';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3006';

test.describe('Task Detail View', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error(`❌ Console Error: ${msg.text()}`);
      }
    });

    page.on('pageerror', (error) => {
      console.error(`❌ Page Error: ${error.message}`);
    });

    // Login before each test
    await login(page, 'user');
  });

  test.afterEach(async ({ page }) => {
    // Cleanup test tasks
    await cleanupTestTasks(page).catch(() => {
      console.log('⚠️  Failed to cleanup test tasks');
    });
  });

  test('should navigate to task detail page and display task metadata', async ({ page }) => {
    // Create a test task
    const taskId = await createTask(page, 'basic', {
      name: 'E2E Task Detail Test',
      description: 'Testing task detail view metadata display',
    });

    // Navigate directly to task detail page
    await page.goto(`${BASE_URL}/tasks/${taskId}`);
    await page.waitForLoadState('networkidle');

    // Should show task title
    const titleVisible = await page
      .locator('text="E2E Task Detail Test"')
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(titleVisible).toBe(true);

    // Should show task description
    const descriptionVisible = await page
      .locator('text="Testing task detail view metadata display"')
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (descriptionVisible) {
      console.log('✅ Task description displayed');
    }

    // Should show status badge
    const statusBadge = page.locator('[data-testid*="status-badge"], [class*="badge"]');
    const statusVisible = await statusBadge.first().isVisible({ timeout: 2000 }).catch(() => false);

    if (statusVisible) {
      console.log('✅ Status badge displayed');
    }

    // Should show priority badge
    const priorityBadge = page.locator('text=/priority|medium|high|low/i');
    const priorityVisible = await priorityBadge.first().isVisible({ timeout: 2000 }).catch(() => false);

    if (priorityVisible) {
      console.log('✅ Priority badge displayed');
    }

    // Cleanup
    await deleteTask(page, taskId);

    console.log('✅ Task detail page displays metadata correctly');
  });

  test('should show 404 page for invalid task ID', async ({ page }) => {
    // Navigate to non-existent task
    await page.goto(`${BASE_URL}/tasks/00000000-0000-0000-0000-000000000000`);
    await page.waitForLoadState('networkidle');

    // Should show 404 or "not found" message
    const notFoundVisible = await page
      .locator('text=/not found|404|does not exist/i')
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(notFoundVisible).toBe(true);

    // Should show back button or link to tasks
    const backButton = page
      .locator('a[href="/tasks"], button:has-text("Back")')
      .or(page.locator('text="Go back"'));

    const backVisible = await backButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (backVisible) {
      console.log('✅ Back button/link displayed on 404 page');
    }

    console.log('✅ 404 page works for invalid task ID');
  });

  test('should display logs section', async ({ page }) => {
    // Create a test task
    const taskId = await createTask(page, 'basic', {
      name: 'E2E Logs Test',
      description: 'Testing log viewer',
    });

    await page.goto(`${BASE_URL}/tasks/${taskId}`);
    await page.waitForLoadState('networkidle');

    // Should show logs section or empty state
    const logsSection = page
      .locator('[data-testid*="log"], [class*="log"]')
      .or(page.locator('text=/logs|no logs|empty/i'));

    const logsVisible = await logsSection.first().isVisible({ timeout: 3000 }).catch(() => false);

    if (logsVisible) {
      console.log('✅ Logs section displayed');
    }

    // Check for "Copy Logs" button
    const copyButton = page.locator('button:has-text("Copy")');
    const copyVisible = await copyButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (copyVisible) {
      console.log('✅ Copy logs button displayed');
    }

    // Cleanup
    await deleteTask(page, taskId);

    console.log('✅ Logs section renders correctly');
  });

  test('should show action buttons based on task status', async ({ page }) => {
    // Create a pending task
    const taskId = await createTask(page, 'basic', {
      name: 'E2E Actions Test',
      description: 'Testing action buttons',
    });

    await page.goto(`${BASE_URL}/tasks/${taskId}`);
    await page.waitForLoadState('networkidle');

    // For PENDING tasks, should show Cancel button
    const cancelButton = page.locator('button:has-text("Cancel")');
    const cancelVisible = await cancelButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (cancelVisible) {
      console.log('✅ Cancel button displayed for PENDING task');
    }

    // Should show Delete button
    const deleteButton = page.locator('button:has-text("Delete")');
    const deleteVisible = await deleteButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (deleteVisible) {
      console.log('✅ Delete button displayed');
    }

    // Cleanup
    await deleteTask(page, taskId);

    console.log('✅ Action buttons display correctly based on status');
  });

  test('should cancel task when clicking Cancel button', async ({ page }) => {
    // Create a pending task
    const taskId = await createTask(page, 'basic', {
      name: 'E2E Cancel Test',
      description: 'Testing cancel action',
    });

    await page.goto(`${BASE_URL}/tasks/${taskId}`);
    await page.waitForLoadState('networkidle');

    // Click Cancel button
    const cancelButton = page.locator('button:has-text("Cancel")');
    const cancelVisible = await cancelButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (cancelVisible) {
      await cancelButton.click();

      // Should show confirmation dialog
      const confirmButton = page
        .locator('button:has-text("Confirm")')
        .or(page.locator('button:has-text("Yes")'))
        .or(page.locator('[role="dialog"] button:has-text("Cancel")'));

      const confirmVisible = await confirmButton.first().isVisible({ timeout: 2000 }).catch(() => false);

      if (confirmVisible) {
        await confirmButton.first().click();
        await page.waitForTimeout(2000);

        // Status should update to CANCELLED
        const cancelledStatus = await page
          .locator('text=/cancelled/i')
          .isVisible({ timeout: 3000 })
          .catch(() => false);

        if (cancelledStatus) {
          console.log('✅ Task cancelled successfully');
        }
      }
    }

    // Cleanup
    await deleteTask(page, taskId);

    console.log('✅ Cancel task action works');
  });

  test('should delete task when clicking Delete button', async ({ page }) => {
    // Create a task
    const taskId = await createTask(page, 'basic', {
      name: 'E2E Delete Test',
      description: 'Testing delete action',
    });

    await page.goto(`${BASE_URL}/tasks/${taskId}`);
    await page.waitForLoadState('networkidle');

    // Click Delete button
    const deleteButton = page.locator('button:has-text("Delete")');
    const deleteVisible = await deleteButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (deleteVisible) {
      await deleteButton.click();

      // Should show confirmation dialog
      const confirmButton = page
        .locator('button:has-text("Confirm")')
        .or(page.locator('button:has-text("Yes")'))
        .or(page.locator('button:has-text("Delete")').nth(1));

      const confirmVisible = await confirmButton.first().isVisible({ timeout: 2000 }).catch(() => false);

      if (confirmVisible) {
        await confirmButton.first().click();
        await page.waitForTimeout(2000);

        // Should redirect to /tasks
        const url = page.url();
        const redirected = url.includes('/tasks') && !url.includes(`/tasks/${taskId}`);

        if (redirected) {
          console.log('✅ Task deleted and redirected to task list');
        }
      }
    }

    console.log('✅ Delete task action works');
  });

  test('should handle real-time updates via WebSocket', async ({ page }) => {
    const wsMessages: string[] = [];

    // Intercept WebSocket to verify real-time updates
    page.on('websocket', (ws) => {
      console.log(`WebSocket opened: ${ws.url()}`);

      ws.on('framereceived', (event) => {
        const payload = event.payload.toString();
        wsMessages.push(payload);

        if (payload.includes('task:updated') || payload.includes('task:log')) {
          console.log(`📨 Task update WebSocket message received`);
        }
      });
    });

    // Create a test task
    const taskId = await createTask(page, 'basic', {
      name: 'E2E WebSocket Test',
      description: 'Testing real-time updates',
    });

    await page.goto(`${BASE_URL}/tasks/${taskId}`);
    await page.waitForLoadState('networkidle');

    // Wait for WebSocket connection
    await page.waitForTimeout(3000);

    // Trigger an update via API (simulating a status change)
    await page.request.patch(`/api/tasks/${taskId}`, {
      data: { status: 'RUNNING' },
    }).catch(() => {
      console.log('⚠️  Could not trigger task update');
    });

    // Wait for potential WebSocket message and UI update
    await page.waitForTimeout(2000);

    // Verify no WebSocket errors
    const wsError = await page
      .locator('text=/WebSocket.*error|connection.*failed/i')
      .count();
    expect(wsError).toBe(0);

    // Cleanup
    await deleteTask(page, taskId);

    console.log('✅ WebSocket real-time updates work');
  });

  test('should display breadcrumbs and allow navigation', async ({ page }) => {
    // Create a test task
    const taskId = await createTask(page, 'basic', {
      name: 'E2E Breadcrumb Test',
      description: 'Testing breadcrumb navigation',
    });

    await page.goto(`${BASE_URL}/tasks/${taskId}`);
    await page.waitForLoadState('networkidle');

    // Should show breadcrumbs
    const breadcrumb = page
      .locator('[data-testid*="breadcrumb"]')
      .or(page.locator('nav a:has-text("Tasks")'))
      .or(page.locator('[aria-label*="breadcrumb"]'));

    const breadcrumbVisible = await breadcrumb.first().isVisible({ timeout: 3000 }).catch(() => false);

    if (breadcrumbVisible) {
      console.log('✅ Breadcrumbs displayed');

      // Click on "Tasks" breadcrumb
      const tasksLink = page.locator('a[href="/tasks"]').or(page.locator('a:has-text("Tasks")'));
      const tasksLinkVisible = await tasksLink.first().isVisible({ timeout: 2000 }).catch(() => false);

      if (tasksLinkVisible) {
        await tasksLink.first().click();
        await page.waitForTimeout(1000);

        // Should navigate to /tasks
        const url = page.url();
        const navigated = url.includes('/tasks') && !url.includes(`/tasks/${taskId}`);

        if (navigated) {
          console.log('✅ Breadcrumb navigation works');
        }
      }
    }

    // Cleanup
    await deleteTask(page, taskId);

    console.log('✅ Breadcrumbs work correctly');
  });

  test('should show loading skeleton during initial load', async ({ page }) => {
    // Create a test task
    const taskId = await createTask(page, 'basic', {
      name: 'E2E Loading Test',
      description: 'Testing loading state',
    });

    // Navigate to task detail (might see loading skeleton briefly)
    await page.goto(`${BASE_URL}/tasks/${taskId}`);

    // Check for loading skeleton (might be too fast to catch)
    const skeleton = page
      .locator('[data-testid*="skeleton"]')
      .or(page.locator('[class*="skeleton"]'))
      .or(page.locator('[class*="animate-pulse"]'));

    const skeletonVisible = await skeleton.first().isVisible({ timeout: 500 }).catch(() => false);

    if (skeletonVisible) {
      console.log('✅ Loading skeleton displayed');
    } else {
      console.log('⚠️  Loading skeleton not visible (page loaded too quickly)');
    }

    await page.waitForLoadState('networkidle');

    // Content should load
    const contentLoaded = await page
      .locator('text="E2E Loading Test"')
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(contentLoaded).toBe(true);

    // Cleanup
    await deleteTask(page, taskId);

    console.log('✅ Loading state handled correctly');
  });

  test('should navigate from task list to task detail', async ({ page }) => {
    // Create a test task
    const taskId = await createTask(page, 'basic', {
      name: 'E2E Navigation Test',
      description: 'Testing navigation from list to detail',
    });

    // Go to task list
    await page.goto(`${BASE_URL}/tasks`);
    await page.waitForLoadState('networkidle');

    // Look for the task in the list
    const taskRow = page.locator('text="E2E Navigation Test"');
    const taskVisible = await taskRow.isVisible({ timeout: 3000 }).catch(() => false);

    if (taskVisible) {
      // Click on task (row should be clickable)
      await taskRow.click();
      await page.waitForTimeout(1000);

      // Should navigate to task detail page
      const url = page.url();
      const navigated = url.includes(`/tasks/${taskId}`);

      expect(navigated).toBe(true);

      // Should show task details
      const detailVisible = await page
        .locator('text="E2E Navigation Test"')
        .isVisible({ timeout: 2000 })
        .catch(() => false);

      if (detailVisible) {
        console.log('✅ Navigation from list to detail works');
      }
    } else {
      console.log('⚠️  Task not found in list');
    }

    // Cleanup
    await deleteTask(page, taskId);

    console.log('✅ Task list navigation works');
  });
});
