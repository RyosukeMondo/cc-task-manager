# Design Document - Tasks Completed Page

## Overview

Next.js page at /tasks/completed that displays only completed tasks using the TaskList component with status filter and completion date sorting.

## Steering Document Alignment

### Technical Standards (tech.md)
- Next.js 14+ App Router
- TypeScript strict mode
- Server Components

### Project Structure (structure.md)
- Page location: `apps/frontend/src/app/tasks/completed/page.tsx`

## Code Reuse Analysis

### Existing Components to Leverage
- **TaskList component**: Pass `initialFilter={{ status: 'completed' }}` with sort by completion date
- **Page layout**: Similar to tasks/page.tsx structure

## Architecture

```mermaid
graph TD
    A[tasks/completed/page.tsx] --> B[Page Header: "Completed Tasks"]
    A --> C[TaskList with status='completed' filter]
```

## Components and Interfaces

### TasksCompletedPage Component
- **Purpose:** Page component for /tasks/completed route
- **Type:** React Server Component
- **Dependencies:** TaskList component with completed filter
- **Reuses:** TaskList, page layout patterns

## Testing Strategy

- Unit test: Page renders with correct filter and sort
- Integration test: Only completed tasks displayed, sorted correctly
- E2E test: Navigation and completed view work