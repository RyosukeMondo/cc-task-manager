# Tasks Document - Tasks Active Page

- [ ] 1. Create active tasks page file
  - File: apps/frontend/src/app/tasks/active/page.tsx
  - Create page component with TaskList filtered by active status
  - Purpose: Establish /tasks/active route showing only active tasks
  - _Leverage: apps/frontend/src/app/tasks/page.tsx, TaskList component_
  - _Requirements: 1.1, 2.1_
  - _Prompt: Role: Next.js Developer | Task: Create active tasks page at apps/frontend/src/app/tasks/active/page.tsx following requirements 1.1 and 2.1, using TaskList component with status='active' filter | Restrictions: Must pass correct filter to TaskList, set metadata to "Active Tasks", follow page structure from tasks/page.tsx | Success: Page exists, displays only active tasks, metadata is correct, no 404 error_

- [ ] 2. Add page header for active tasks
  - File: apps/frontend/src/app/tasks/active/page.tsx (continue from task 1)
  - Create header with "Active Tasks" title and active count
  - Purpose: Provide clear page context
  - _Leverage: Header pattern from tasks/page.tsx_
  - _Requirements: 2.1, 2.2_
  - _Prompt: Role: Frontend Developer | Task: Add page header with "Active Tasks" title and active task count following requirements 2.1 and 2.2, using header pattern from tasks/page.tsx | Restrictions: Must show only active task count, maintain consistent styling, ensure responsive | Success: Header displays correctly, count shows active tasks only, styling matches other pages_

- [ ] 3. Verify navigation links work (already uncommented)
  - File: N/A (verification only)
  - Test that sidebar Active Tasks link navigates correctly
  - Purpose: Ensure navigation integration is working
  - _Leverage: Navigation links uncommented in previous spec_
  - _Requirements: 2.3_
  - _Prompt: Role: QA Engineer | Task: Verify that the Active Tasks navigation link in Sidebar (should already be uncommented) navigates to /tasks/active without error following requirement 2.3 | Restrictions: Do not modify navigation files if already uncommented, only verify functionality | Success: Clicking "Active Tasks" in sidebar navigates to /tasks/active, no 404 error, active state highlights correctly_

- [ ] 4. Add tests for active page
  - File: apps/frontend/src/app/tasks/active/__tests__/page.test.tsx
  - Write tests verifying active filter is applied
  - Purpose: Ensure page correctly filters to active tasks only
  - _Leverage: Existing test patterns_
  - _Requirements: 1.1, 1.2_
  - _Prompt: Role: QA Engineer | Task: Create tests for active tasks page verifying that only active tasks are displayed following requirements 1.1 and 1.2 | Restrictions: Must mock TaskList and verify correct props passed, test empty state, follow existing test patterns | Success: Tests verify active filter is applied, empty state works, tests are reliable and maintainable_