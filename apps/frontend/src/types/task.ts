/**
 * Task type definitions
 * Re-exports from shared schemas package to ensure frontend-backend consistency
 */

export type {
  TaskResponseDto as Task,
  CreateTaskDto as TaskCreate,
  UpdateTaskDto as TaskUpdate,
  TaskQueryDto as TaskFilter,
  PaginatedTaskResponseDto as TaskListResponse,
  TaskStatusUpdateDto as TaskStatusUpdate,
  TaskMetricsDto as TaskMetrics
} from '@cc-task-manager/schemas';

export {
  TaskStatus,
  TaskPriority
} from '@cc-task-manager/schemas';