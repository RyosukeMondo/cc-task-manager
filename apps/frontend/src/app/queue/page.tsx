'use client';

import React from 'react';
import { AppLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useQueue } from '@/hooks/useQueue';
import { QueueMetrics } from '@/components/queue/QueueMetrics';
import { ThroughputChart } from '@/components/queue/ThroughputChart';
import { JobList } from '@/components/queue/JobList';

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

        {/* QueueMetrics component - Task 4 */}
        {metrics && <QueueMetrics metrics={metrics} isLoading={isLoading} />}

        {/* ThroughputChart component - Task 5 */}
        {throughput && <ThroughputChart data={throughput} isLoading={isLoading} />}

        {/* JobList component - Task 6 */}
        {jobs && metrics && (
          <JobList
            jobs={jobs}
            failedCount={metrics.failedCount}
            isLoading={isLoading}
          />
        )}
      </div>
    </AppLayout>
  );
}
