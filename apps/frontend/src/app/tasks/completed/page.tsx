'use client';

import React from 'react';
import { AppLayout } from '@/components/layout';
import { TaskList } from '@/components/tasks/TaskList';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

/**
 * Completed Tasks Page
 *
 * Displays tasks with DONE status, sorted by completion date.
 * Uses TaskList with pre-filtered initialFilters for DONE status.
 *
 * Architecture:
 * - TaskList handles data fetching with initialFilters
 * - Filter defaults to DONE status from API Task schema (ApiTaskStatus)
 * - Default sort is by updatedAt (descending) to show recently completed first
 * - User can still modify filters and sorting via TaskList's built-in controls
 *
 * Note: Uses TaskStatus enum from API task schemas (ApiTaskStatus).
 * TaskStatus.DONE represents API task completion state.
 */
export default function CompletedTasksPage() {
  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Page Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <CardTitle className="text-2xl">Completed Tasks</CardTitle>
                <CardDescription>
                  View all tasks that have been successfully completed
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Task List with Completed Status Filter */}
        <TaskList
          initialFilters={{
            status: ['DONE'],
          }}
        />
      </div>
    </AppLayout>
  );
}