/**
 * E2E Test for Task Creation Flow
 *
 * This test validates the complete task creation user flow including:
 * 1. Opening the modal by clicking "Create Task" button
 * 2. Form validation (required fields, character limits)
 * 3. Successful task creation with toast notification
 * 4. Optimistic UI updates
 * 5. Error handling (API errors keep modal open)
 * 6. Keyboard shortcuts (Ctrl+Enter, Escape)
 * 7. Mobile responsiveness (Sheet on small screens)
 * 8. Accessibility features
 */

import { test, expect, type Page } from '@playwright/test';
import { setupAuthenticatedSession } from './fixtures/auth';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3006';
const TASKS_PAGE_URL = `${BASE_URL}/tasks`;

test.describe('Task Creation Modal E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authenticated session
    await setupAuthenticatedSession(page, 'user');

    // Navigate to tasks page
    await page.goto(TASKS_PAGE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('should open modal when clicking "Create Task" button', async ({ page }) => {
    // Click the Create Task button
    const createButton = page.getByRole('button', { name: /create task/i });
    await expect(createButton).toBeVisible();
    await createButton.click();

    // Verify modal is open by checking for the title
    const modalTitle = page.getByRole('heading', { name: /create new task/i });
    await expect(modalTitle).toBeVisible();

    // Verify form fields are present
    await expect(page.locator('#title')).toBeVisible();
    await expect(page.locator('#description')).toBeVisible();
    await expect(page.locator('#priority')).toBeVisible();
  });

  test('should show error when submitting without title', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForSelector('#title', { state: 'visible' });

    // Try to submit without entering title
    const submitButton = page.getByRole('button', { name: /^create task$/i });
    await submitButton.click();

    // Verify error message appears
    const errorMessage = page.locator('#title-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/required/i);
  });

  test('should show error when title exceeds 200 characters', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForSelector('#title', { state: 'visible' });

    // Enter title with more than 200 characters
    const longTitle = 'a'.repeat(201);
    await page.fill('#title', longTitle);

    // Verify error message appears
    const errorMessage = page.locator('#title-error');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText(/200 characters or less/i);
  });

  test('should show character count for title field', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForSelector('#title', { state: 'visible' });

    // Enter some text
    await page.fill('#title', 'Test task');

    // Verify character count is displayed (9/200)
    const characterCount = page.locator('text=/\\d+\\/200/');
    await expect(characterCount).toBeVisible();
    await expect(characterCount).toContainText('9/200');
  });

  test('should create task successfully with valid data', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForSelector('#title', { state: 'visible' });

    // Fill in the form
    const taskTitle = `E2E Test Task ${Date.now()}`;
    await page.fill('#title', taskTitle);
    await page.fill('#description', 'This is a test task created by E2E test');

    // Select priority
    await page.click('#priority');
    await page.click('text=High');

    // Submit the form
    const submitButton = page.getByRole('button', { name: /^create task$/i });
    await submitButton.click();

    // Wait for success toast
    const successToast = page.locator('text=/task created successfully/i');
    await expect(successToast).toBeVisible({ timeout: 5000 });

    // Verify modal closes
    const modalTitle = page.getByRole('heading', { name: /create new task/i });
    await expect(modalTitle).not.toBeVisible();

    // Verify task appears in the list
    await page.waitForTimeout(1000); // Wait for list to update
    const taskItem = page.locator(`text=${taskTitle}`);
    await expect(taskItem).toBeVisible();
  });

  test('should show optimistic UI update (task appears immediately)', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForSelector('#title', { state: 'visible' });

    // Fill and submit
    const taskTitle = `Optimistic Test ${Date.now()}`;
    await page.fill('#title', taskTitle);

    const submitButton = page.getByRole('button', { name: /^create task$/i });

    // Start listening for task in list before submitting
    const taskPromise = page.waitForSelector(`text=${taskTitle}`, { timeout: 2000 });

    await submitButton.click();

    // Task should appear quickly (optimistic update)
    await taskPromise;

    // Verify it's visible
    const taskItem = page.locator(`text=${taskTitle}`);
    await expect(taskItem).toBeVisible();
  });

  test('should keep modal open on API error and show error toast', async ({ page }) => {
    // Intercept API call and force it to fail
    await page.route('**/api/tasks', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal server error' }),
      });
    });

    // Open modal
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForSelector('#title', { state: 'visible' });

    // Fill and submit
    await page.fill('#title', 'Test task for error');
    const submitButton = page.getByRole('button', { name: /^create task$/i });
    await submitButton.click();

    // Wait for error toast
    const errorToast = page.locator('text=/failed to create task/i');
    await expect(errorToast).toBeVisible({ timeout: 5000 });

    // Verify modal is still open (form data preserved)
    const modalTitle = page.getByRole('heading', { name: /create new task/i });
    await expect(modalTitle).toBeVisible();

    // Verify form still has the data
    const titleInput = page.locator('#title');
    await expect(titleInput).toHaveValue('Test task for error');
  });

  test('should submit form with Ctrl+Enter keyboard shortcut', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForSelector('#title', { state: 'visible' });

    // Fill in title
    const taskTitle = `Keyboard Test ${Date.now()}`;
    await page.fill('#title', taskTitle);

    // Press Ctrl+Enter to submit
    await page.keyboard.press('Control+Enter');

    // Wait for success toast
    const successToast = page.locator('text=/task created successfully/i');
    await expect(successToast).toBeVisible({ timeout: 5000 });

    // Verify modal closes
    const modalTitle = page.getByRole('heading', { name: /create new task/i });
    await expect(modalTitle).not.toBeVisible();
  });

  test('should close modal with Escape key', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForSelector('#title', { state: 'visible' });

    // Verify modal is open
    const modalTitle = page.getByRole('heading', { name: /create new task/i });
    await expect(modalTitle).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Verify modal closes
    await expect(modalTitle).not.toBeVisible();
  });

  test('should move focus from title to description on Enter key', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForSelector('#title', { state: 'visible' });

    // Focus should be on title (auto-focus)
    await expect(page.locator('#title')).toBeFocused();

    // Press Enter in title field
    await page.keyboard.press('Enter');

    // Focus should move to description
    await expect(page.locator('#description')).toBeFocused();
  });

  test('should use Sheet on mobile screens', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Open modal
    await page.getByRole('button', { name: /create task/i }).click();

    // Wait for sheet to open
    await page.waitForTimeout(500);

    // Verify Sheet is used (it should have specific positioning)
    const sheetContent = page.locator('[role="dialog"]').or(page.locator('.sheet-content'));
    await expect(sheetContent).toBeVisible();

    // Verify form is still accessible
    await expect(page.locator('#title')).toBeVisible();
  });

  test('should have proper ARIA labels and accessibility', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForSelector('#title', { state: 'visible' });

    // Verify ARIA labels
    const titleInput = page.locator('#title');
    await expect(titleInput).toHaveAttribute('aria-label', /task title/i);
    await expect(titleInput).toHaveAttribute('aria-required', 'true');

    const descriptionInput = page.locator('#description');
    await expect(descriptionInput).toHaveAttribute('aria-label', /task description/i);

    const prioritySelect = page.locator('#priority');
    await expect(prioritySelect).toHaveAttribute('aria-label', /task priority/i);
  });

  test('should announce validation errors to screen readers', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForSelector('#title', { state: 'visible' });

    // Submit without title to trigger error
    const submitButton = page.getByRole('button', { name: /^create task$/i });
    await submitButton.click();

    // Verify error has role="alert" for screen reader announcement
    const errorMessage = page.locator('#title-error');
    await expect(errorMessage).toHaveAttribute('role', 'alert');
    await expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
  });

  test('should disable submit button when form is invalid', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForSelector('#title', { state: 'visible' });

    // Submit button should be disabled when title is empty
    const submitButton = page.getByRole('button', { name: /^create task$/i });
    await expect(submitButton).toBeDisabled();

    // Enter valid title
    await page.fill('#title', 'Valid task title');

    // Submit button should be enabled
    await expect(submitButton).toBeEnabled();
  });

  test('should show loading state while creating task', async ({ page }) => {
    // Slow down network to see loading state
    await page.route('**/api/tasks', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      route.continue();
    });

    // Open modal and fill form
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForSelector('#title', { state: 'visible' });
    await page.fill('#title', 'Loading test task');

    // Submit
    const submitButton = page.getByRole('button', { name: /^create task$/i });
    await submitButton.click();

    // Verify loading state
    const loadingButton = page.getByRole('button', { name: /creating/i });
    await expect(loadingButton).toBeVisible();

    // Verify spinner is visible
    const spinner = page.locator('.animate-spin');
    await expect(spinner).toBeVisible();

    // Wait for completion
    await page.waitForTimeout(1500);
  });

  test('should reset form after successful creation', async ({ page }) => {
    // Open modal
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForSelector('#title', { state: 'visible' });

    // Fill form
    await page.fill('#title', `Reset Test ${Date.now()}`);
    await page.fill('#description', 'Test description');

    // Submit
    const submitButton = page.getByRole('button', { name: /^create task$/i });
    await submitButton.click();

    // Wait for modal to close
    await page.waitForTimeout(1000);

    // Open modal again
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForSelector('#title', { state: 'visible' });

    // Verify form is reset
    await expect(page.locator('#title')).toHaveValue('');
    await expect(page.locator('#description')).toHaveValue('');
  });

  test('should handle 401 Unauthorized by redirecting to login', async ({ page }) => {
    // Intercept API call and return 401
    await page.route('**/api/tasks', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
      });
    });

    // Open modal and submit
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForSelector('#title', { state: 'visible' });
    await page.fill('#title', 'Unauthorized test');

    const submitButton = page.getByRole('button', { name: /^create task$/i });
    await submitButton.click();

    // Should redirect to login
    await page.waitForURL(/\/login/, { timeout: 5000 });
    expect(page.url()).toContain('/login');
  });

  test('complete task creation flow', async ({ page }) => {
    // Step 1: Navigate to tasks page
    await expect(page.locator('h1')).toContainText('All Tasks');

    // Step 2: Click Create Task button
    const createButton = page.getByRole('button', { name: /create task/i });
    await createButton.click();

    // Step 3: Verify modal opens
    const modalTitle = page.getByRole('heading', { name: /create new task/i });
    await expect(modalTitle).toBeVisible();

    // Step 4: Fill form with valid data
    const taskTitle = `Complete Flow Test ${Date.now()}`;
    await page.fill('#title', taskTitle);
    await page.fill('#description', 'End-to-end test for complete task creation flow');
    await page.click('#priority');
    await page.click('text=Urgent');

    // Step 5: Submit form
    const submitButton = page.getByRole('button', { name: /^create task$/i });
    await submitButton.click();

    // Step 6: Verify success toast
    const successToast = page.locator('text=/task created successfully/i');
    await expect(successToast).toBeVisible({ timeout: 5000 });

    // Step 7: Verify modal closes
    await expect(modalTitle).not.toBeVisible();

    // Step 8: Verify task appears in list
    await page.waitForTimeout(1000);
    const taskItem = page.locator(`text=${taskTitle}`);
    await expect(taskItem).toBeVisible();

    // Step 9: Verify can open modal again
    await createButton.click();
    await expect(modalTitle).toBeVisible();

    // Step 10: Verify form is reset
    await expect(page.locator('#title')).toHaveValue('');
  });
});
