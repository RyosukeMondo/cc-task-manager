# Tasks - Task Creation Modal

## Task Checklist

### Phase 1: Components (3 tasks)

- [ ] 1. Create TaskCreateDialog component (modal wrapper)
  - File: apps/frontend/src/components/tasks/TaskCreateDialog.tsx
  - Use shadcn/ui Dialog component
  - Props: open (boolean), onOpenChange (callback)
  - Desktop: Dialog centered (max-width 600px)
  - Mobile: Sheet from bottom (90vh height)
  - Use useMediaQuery to switch between Dialog and Sheet responsively
  - Auto-focus title field when dialog opens
  - Close on Escape key
  - Purpose: Create responsive modal wrapper for task creation form
  - _Leverage: shadcn/ui Dialog and Sheet components, useMediaQuery hook_
  - _Requirements: 1, 5_
  - _Prompt: Role: Frontend developer with React and shadcn/ui expertise | Task: Create TaskCreateDialog responsive component following requirements 1 and 5, switching between Dialog and Sheet based on screen size | Restrictions: Do not use custom modal implementation, use shadcn/ui components | Success: Dialog opens/closes correctly and is responsive on mobile_

- [ ] 2. Create TaskCreateForm component (form logic)
  - File: apps/frontend/src/components/tasks/TaskCreateForm.tsx
  - Use react-hook-form with zodResolver(createTaskSchema)
  - Fields: title (Input, required, max 200), description (Textarea, optional, max 2000), priority (Select, default MEDIUM)
  - Real-time validation (mode: 'onChange')
  - Character count for title (e.g., 45/200)
  - Keyboard shortcuts: Ctrl+Enter to submit, Enter in title moves to description (not submit)
  - Submit button disabled when form invalid or submitting
  - Loading state: Show spinner and "Creating..." text
  - Props: onSuccess (callback), onCancel (callback)
  - Purpose: Implement validated task creation form with UX enhancements
  - _Leverage: react-hook-form, Zod validation, shadcn/ui form components_
  - _Requirements: 2, 3, 5_
  - _Prompt: Role: Frontend developer with forms expertise | Task: Create TaskCreateForm with real-time validation following requirements 2, 3, and 5, implementing keyboard shortcuts and character counting | Restrictions: Do not skip validation, enforce character limits | Success: Form validates correctly and keyboard shortcuts work_

- [ ] 3. Add Zod validation (use shared schema)
  - File: packages/schemas/src/task.schema.ts (verify exists), apps/frontend/src/components/tasks/TaskCreateForm.tsx
  - Use createTaskSchema from shared schemas package: title (min 1, max 200), description (max 2000, optional or empty string), priority (enum, default MEDIUM)
  - Ensure schema is exported from packages/schemas/src/index.ts
  - Import schema in TaskCreateForm
  - Purpose: Use contract-driven validation ensuring frontend and backend validation match
  - _Leverage: Shared Zod schemas from @cc-task-manager/schemas_
  - _Requirements: 2_
  - _Prompt: Role: TypeScript developer with schema validation expertise | Task: Integrate createTaskSchema from shared package following requirement 2, ensuring frontend and backend use identical validation | Restrictions: Do not create duplicate schemas, use shared package | Success: Frontend and backend use identical validation_

### Phase 2: API Integration (2 tasks)

- [ ] 4. Enhance useCreateTask hook (add optimistic updates)
  - File: apps/frontend/src/hooks/useCreateTask.ts
  - Use useMutation from @tanstack/react-query
  - mutationFn: calls apiClient.createTask(data)
  - onMutate: Add optimistic task to query cache with temp ID (temp-${Date.now()}), status PENDING
  - onError: Rollback to previous state
  - onSuccess: Replace optimistic task with real task from server, invalidate ['tasks'] query
  - Return: { mutate, isPending, error }
  - Purpose: Implement optimistic UI updates for instant feedback on task creation
  - _Leverage: TanStack Query mutations with optimistic updates_
  - _Requirements: 3_
  - _Prompt: Role: Frontend developer with TanStack Query expertise | Task: Enhance useCreateTask hook with optimistic updates following requirement 3, showing task immediately before server response | Restrictions: Do not skip rollback on error, always revert optimistic updates on failure | Success: Optimistic updates work and task appears instantly_

- [ ] 5. Wire up modal trigger in tasks page
  - File: apps/frontend/src/app/tasks/page.tsx
  - Add state: const [createDialogOpen, setCreateDialogOpen] = useState(false)
  - Update "Create Task" button onClick to setCreateDialogOpen(true) (replace console.log)
  - Render <TaskCreateResponsive open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
  - Import TaskCreateResponsive component
  - Purpose: Connect modal to "Create Task" button replacing console.log placeholder
  - _Leverage: React state management, TaskCreateDialog component_
  - _Requirements: 1_
  - _Prompt: Role: Frontend developer with React expertise | Task: Wire up TaskCreateDialog to "Create Task" button following requirement 1, replacing console.log | Restrictions: Do not create new button, modify existing one | Success: Clicking "Create Task" opens modal instead of console.log_

