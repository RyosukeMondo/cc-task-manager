'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskState, TaskStatus } from '@cc-task-manager/types';
import { useWebSocketEvent } from '@/lib/websocket/hooks';
import { TaskUpdateEvent } from '@/lib/websocket/types';

/**
 * Active Tasks Page
 * Displays only tasks with ACTIVE status for focused work management
 * Following requirements 1.1, 1.2, and 2.1 from tasks-active-page spec
 */
export default function ActiveTasksPage() {
  const [tasks, setTasks] = useState<TaskStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Real-time task updates via WebSocket
  useWebSocketEvent('task:update', (event: TaskUpdateEvent) => {
    setTasks(prevTasks => {
      const existingIndex = prevTasks.findIndex(task => task.id === event.data.id);
      if (existingIndex >= 0) {
        const newTasks = [...prevTasks];
        newTasks[existingIndex] = event.data;
        return newTasks;
      } else {
        return [...prevTasks, event.data];
      }
    });
  });

  // Filter tasks to show only active status
  const activeTasks = useMemo(
    () => tasks.filter(task => task.state === TaskState.ACTIVE),
    [tasks]
  );

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    // In a real implementation, this would fetch from API
    setTimeout(() => setIsLoading(false), 500);
  };

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Active Tasks</h1>
          <p className="text-muted-foreground">
            {activeTasks.length} active {activeTasks.length === 1 ? 'task' : 'tasks'}
          </p>
        </div>

        {/* Task List with Active Filter */}
        <TaskList
          tasks={activeTasks}
          onRefresh={handleRefresh}
          isLoading={isLoading}
          showFilters={true}
          showSearch={true}
        />
      </div>
    </AppLayout>
  );
}