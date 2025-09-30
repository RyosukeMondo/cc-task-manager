'use client';

import React, { useMemo } from 'react';
import { AppLayout } from '@/components/layout';
import { TaskList } from '@/components/tasks/TaskList';
import { useTasks } from '@/lib/api/hooks';
import { TaskState } from '@cc-task-manager/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Loader2 } from 'lucide-react';

/**
 * Completed Tasks Page
 * Displays only completed tasks sorted by completion date (newest first)
 * Route: /tasks/completed
 */
export default function CompletedTasksPage() {
  const { data: allTasks, isLoading, error, refetch } = useTasks();

  // Filter for completed tasks only
  const completedTasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter(task => task.state === TaskState.COMPLETED);
  }, [allTasks]);

  // Sort by lastActivity (most recent first) as proxy for completion date
  const sortedCompletedTasks = useMemo(() => {
    return [...completedTasks].sort((a, b) => {
      const dateA = new Date(a.lastActivity).getTime();
      const dateB = new Date(b.lastActivity).getTime();
      return dateB - dateA; // Descending order (newest first)
    });
  }, [completedTasks]);

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
                  {isLoading ? (
                    <span className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading...</span>
                    </span>
                  ) : (
                    <span>{completedTasks.length} completed {completedTasks.length === 1 ? 'task' : 'tasks'}</span>
                  )}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Task List */}
        {error ? (
          <Card>
            <CardContent className="py-6">
              <div className="text-center text-red-600">
                <p>Error loading tasks: {error.message}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <TaskList
            tasks={sortedCompletedTasks}
            onRefresh={refetch}
            isLoading={isLoading}
            showFilters={false}
            showSearch={true}
          />
        )}
      </div>
    </AppLayout>
  );
}

export const metadata = {
  title: 'Completed Tasks',
  description: 'View all completed tasks'
};