'use client';

import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { TaskList } from '@/components/tasks/TaskList';
import { Button } from '@/components/ui/button';
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
 * Tasks page displaying all tasks with filtering and search capabilities
 * Provides comprehensive task list view with real-time updates
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

  const handleCreateTask = () => {
    // TODO: Implement task creation modal/flow
    console.log('Create task clicked');
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">All Tasks</h1>
            <p className="text-sm text-muted-foreground">
              {tasks.length > 0 ? (
                <>
                  {tasks.length} total task{tasks.length !== 1 ? 's' : ''} •{' '}
                  {tasks.filter(t => t.state === TaskState.COMPLETED).length} completed •{' '}
                  {tasks.filter(t => t.state === TaskState.RUNNING || t.state === TaskState.ACTIVE).length} active •{' '}
                  {tasks.filter(t => t.state === TaskState.FAILED).length} failed
                </>
              ) : (
                'No tasks yet'
              )}
            </p>
          </div>
          <Button onClick={handleCreateTask} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Task
          </Button>
        </div>

        {/* Task List */}
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