### Phase 3: Error Handling & UX (2 tasks)

- [ ] 6. Add error handling and toast notifications
  - File: apps/frontend/src/components/tasks/TaskCreateForm.tsx
  - On success: toast.success('Task created successfully!'), reset form, call onSuccess()
  - On 400 Bad Request: Map backend errors to form fields using form.setError()
  - On 401 Unauthorized: Redirect to /login
  - On 500/network error: toast.error('Failed to create task. Please try again.')
  - Keep modal open on error (preserve form data for retry)
  - Purpose: Implement comprehensive error handling with user-friendly feedback
  - _Leverage: toast notifications, react-hook-form error handling_
  - _Requirements: 4_
  - _Prompt: Role: Frontend developer with error handling expertise | Task: Add error handling to TaskCreateForm following requirement 4, mapping backend errors to form fields | Restrictions: Do not close modal on error, preserve user data | Success: All error scenarios handled gracefully_

- [ ] 7. Add accessibility features
  - File: apps/frontend/src/components/tasks/TaskCreateForm.tsx
  - Add ARIA labels: aria-label, aria-invalid, aria-describedby on all inputs
  - Error announcements: role="alert" on error messages
  - Focus management: Auto-focus title when dialog opens
  - Keyboard navigation: Full Tab support, focus trap in modal
  - Screen reader support: Announce validation errors
  - Color contrast: Error messages meet WCAG AA standards
  - Purpose: Ensure form is accessible to all users including screen reader users
  - _Leverage: ARIA attributes, focus management hooks_
  - _Requirements: 5_
  - _Prompt: Role: Accessibility specialist with WCAG expertise | Task: Add accessibility features to TaskCreateForm following requirement 5, ensuring WCAG AA compliance | Restrictions: Do not skip ARIA labels, implement focus trap | Success: Passes accessibility audit (WCAG AA)_

### Phase 4: Testing (1 task)

- [ ] 8. Create E2E test for task creation flow
  - File: apps/frontend/e2e/task-create.spec.ts
  - Test: Click "Create Task" button opens modal
  - Test: Submit without title shows error "Title is required"
  - Test: Enter title > 200 chars shows error "Title must be 200 characters or less"
  - Test: Fill valid form and submit creates task successfully (expect toast, modal closes, task in list)
  - Test: Optimistic UI update (task appears immediately)
  - Test: API error (500) keeps modal open and shows error toast
  - Test: Keyboard shortcuts (Ctrl+Enter submits, Escape closes)
  - Test: Mobile responsive (uses Sheet on small screens)
  - Purpose: Validate complete task creation user flow with E2E tests
  - _Leverage: Playwright for E2E testing_
  - _Requirements: 1, 2, 3, 4, 5_
  - _Prompt: Role: QA engineer with E2E testing expertise | Task: Create comprehensive E2E tests for task creation following requirements 1-5, validating all user interactions | Restrictions: Do not skip edge cases, test both success and failure paths | Success: All tests pass with 0 failures_

## Task Dependencies

```
Task 1 (Dialog component) → Task 2 (Form component)
                                      ↓
Task 3 (Zod schema validation) ← Task 4 (useCreateTask hook)
                                      ↓
Task 5 (Wire up modal trigger)
                                      ↓
Task 6 (Error handling) → Task 7 (Accessibility)
                                      ↓
Task 8 (E2E tests)
```

## Validation Checklist

Before marking this spec as complete, verify:

- [ ] All 8 tasks marked as `[x]`
- [ ] All E2E tests passing (0 failures)
- [ ] "Create Task" button opens modal (not console.log)
- [ ] Form validates in real-time (title required, character limits)
- [ ] Can successfully create tasks via UI
- [ ] Optimistic UI works (task appears immediately)
- [ ] Error handling works (400, 401, 500, network errors)
- [ ] Success toast appears on task creation
- [ ] Modal closes automatically on success
- [ ] Keyboard shortcuts work (Ctrl+Enter, Escape)
- [ ] Mobile responsive (Sheet on small screens)
- [ ] Accessibility features implemented (ARIA labels, focus management)

## Estimated Effort

- **Total Tasks**: 8
- **Estimated Time**: 5-7 hours
- **Complexity**: Medium (forms, validation, optimistic updates)
- **Dependencies**: backend-tasks-api (requires POST /api/tasks endpoint)

## Notes

- This spec unblocks core user functionality (creating tasks)
- Use shadcn/ui components for consistency (Dialog, Sheet, Input, Textarea, Select, Button)
- Optimistic updates provide instant feedback (better UX)
- Error mapping from backend validation errors to form fields is critical
- Mobile users need bottom sheet (not centered dialog)
- Focus management is essential for accessibility
- Character count prevents users from hitting API validation errors
- Consider debouncing validation (300ms) to reduce excessive re-renders
