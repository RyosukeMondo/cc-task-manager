/**
 * Task type definitions
 * Re-exports from shared schemas package to ensure frontend-backend consistency
 * Provides convenient access to task-related types while maintaining a single source of truth
 *
 * Uses ApiTask contract (simple REST API model) instead of complex Task model
 */

export type {
  ApiTaskDto as Task,
  CreateApiTaskDto as TaskCreate,
  UpdateApiTaskDto as TaskUpdate,
  ApiTaskFilterDto as TaskFilter,
  PaginatedTasksDto as TaskListResponse,
} from '@cc-task-manager/schemas';

// Re-export with legacy names for backward compatibility
export type {
  UpdateApiTaskDto as TaskStatusUpdate,
} from '@cc-task-manager/schemas';

// TaskMetrics doesn't exist in ApiTask - using any for now
export type TaskMetrics = any;

export {
  ApiTaskStatus as TaskStatus,
  ApiTaskPriority as TaskPriority
} from '@cc-task-manager/schemas';