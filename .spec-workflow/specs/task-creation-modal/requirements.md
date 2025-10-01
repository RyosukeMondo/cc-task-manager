# Requirements Document - Task Creation Modal

## Introduction

The Task Creation Modal provides a user interface for creating new Claude Code tasks through a dialog/modal component with form validation. This feature replaces the current "Create Task" button that only logs to console, enabling users to actually create tasks via the UI.

**Purpose**: Implement a task creation dialog with validated form inputs that calls POST /api/tasks and provides user feedback.

**Value**: Enables users to create tasks through the UI (currently impossible), unblocks core product functionality, and provides polished user experience with validation and error handling.

## Alignment with Product Vision

From `product.md`:
- **"AI Task Management"**: Users can create Claude Code tasks through intuitive UI
- **"User-Friendly Interface"**: Form validation prevents invalid submissions
- **"Real-time Feedback"**: Optimistic UI updates show task immediately while API processes

This spec addresses the critical gap: "Task creation UI completely missing - 'Create Task' button just logs to console" (from IMPLEMENTATION_GAP_ANALYSIS.md)

## Requirements

### Requirement 1: Modal Trigger and Display

**User Story:** As a user, I want to click "Create Task" button to open a modal, so that I can add a new task

#### Acceptance Criteria (EARS)

1. WHEN user clicks "Create Task" button THEN system SHALL open task creation modal/dialog
2. WHEN modal opens THEN system SHALL display form with empty fields (reset state)
3. WHEN modal is open THEN system SHALL block interaction with underlying page (modal overlay)
4. WHEN user clicks outside modal or presses Escape THEN system SHALL close modal without saving
5. WHEN modal closes THEN system SHALL reset form to initial state

### Requirement 2: Form Fields and Validation

**User Story:** As a user, I want a form with validation, so that I don't submit invalid task data

#### Acceptance Criteria (EARS)

1. WHEN form is displayed THEN system SHALL show fields: title (required), description (optional), priority (select), tags (multi-input)
2. WHEN user submits without title THEN system SHALL display error "Title is required"
3. WHEN title exceeds 200 characters THEN system SHALL display error "Title must be 200 characters or less"
4. WHEN description exceeds 2000 characters THEN system SHALL display error "Description is too long"
5. WHEN priority field is shown THEN system SHALL provide options: LOW, MEDIUM, HIGH, URGENT
6. WHEN validation fails THEN system SHALL focus first invalid field
7. WHEN all required fields are valid THEN system SHALL enable Submit button

### Requirement 3: Task Submission

**User Story:** As a user, I want to submit the form and see the task created, so that I can start managing it

#### Acceptance Criteria (EARS)

1. WHEN user clicks Submit with valid data THEN system SHALL call POST /api/tasks with form values
2. WHEN submission is in progress THEN system SHALL disable Submit button and show loading spinner
3. WHEN API returns 201 Created THEN system SHALL add task to task list optimistically
4. WHEN submission succeeds THEN system SHALL close modal automatically
5. WHEN submission succeeds THEN system SHALL display success toast notification
6. WHEN optimistic update is applied THEN system SHALL show task with status PENDING

### Requirement 4: Error Handling

**User Story:** As a user, I want to see clear error messages when task creation fails, so that I can correct issues

#### Acceptance Criteria (EARS)

1. WHEN API returns 400 Bad Request THEN system SHALL display validation errors next to relevant fields
2. WHEN API returns 401 Unauthorized THEN system SHALL redirect to login page
3. WHEN API returns 500 Internal Server Error THEN system SHALL display toast "Failed to create task. Please try again."
4. WHEN network error occurs THEN system SHALL display toast "Network error. Check your connection."
5. WHEN submission fails THEN system SHALL keep modal open with form data intact
6. WHEN submission fails THEN system SHALL re-enable Submit button for retry

### Requirement 5: User Experience Polish

**User Story:** As a user, I want smooth interactions and visual feedback, so that the UI feels responsive and professional

#### Acceptance Criteria (EARS)

