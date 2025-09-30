/**
 * Task Management Components
 *
 * Comprehensive task management UI components using existing contract-validated types
 * from TypeScriptGenerator and @cc-task-manager packages.
 *
 * Components follow Single Responsibility Principle:
 * - TaskDisplay: Displays task status information only
 * - TaskForm: Handles task creation with contract validation
 * - TaskEditor: Handles task editing with comprehensive validation
 * - TaskList: Manages task list display, filtering, and sorting
 *
 * All components leverage:
 * - Generated types from src/contracts/TypeScriptGenerator.ts
 * - Existing contract schemas from ContractRegistry
 * - @cc-task-manager/schemas (TaskState enum, validation functions)
 * - @cc-task-manager/types (TaskStatus, TaskExecutionRequest interfaces)
 */

export { TaskDisplay } from './TaskDisplay';
export { TaskForm } from './TaskForm';
export { TaskEditor } from './TaskEditor';
export { TaskList } from './TaskList';
export { TaskItem } from './TaskItem';

// Re-export types for convenience
export type { TaskStatus, TaskExecutionRequest, TaskState } from '@cc-task-manager/types';