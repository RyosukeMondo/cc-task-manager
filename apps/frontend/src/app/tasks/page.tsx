'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskStatus, TaskState } from '@cc-task-manager/types';
import {
  useWebSocketConnection,
  useWebSocketEvent
} from '@/lib/websocket/hooks';
import {
  TaskUpdateEvent,
  TaskCreatedEvent,
  TaskCompletedEvent,
  TaskErrorEvent
} from '@/lib/websocket/types';

/**
 * All Tasks page - displays complete task list with filtering capabilities
 * Provides comprehensive view of all tasks across the system
 */
export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const wsConnection = useWebSocketConnection('task-all-page');

  // Handle real-time task updates
  useWebSocketEvent('task:update', (event: TaskUpdateEvent) => {
    setTasks(prevTasks => {
      const existingIndex = prevTasks.findIndex(task => task.id === event.data.id);
      if (existingIndex >= 0) {
        // Update existing task
        const newTasks = [...prevTasks];
        newTasks[existingIndex] = event.data;
        return newTasks;
      } else {
        // Add new task
        return [...prevTasks, event.data];
      }
    });
  });

  useWebSocketEvent('task:created', (event: TaskCreatedEvent) => {
    // Task will be added via task:update event
    console.log('New task created:', event.data.taskId);
  });

  useWebSocketEvent('task:completed', (event: TaskCompletedEvent) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === event.data.taskId
          ? { ...task, state: TaskState.COMPLETED, exitCode: event.data.exitCode }
          : task
      )
    );
  });

  useWebSocketEvent('task:error', (event: TaskErrorEvent) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === event.data.taskId
          ? { ...task, state: TaskState.FAILED, errorMessage: event.data.error }
          : task
      )
    );
  });

  // Initialize loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    // In a real implementation, this would fetch fresh data from the API
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <h1 className="text-3xl font-bold">All Tasks</h1>
        <TaskList
          tasks={tasks}
          onRefresh={handleRefresh}
          isLoading={isLoading}
          showFilters={true}
          showSearch={true}
        />
      </div>
    </AppLayout>
  );
}