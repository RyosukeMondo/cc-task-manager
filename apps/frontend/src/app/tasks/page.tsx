'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { TaskList } from '@/components/tasks/TaskList';
import { Button } from '@/components/ui/button';
import { TaskCreateResponsive } from '@/components/tasks/TaskCreateResponsive';

/**
 * All Tasks Page
 *
 * Displays all tasks with comprehensive filtering and search capabilities.
 * TaskList component handles all data fetching, filtering, and real-time updates internally.
 *
 * Architecture:
 * - TaskList uses useTasks hook for data fetching
 * - Filters are managed via URL params and internal state
 * - WebSocket updates are handled within useTasks hook
 * - No local state management needed at page level
 */
export default function TasksPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">All Tasks</h1>
            <p className="text-sm text-muted-foreground">
              View and manage all your tasks with filtering and search
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Task
          </Button>
        </div>

        {/* Task List - handles its own data fetching, filtering, and updates */}
        <TaskList />

        {/* Task Creation Modal */}
        <TaskCreateResponsive open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      </div>
    </AppLayout>
  );
}