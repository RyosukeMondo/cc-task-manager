# E2E Tests

This directory contains end-to-end tests for the CC Task Manager frontend using Playwright.

## Setup

1. Install Playwright:
   ```bash
   pnpm add -D @playwright/test
   ```

2. Install browsers:
   ```bash
   pnpm exec playwright install
   ```

## Running Tests

### Run all E2E tests:
```bash
pnpm test:e2e
```

### Run tests in UI mode (interactive):
```bash
pnpm test:e2e:ui
```

### Run tests in debug mode:
```bash
pnpm test:e2e:debug
```

### View test report:
```bash
pnpm test:e2e:report
```

## Test Structure

- `tasks-page.spec.ts` - E2E tests for the tasks page, covering:
  - Navigation from sidebar and top navigation
  - Page rendering and layout
  - Task list display
  - Real-time updates via WebSocket
  - Create task button interaction
  - Empty state handling
  - Responsive design
  - Accessibility (keyboard navigation)

## Prerequisites

Before running E2E tests, ensure:
1. Development server is running on port 3006 (or configure BASE_URL)
2. Backend server is available with WebSocket support
3. All dependencies are installed

## Configuration

The Playwright configuration is in `playwright.config.ts` at the frontend root.

Key settings:
- Base URL: `http://localhost:3006`
- Test directory: `./e2e`
- Test match pattern: `**/*.spec.ts`
- Web server auto-start: Enabled

## CI/CD

In CI environments:
- Tests run with 2 retries
- Single worker mode for stability
- Screenshots and videos captured on failure