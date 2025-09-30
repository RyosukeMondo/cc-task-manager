# Requirements Document - Tasks Active Page

## Introduction

The active tasks page (/tasks/active) displays only tasks that are currently in active/running status, helping users focus on their ongoing work.

## Alignment with Product Vision

Supports focused task management by filtering tasks to show only active work, improving productivity and reducing cognitive load.

## Requirements

### Requirement 1: Display Active Tasks Only

**User Story:** As a user, I want to see only my active tasks, so that I can focus on work in progress.

#### Acceptance Criteria

1. WHEN I navigate to /tasks/active THEN I SHALL see only tasks with "active" status
2. WHEN no active tasks exist THEN I SHALL see an empty state
3. WHEN a task becomes active THEN it SHALL appear in the list automatically
4. WHEN a task is completed THEN it SHALL be removed from the list automatically

### Requirement 2: Page Context

**User Story:** As a user, I want clear indication that I'm viewing active tasks, so that I understand the context.

#### Acceptance Criteria

1. WHEN I am on the page THEN I SHALL see "Active Tasks" as the title
2. WHEN viewing the page THEN I SHALL see active task count
3. WHEN sidebar link is clicked THEN /tasks/active SHALL load without 404 error

## Non-Functional Requirements

### Code Architecture and Modularity
- Reuse TaskList component with active filter
- Page component handles only routing and filter configuration

### Performance
- Fast filtering (no client-side filtering of large datasets)
- Real-time updates via WebSocket

### Accessibility
- Clear page title and navigation context
- Keyboard accessible

### Usability
- Consistent with /tasks page layout
- Responsive design