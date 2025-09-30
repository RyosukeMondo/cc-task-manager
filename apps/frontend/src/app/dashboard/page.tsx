'use client';

import React from 'react';
import { AppLayout } from '@/components/layout';
import { TaskDashboard } from '@/components/dashboard/TaskDashboard';

/**
 * Main dashboard page featuring real-time task management
 * Provides comprehensive task monitoring with live WebSocket updates
 */
export default function DashboardPage() {
  return (
    <AppLayout>
      <TaskDashboard />
    </AppLayout>
  );
}