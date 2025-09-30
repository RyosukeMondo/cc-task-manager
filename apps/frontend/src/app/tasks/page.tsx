'use client';

import React from 'react';
import { AppLayout } from '@/components/layout';

/**
 * All Tasks page - displays complete task list with filtering capabilities
 * Provides comprehensive view of all tasks across the system
 */
export default function TasksPage() {
  return (
    <AppLayout>
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold">All Tasks</h1>
      </div>
    </AppLayout>
  );
}