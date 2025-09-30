# Tasks Document - Task List Component

## ⚠️ MANDATORY: Contract-First Development
All tasks must follow contract-driven development. Task 0 MUST be completed before any other tasks.

- [ ] 0. Define Task API contract in shared schemas package
  - File: packages/schemas/src/tasks/task.schemas.ts
  - Define all Zod schemas: TaskSchema, TaskStatus, TaskPriority, TaskFilterSchema, TaskCreateSchema, TaskUpdateSchema, TaskListResponseSchema
  - Export from packages/schemas/src/tasks/index.ts and packages/schemas/src/index.ts
  - Build schemas package (cd packages/schemas && pnpm build)
  - Register contracts in ContractRegistry
  - Purpose: Establish single source of truth for task data contracts before any implementation
  - _Leverage: packages/schemas/src/auth/auth.schemas.ts pattern, existing ContractRegistry_
  - _Requirements: ALL (contract is foundation for all requirements)_
  - _Prompt: Role: API Architect with expertise in contract-driven development, Zod schemas, and TypeScript | Task: Define complete Task API contract in packages/schemas/src/tasks/task.schemas.ts following the auth.schemas.ts pattern, including TaskSchema (id, title, description, status, priority, timestamps), TaskStatus enum (pending, active, completed, failed), TaskPriority enum (low, medium, high), TaskFilterSchema (status, priority, searchTerm, dateRange), TaskCreateSchema, TaskUpdateSchema, and TaskListResponseSchema with full Zod validation rules and JSDoc documentation | Restrictions: Must use Zod for all schemas, follow existing schema patterns from auth, include comprehensive validation (min/max lengths, date formats, enum values), document all fields with JSDoc, ensure schemas compile without errors, export all types and schemas properly, register contracts in ContractRegistry with versioning | Success: Task schemas defined and compiled successfully, all exports accessible from @cc-task-manager/schemas and @schemas/tasks, contracts registered in registry, both backend and frontend can import without errors, validation rules are comprehensive and documented, TypeScript types auto-generated from schemas_

- [ ] 1. Import Task types from shared schemas (replaces local type definitions)
  - File: apps/frontend/src/types/task.ts
  - Import Task types from @cc-task-manager/schemas instead of defining locally
  - Re-export for convenience: export type { Task, TaskStatus, TaskPriority, TaskFilter } from '@cc-task-manager/schemas'
  - Purpose: Use shared contract types to ensure frontend-backend consistency
  - _Leverage: packages/schemas/src/tasks/task.schemas.ts (from Task 0)_
  - _Requirements: 1.1, 2.1_
  - _Prompt: Role: TypeScript Developer specializing in type systems and contract-driven development | Task: Create type re-export file at apps/frontend/src/types/task.ts that imports and re-exports Task, TaskStatus, TaskPriority, TaskFilter, and other task-related types from @cc-task-manager/schemas following requirement 1.1 and 2.1 | Restrictions: Must import from @cc-task-manager/schemas only, do not define any types locally, only re-export for convenience, ensure tsconfig.json references schemas package, verify types are accessible | Success: All task types imported from shared schemas, re-exported for frontend use, TypeScript compiles without errors, no duplicate type definitions, frontend has full type coverage from shared contracts_

- [ ] 2. Create useTasks custom hook
  - File: apps/frontend/src/hooks/useTasks.ts
  - Implement data fetching hook with filtering and real-time updates
  - Purpose: Centralize task data management logic
  - _Leverage: Existing API client patterns, WebSocket context_
  - _Requirements: 1.1, 1.2, 3.1_
  - _Prompt: Role: React Developer with expertise in custom hooks and data fetching | Task: Implement useTasks custom hook following requirements 1.1, 1.2, and 3.1, integrating with existing API client and WebSocket context for real-time updates | Restrictions: Must handle loading, error, and success states, follow existing hook patterns, implement proper cleanup | Success: Hook provides tasks data with loading/error states, supports filtering, and updates in real-time via WebSocket_

- [ ] 3. Create TaskItem presentational component
  - File: apps/frontend/src/components/tasks/TaskItem.tsx
  - Implement single task display component with status badges and actions
  - Purpose: Reusable component for rendering individual tasks
  - _Leverage: UI components from @/components/ui (Card, Badge, Button)_
  - _Requirements: 2.1, 2.2, 2.3_
  - _Prompt: Role: Frontend Developer specializing in React component design and UI/UX | Task: Create TaskItem presentational component following requirements 2.1, 2.2, and 2.3, using Card, Badge, and Button components from shadcn/ui | Restrictions: Must be a pure presentational component, no data fetching, ensure accessibility with proper ARIA labels, support theme variants | Success: Component renders task details correctly, provides visual feedback on interaction, is accessible and responsive_

