'use client';

import React from 'react';
import { AppLayout } from '@/components/layout';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskStatus } from '@/types/task';

/**
 * Active Tasks Page
 *
 * Displays tasks that are currently todo or in progress.
 * Uses TaskList with pre-filtered initialFilters for TODO and IN_PROGRESS statuses.
 *
 * Architecture:
 * - TaskList handles data fetching with initialFilters
 * - Filter defaults to TODO and IN_PROGRESS statuses from API Task schema
 * - User can still modify filters via TaskList's built-in controls
 *
 * Note: Uses TaskStatus enum from API task schemas (ApiTaskStatus).
 * TaskStatus represents the API task lifecycle (TODO, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED)
 */
export default function ActiveTasksPage() {
  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Active Tasks</h1>
          <p className="text-muted-foreground">
            View tasks that are currently todo or in progress
          </p>
        </div>

        {/* Task List with Active Status Filter */}
        <TaskList
          initialFilters={{
            status: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
          }}
        />
      </div>
    </AppLayout>
  );
}