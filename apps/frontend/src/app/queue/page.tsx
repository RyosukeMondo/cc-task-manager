'use client';

import React from 'react';
import { AppLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useQueue } from '@/hooks/useQueue';

/**
 * Queue Management Dashboard Page
 * Displays real-time queue metrics, job list, and throughput charts
 * Polls queue status every 5 seconds (30s when tab inactive)
 *
 * Spec: queue-management-dashboard
 * Requirements: 1, 5
 */
export default function QueuePage() {
  const { metrics, jobs, throughput, isLoading, error, refetch } = useQueue();

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Queue Management</h1>
            <p className="text-muted-foreground">
              Monitor job queue status and manage background tasks
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Placeholder for QueueMetrics component */}
        {/* Will be implemented in task 4 */}
        <div className="text-sm text-muted-foreground">
          QueueMetrics component will be rendered here
        </div>

        {/* Placeholder for ThroughputChart component */}
        {/* Will be implemented in task 5 */}
        <div className="text-sm text-muted-foreground">
          ThroughputChart component will be rendered here
        </div>

        {/* Placeholder for JobList component */}
        {/* Will be implemented in task 6 */}
        <div className="text-sm text-muted-foreground">
          JobList component will be rendered here
        </div>
      </div>
    </AppLayout>
  );
}