- [ ] 4. Create TaskList container component
  - File: apps/frontend/src/components/tasks/TaskList.tsx
  - Implement main task list container with filtering and sorting
  - Purpose: Manage task list state and orchestrate TaskItem components
  - _Leverage: useTasks hook, TaskItem component, UI skeleton components_
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2_
  - _Prompt: Role: Senior React Developer with expertise in state management and component architecture | Task: Implement TaskList container component following requirements 1.1, 1.2, 1.3, 3.1, and 3.2, using useTasks hook and TaskItem component with proper loading and empty states | Restrictions: Must handle all data states (loading, error, empty, success), implement efficient rendering for large lists, maintain accessibility | Success: Component renders task lists efficiently, handles filtering/sorting, provides proper feedback for all states, is keyboard navigable_

- [ ] 5. Add loading and empty states
  - File: apps/frontend/src/components/tasks/TaskList.tsx (continue from task 4)
  - Implement skeleton loading UI and empty state messaging
  - Purpose: Provide visual feedback during data loading and empty states
  - _Leverage: Skeleton component from @/components/ui/skeleton_
  - _Requirements: 1.2, 1.3_
  - _Prompt: Role: UI/UX Developer with focus on loading states and user feedback | Task: Implement skeleton loading states and empty state UI following requirements 1.2 and 1.3, using Skeleton component from shadcn/ui | Restrictions: Must match existing design patterns, ensure smooth transitions between states, maintain accessibility | Success: Loading states provide clear feedback, empty states are encouraging and actionable, transitions are smooth_

- [ ] 6. Implement filtering logic
  - File: apps/frontend/src/components/tasks/TaskList.tsx (continue from task 4)
  - Add filter state management and filter UI controls
  - Purpose: Enable users to filter tasks by status, priority, and search
  - _Leverage: Existing filter patterns, UI form components_
  - _Requirements: 3.1, 3.2, 3.3_
  - _Prompt: Role: Frontend Developer with expertise in state management and filtering logic | Task: Implement task filtering functionality following requirements 3.1, 3.2, and 3.3, adding filter controls and state management | Restrictions: Must maintain URL sync for filters (query params), ensure filter performance with large datasets, provide clear filter feedback | Success: Filters work correctly, URL reflects filter state, performance is maintained, clear visual feedback for active filters_

- [ ] 7. Implement sorting functionality
  - File: apps/frontend/src/components/tasks/TaskList.tsx (continue from task 4)
  - Add sort controls and sorting logic
  - Purpose: Enable users to sort tasks by different criteria
  - _Leverage: Existing sort utilities_
  - _Requirements: 3.2_
  - _Prompt: Role: Frontend Developer with expertise in data sorting and UX patterns | Task: Implement task sorting functionality following requirement 3.2, adding sort controls and logic for date, priority, and title | Restrictions: Must maintain sort state, provide visual indication of active sort, ensure stable sorting algorithm | Success: Sorting works correctly, users can easily change sort order, visual feedback is clear_

- [ ] 8. Add unit tests for components
  - File: apps/frontend/src/components/tasks/__tests__/TaskList.test.tsx
  - File: apps/frontend/src/components/tasks/__tests__/TaskItem.test.tsx
  - Write comprehensive unit tests for TaskList and TaskItem
  - Purpose: Ensure component reliability and catch regressions
  - _Leverage: Existing test utilities and React Testing Library_
  - _Requirements: All component requirements_
  - _Prompt: Role: QA Engineer with expertise in React Testing Library and Jest | Task: Create comprehensive unit tests for TaskList and TaskItem components covering all requirements, using React Testing Library and existing test patterns | Restrictions: Must test user interactions not implementation details, ensure tests are maintainable, mock external dependencies | Success: All components are tested with good coverage, tests are reliable and maintainable, both success and error scenarios covered_

- [ ] 9. Add integration tests
  - File: apps/frontend/src/components/tasks/__tests__/TaskList.integration.test.tsx
  - Write integration tests for TaskList with real data flow
  - Purpose: Verify component integration with hooks and API
  - _Leverage: Existing integration test patterns_
  - _Requirements: 1.1, 3.1_
  - _Prompt: Role: QA Engineer specializing in integration testing | Task: Create integration tests for TaskList component covering requirements 1.1 and 3.1, testing data flow from API through hooks to components | Restrictions: Must test realistic user scenarios, use mock API responses, ensure test isolation | Success: Integration tests verify complete data flow, realistic scenarios are covered, tests run reliably_

- [ ] 10. Create Storybook stories for components
  - File: apps/frontend/src/components/tasks/TaskList.stories.tsx
  - File: apps/frontend/src/components/tasks/TaskItem.stories.tsx
  - Create Storybook stories showcasing different component states
  - Purpose: Document component usage and enable visual testing
  - _Leverage: Existing Storybook configuration_
  - _Requirements: All visual requirements_
  - _Prompt: Role: Frontend Developer with expertise in component documentation and Storybook | Task: Create comprehensive Storybook stories for TaskList and TaskItem components showcasing all visual states and variations | Restrictions: Must include all component states (loading, empty, error, success), use realistic mock data, follow existing Storybook patterns | Success: All component states are documented, stories are interactive and helpful for development, visual testing is enabled_