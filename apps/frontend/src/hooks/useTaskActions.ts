'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/contract-client';
import type { ApiTaskDto } from '@cc-task-manager/schemas';
import { ApiTaskStatus } from '@cc-task-manager/schemas';

/**
 * useTaskActions Hook
 *
 * Provides mutation hooks for task lifecycle actions:
 * - cancelTask: Cancel a PENDING or RUNNING task
 * - retryTask: Create a new task with same params as a FAILED task
 * - deleteTask: Delete a COMPLETED, FAILED, or CANCELLED task
 *
 * All mutations invalidate relevant query cache on success
 */
export function useTaskActions() {
  const queryClient = useQueryClient();

  /**
   * Cancel a task by updating its status to CANCELLED
   */
  const cancelTask = useMutation({
    mutationFn: async (taskId: string) => {
      return apiClient.updateTask(taskId, { status: ApiTaskStatus.CANCELLED });
    },
    onSuccess: (data, taskId) => {
      // Invalidate task list and specific task queries
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  /**
   * Retry a failed task by creating a new task with the same parameters
   * Returns the new task ID for navigation
   */
  const retryTask = useMutation({
    mutationFn: async (task: ApiTaskDto) => {
      // Create a new task with the same parameters
      const newTask = await apiClient.createTask({
        title: task.title,
        description: task.description || undefined,
        priority: task.priority,
      });
      return newTask;
    },
    onSuccess: () => {
      // Invalidate task list to show the new task
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  /**
   * Delete a task (soft delete)
   */
  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      return apiClient.deleteTask(taskId);
    },
    onSuccess: (data, taskId) => {
      // Invalidate task list and specific task queries
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  return {
    cancelTask: cancelTask.mutate,
    retryTask: retryTask.mutate,
    deleteTask: deleteTask.mutate,
    isPending:
      cancelTask.isPending || retryTask.isPending || deleteTask.isPending,
    isError: cancelTask.isError || retryTask.isError || deleteTask.isError,
    error: cancelTask.error || retryTask.error || deleteTask.error,
  };
}