1. WHEN modal opens THEN system SHALL focus title field automatically
2. WHEN user types in title field THEN system SHALL show character count (e.g., "45/200")
3. WHEN user presses Enter in title field THEN system SHALL move focus to description (not submit)
4. WHEN user presses Ctrl+Enter anywhere in form THEN system SHALL submit form
5. WHEN validation error appears THEN system SHALL animate error message (fade in)
6. WHEN optimistic task is added THEN system SHALL highlight it briefly (background flash)

## Non-Functional Requirements

### Code Architecture and Modularity
- **Single Responsibility Principle**: Separate TaskCreateDialog (modal/overlay), TaskCreateForm (form logic), useCreateTask (API mutation)
- **Modular Design**: Components isolated in `src/components/tasks/` with clear props interfaces
- **Dependency Management**: Use react-hook-form, Zod, TanStack Query
- **Clear Interfaces**: Props typed with TypeScript, form schema with Zod
- **File Ownership**: This spec owns `TaskCreateDialog.tsx`, `TaskCreateForm.tsx`, edits to `useCreateTask.ts`

### Contract-Driven Development
- **Schema First**: Use Zod schema from `@cc-task-manager/schemas/src/task.schema.ts`
- **SSOT**: Frontend form validation uses same schema as backend API validation
- **API Contract**: POST /api/tasks matches contract-client.ts method signature
- **Type Safety**: react-hook-form typed with schema-generated types

### Performance
- **Render Optimization**: Use React.memo for form fields to prevent unnecessary re-renders
- **Debouncing**: Debounce validation (300ms) to avoid excessive error messages while typing
- **Bundle Size**: Use dynamic import for modal (code splitting)
- **Optimistic UI**: Show task immediately without waiting for server response

### Security
- **Input Sanitization**: Zod schema strips potentially dangerous HTML from text inputs
- **XSS Prevention**: Never use dangerouslySetInnerHTML for user-provided content
- **CSRF Protection**: Not required (JWT in Authorization header, not cookies)

### Reliability
- **Error Recovery**: Failed submissions keep form data intact for retry
- **Network Resilience**: Retry logic with exponential backoff (handled by TanStack Query)
- **Offline Support**: Show clear message when network unavailable
- **Validation Consistency**: Frontend validation matches backend exactly (shared schema)

### Usability
- **Keyboard Navigation**: Full support for Tab, Enter, Escape keys
- **Screen Reader Support**: ARIA labels on all form fields
- **Error Messages**: User-friendly messages in plain language
- **Visual Feedback**: Loading states, success animations, error highlights
- **Mobile Responsive**: Modal adapts to small screens (bottom sheet on mobile)

### Accessibility
- **Focus Management**: Trap focus within modal when open
- **ARIA Attributes**: role="dialog", aria-labelledby, aria-describedby
- **Keyboard-Only Navigation**: All actions accessible without mouse
- **Color Contrast**: Error messages meet WCAG AA standards

### Testing
- **E2E Tests**: `apps/frontend/e2e/task-create.spec.ts` validates full user flow
- **Test Coverage**: Modal open/close, form validation, submission success/failure, keyboard navigation
- **Visual Regression**: Screenshots for modal appearance

### Environment-Driven Configuration
- **Feature Flag**: `NEXT_PUBLIC_TASK_CREATE_ENABLED=true` to show/hide Create button
- **Validation**: No env variables (use shared Zod schema)

## Success Criteria

- ✅ "Create Task" button opens modal (not console.log)
- ✅ Users can successfully create tasks via UI
- ✅ Form validation prevents invalid submissions
- ✅ Error messages guide users to correct issues
- ✅ Optimistic UI makes interface feel instant
- ✅ Keyboard navigation works perfectly
- ✅ E2E tests validate complete user flow

## Dependencies

**Blocked By**:
- `backend-tasks-api` - Requires POST /api/tasks endpoint

**Blocks**: None (independent feature)

**Shared Files** (Edit carefully):
- `apps/frontend/src/app/tasks/page.tsx` - Wire up modal trigger button (minimal change)
- `apps/frontend/src/hooks/useCreateTask.ts` - Add error handling + optimistic updates (enhance existing)
- `apps/frontend/src/components/layout/Navigation.tsx` - Optional: add keyboard shortcut hint
