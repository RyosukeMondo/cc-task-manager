'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TaskStatus, TaskState } from '@cc-task-manager/types';
import { useWebSocket } from '@/lib/websocket';

interface DashboardMetrics {
  taskStatusCounts: Record<TaskState, number>;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  activeTasks: number;
  completionRate: number;
  averageExecutionTime: number;
  systemLoad: {
    cpu: number;
    memory: number;
    diskUsage: number;
  };
}

interface DashboardDataHook {
  metrics: DashboardMetrics;
  tasks: TaskStatus[];
  loading: boolean;
  error: string | null;
  refreshData: () => void;
}

/**
 * Custom hook for real-time dashboard data management
 * Integrates with WebSocket for live updates and provides comprehensive metrics
 */
export function useDashboardData(): DashboardDataHook {
  const [tasks, setTasks] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { socket, connected } = useWebSocket();

  // Calculate metrics from task data
  const metrics = React.useMemo((): DashboardMetrics => {
    const taskStatusCounts = tasks.reduce((acc, task) => {
      acc[task.state] = (acc[task.state] || 0) + 1;
      return acc;
    }, Object.values(TaskState).reduce((acc, state) => {
      acc[state] = 0;
      return acc;
    }, {} as Record<TaskState, number>));

    const totalTasks = tasks.length;
    const completedTasks = taskStatusCounts[TaskState.COMPLETED];
    const failedTasks = taskStatusCounts[TaskState.FAILED];
    const activeTasks = taskStatusCounts[TaskState.RUNNING] + taskStatusCounts[TaskState.ACTIVE];

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Calculate average execution time for completed tasks
    const completedTasksWithTime = tasks.filter(task =>
      task.state === TaskState.COMPLETED && task.lastActivity
    );
    const averageExecutionTime = completedTasksWithTime.length > 0
      ? completedTasksWithTime.reduce((sum, task) => {
          // Simulate execution time calculation - in real implementation,
          // this would be based on actual start/end times
          return sum + Math.random() * 5000 + 1000;
        }, 0) / completedTasksWithTime.length
      : 0;

    return {
      taskStatusCounts,
      totalTasks,
      completedTasks,
      failedTasks,
      activeTasks,
      completionRate,
      averageExecutionTime,
      systemLoad: {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        diskUsage: Math.random() * 100
      }
    };
  }, [tasks]);

  // Fetch initial dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // In a real implementation, this would be an API call
      // For now, simulate with sample data
      const sampleTasks: TaskStatus[] = Array.from({ length: 50 }, (_, i) => ({
        taskId: `task-${i}`,
        state: Object.values(TaskState)[Math.floor(Math.random() * Object.values(TaskState).length)],
        pid: Math.floor(Math.random() * 10000),
        progress: `${Math.floor(Math.random() * 100)}%`,
        lastActivity: new Date(Date.now() - Math.random() * 86400000), // Random time within last 24h
        error: Math.random() > 0.9 ? 'Sample error message' : undefined,
        exitCode: Math.random() > 0.8 ? Math.floor(Math.random() * 255) : undefined
      }));

      setTasks(sampleTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    if (!socket || !connected) return;

    // Listen for task status updates
    const handleTaskUpdate = (updatedTask: TaskStatus) => {
      setTasks(prevTasks => {
        const existingIndex = prevTasks.findIndex(task => task.taskId === updatedTask.taskId);
        if (existingIndex >= 0) {
          const newTasks = [...prevTasks];
          newTasks[existingIndex] = updatedTask;
          return newTasks;
        } else {
          return [...prevTasks, updatedTask];
        }
      });
    };

    // Listen for task creation
    const handleTaskCreated = (newTask: TaskStatus) => {
      setTasks(prevTasks => [...prevTasks, newTask]);
    };

    // Listen for task deletion
    const handleTaskDeleted = (taskId: string) => {
      setTasks(prevTasks => prevTasks.filter(task => task.taskId !== taskId));
    };

    // Listen for bulk task updates
    const handleBulkUpdate = (taskUpdates: TaskStatus[]) => {
      setTasks(taskUpdates);
    };

    socket.on('task:updated', handleTaskUpdate);
    socket.on('task:created', handleTaskCreated);
    socket.on('task:deleted', handleTaskDeleted);
    socket.on('tasks:bulk-update', handleBulkUpdate);

    return () => {
      socket.off('task:updated', handleTaskUpdate);
      socket.off('task:created', handleTaskCreated);
      socket.off('task:deleted', handleTaskDeleted);
      socket.off('tasks:bulk-update', handleBulkUpdate);
    };
  }, [socket, connected]);

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Refresh data function
  const refreshData = useCallback(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    metrics,
    tasks,
    loading,
    error,
    refreshData
  };
}