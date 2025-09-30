'use client';

import React from 'react';
import { AppLayout } from '@/components/layout';

/**
 * Tasks page displaying all tasks with filtering and search capabilities
 * Provides comprehensive task list view with real-time updates
 */
export default function TasksPage() {
  return (
    <AppLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold">All Tasks</h1>
        {/* TaskList component integration will be added in next task */}
      </div>
    </AppLayout>
  );
}