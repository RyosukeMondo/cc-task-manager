/**
 * Task types re-exported from shared schemas package
 * Provides convenient access to task-related types while maintaining a single source of truth
 */

// Core task enums
export { TaskStatus, TaskPriority } from '@cc-task-manager/schemas';

// Task schemas and types
export type {
  TaskResponseDto as Task,
  CreateTaskDto as TaskCreate,
  UpdateTaskDto as TaskUpdate,
  TaskQueryDto as TaskFilter,
  PaginatedTaskResponseDto as TaskListResponse,
  TaskStatusUpdateDto as TaskStatusUpdate,
  TaskMetricsDto as TaskMetrics,
} from '@cc-task-manager/schemas';