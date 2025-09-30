# Design Document - Tasks Active Page

## Overview

Next.js page at /tasks/active that displays only active tasks using the TaskList component with status filter.

## Steering Document Alignment

### Technical Standards (tech.md)
- Next.js 14+ App Router
- TypeScript strict mode
- Server Components

### Project Structure (structure.md)
- Page location: `apps/frontend/src/app/tasks/active/page.tsx`

## Code Reuse Analysis

### Existing Components to Leverage
- **TaskList component**: Pass `initialFilter={{ status: 'active' }}`
- **Page layout**: Similar to tasks/page.tsx structure

## Architecture

Simple page that configures TaskList with active filter:

```mermaid
graph TD
    A[tasks/active/page.tsx] --> B[Page Header: "Active Tasks"]
    A --> C[TaskList with status='active' filter]
```

## Components and Interfaces

### TasksActivePage Component
- **Purpose:** Page component for /tasks/active route
- **Type:** React Server Component
- **Dependencies:** TaskList component with active filter
- **Reuses:** TaskList, page layout patterns

## Testing Strategy

- Unit test: Page renders with correct filter
- Integration test: Only active tasks displayed
- E2E test: Navigation and filtering work