# Tasks Document - Tasks Completed Page

- [ ] 1. Create completed tasks page file
  - File: apps/frontend/src/app/tasks/completed/page.tsx
  - Create page component with TaskList filtered by completed status
  - Purpose: Establish /tasks/completed route showing only completed tasks
  - _Leverage: apps/frontend/src/app/tasks/page.tsx, TaskList component_
  - _Requirements: 1.1, 1.4, 2.1_
  - _Prompt: Role: Next.js Developer | Task: Create completed tasks page at apps/frontend/src/app/tasks/completed/page.tsx following requirements 1.1, 1.4, and 2.1, using TaskList component with status='completed' filter sorted by completion date | Restrictions: Must pass correct filter and sort to TaskList, set metadata to "Completed Tasks", follow page structure | Success: Page exists, displays only completed tasks sorted by completion date, metadata is correct_

- [ ] 2. Add page header for completed tasks
  - File: apps/frontend/src/app/tasks/completed/page.tsx (continue from task 1)
  - Create header with "Completed Tasks" title and completed count
  - Purpose: Provide clear page context
  - _Leverage: Header pattern from tasks/page.tsx_
  - _Requirements: 2.1, 2.2_
  - _Prompt: Role: Frontend Developer | Task: Add page header with "Completed Tasks" title and completed task count following requirements 2.1 and 2.2, using header pattern from other task pages | Restrictions: Must show only completed task count, maintain consistent styling | Success: Header displays correctly, count shows completed tasks only, styling is consistent_

- [ ] 3. Verify navigation links work (already uncommented)
  - File: N/A (verification only)
  - Test that sidebar Completed link navigates correctly
  - Purpose: Ensure navigation integration is working
  - _Leverage: Navigation links uncommented in previous spec_
  - _Requirements: 2.3_
  - _Prompt: Role: QA Engineer | Task: Verify that the Completed navigation link in Sidebar navigates to /tasks/completed without error following requirement 2.3 | Restrictions: Only verify functionality, do not modify if already working | Success: Clicking "Completed" in sidebar navigates to /tasks/completed, no 404 error, active state highlights_

- [ ] 4. Add tests for completed page
  - File: apps/frontend/src/app/tasks/completed/__tests__/page.test.tsx
  - Write tests verifying completed filter and sort
  - Purpose: Ensure page correctly filters and sorts completed tasks
  - _Leverage: Existing test patterns_
  - _Requirements: 1.1, 1.2, 1.4_
  - _Prompt: Role: QA Engineer | Task: Create tests for completed tasks page verifying filter and sort following requirements 1.1, 1.2, and 1.4 | Restrictions: Must verify correct props passed to TaskList, test empty state, check sort order | Success: Tests verify completed filter and sort are applied correctly, empty state works, tests are reliable_