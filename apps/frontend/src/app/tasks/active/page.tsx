'use client';

import React, { useMemo } from 'react';
import { AppLayout } from '@/components/layout';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskState } from '@cc-task-manager/types';
import { useDashboardData } from '@/components/dashboard/hooks/useDashboardData';

/**
 * Active Tasks Page
 * Displays only tasks with ACTIVE or RUNNING status for focused work management
 * Following requirements 1.1, 1.2, and 2.1 from tasks-active-page spec
 *
 * Note: Based on Task API verification, "active tasks" are defined as tasks
 * with ACTIVE or RUNNING states (non-completed statuses)
 */
export default function ActiveTasksPage() {
  const { tasks, loading, refreshData } = useDashboardData();

  // Filter tasks to show only active status (ACTIVE or RUNNING)
  const activeTasks = useMemo(
    () => tasks.filter(task =>
      task.state === TaskState.ACTIVE ||
      task.state === TaskState.RUNNING
    ),
    [tasks]
  );

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
          onRefresh={refreshData}
          isLoading={loading}
          showFilters={true}
          showSearch={true}
        />
      </div>
    </AppLayout>
  );
}