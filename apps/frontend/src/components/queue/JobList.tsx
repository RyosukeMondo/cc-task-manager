'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  ChevronDown,
  ChevronUp,
  ListTodo,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJobActions } from '@/hooks/useJobActions';

interface Job {
  id: string;
  name: string;
  status: string;
  progress: number;
  attemptsMade: number;
  attemptsMax: number;
  timestamp: Date;
  data: any;
  failedReason?: string;
}

interface JobListProps {
  /**
   * Array of jobs to display
   */
  jobs: Job[];

  /**
   * Number of failed jobs (for showing bulk retry button)
   */
  failedCount: number;

  /**
   * Whether the data is loading
   */
  isLoading?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

type JobStatus = 'all' | 'active' | 'pending' | 'completed' | 'failed';

const JOBS_PER_PAGE = 20;

/**
 * JobList component displays job list with filtering, pagination, and actions
 *
 * Features:
 * - Table columns: ID (truncated), Name, Status (badge), Progress (progress bar), Attempts, Timestamp, Actions
 * - Status filter: All, Active, Pending, Completed, Failed
 * - Pagination: 20 jobs per page, prev/next buttons
 * - Expandable rows: Click row to show job data (JSON) and error stack trace
 * - Action buttons: Retry (failed jobs), Cancel (pending/active jobs)
 * - Bulk action: "Retry All Failed" button if failedCount > 0
 *
 * Spec: queue-management-dashboard
 * Requirements: 3, 4
 *
 * @example
 * ```tsx
 * <JobList
 *   jobs={jobs}
 *   failedCount={5}
 * />
 * ```
 */
export function JobList({ jobs, failedCount, isLoading = false, className }: JobListProps) {
  const [statusFilter, setStatusFilter] = useState<JobStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const { retryJob, cancelJob, retryAllFailed, isPending } = useJobActions();

  // Filter jobs by status
  const filteredJobs = jobs.filter((job) => {
    if (statusFilter === 'all') return true;
    return job.status.toLowerCase() === statusFilter;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredJobs.length / JOBS_PER_PAGE);
  const startIndex = (currentPage - 1) * JOBS_PER_PAGE;
  const endIndex = startIndex + JOBS_PER_PAGE;
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

  // Reset to page 1 when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  const handleRetry = (jobId: string) => {
    retryJob.mutate(jobId);
  };

  const handleCancel = (jobId: string) => {
    cancelJob.mutate(jobId);
  };

  const handleRetryAllFailed = () => {
    retryAllFailed.mutate();
  };

  const toggleExpandRow = (jobId: string) => {
    setExpandedRowId(expandedRowId === jobId ? null : jobId);
  };

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed') return 'default';
    if (statusLower === 'active') return 'secondary';
    if (statusLower === 'pending') return 'outline';
    if (statusLower === 'failed') return 'destructive';
    return 'outline';
  };

  const getStatusColor = (status: string): string => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed') return 'text-green-600 dark:text-green-400';
    if (statusLower === 'active') return 'text-yellow-600 dark:text-yellow-400';
    if (statusLower === 'pending') return 'text-blue-600 dark:text-blue-400';
    if (statusLower === 'failed') return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const truncateId = (id: string): string => {
    return id.length > 8 ? `${id.slice(0, 8)}...` : id;
  };

  const formatTimestamp = (timestamp: Date): string => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            Jobs
            {filteredJobs.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({filteredJobs.length} {statusFilter !== 'all' ? statusFilter : 'total'})
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as JobStatus)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            {/* Retry All Failed Button */}
            {failedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetryAllFailed}
                disabled={isPending}
              >
                <RotateCcw className={cn('mr-2 h-4 w-4', isPending && 'animate-spin')} />
                Retry All Failed ({failedCount})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading jobs...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ListTodo className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No jobs found</p>
          </div>
        ) : (
          <>
            {/* Jobs Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[140px]">Progress</TableHead>
                    <TableHead className="w-[100px]">Attempts</TableHead>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead className="w-[140px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedJobs.map((job) => (
                    <React.Fragment key={job.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => toggleExpandRow(job.id)}
                      >
                        <TableCell className="font-mono text-xs">
                          {truncateId(job.id)}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {expandedRowId === job.id ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                            {job.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(job.status)}>
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Progress value={job.progress} className="h-2" />
                            <span className="text-xs text-muted-foreground">
                              {job.progress}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className={cn(
                            job.attemptsMade >= job.attemptsMax ? 'text-red-600 dark:text-red-400' : ''
                          )}>
                            {job.attemptsMade}/{job.attemptsMax}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatTimestamp(job.timestamp)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            {job.status.toLowerCase() === 'failed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRetry(job.id)}
                                disabled={isPending}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                            {(job.status.toLowerCase() === 'pending' || job.status.toLowerCase() === 'active') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancel(job.id)}
                                disabled={isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Expanded Row */}
                      {expandedRowId === job.id && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/50">
                            <div className="space-y-4 p-4">
                              {/* Job Data */}
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Job Data</h4>
                                <pre className="bg-background border rounded-md p-3 text-xs overflow-x-auto">
                                  {JSON.stringify(job.data, null, 2)}
                                </pre>
                              </div>
                              {/* Error Stack Trace (if failed) */}
                              {job.failedReason && (
                                <div>
                                  <h4 className="text-sm font-semibold mb-2 text-red-600 dark:text-red-400">
                                    Error Stack Trace
                                  </h4>
                                  <pre className="bg-background border border-red-200 dark:border-red-800 rounded-md p-3 text-xs overflow-x-auto text-red-600 dark:text-red-400">
                                    {job.failedReason}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} jobs
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <div className="text-sm">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
