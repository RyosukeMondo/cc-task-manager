'use client';

import React from 'react';
import { TaskStatus, TaskState } from '@cc-task-manager/types';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Clock, CheckCircle, XCircle, AlertCircle, Pause, Play } from 'lucide-react';

interface TaskDisplayProps {
  task: TaskStatus;
  className?: string;
  showDetails?: boolean;
}

/**
 * TaskDisplay component following Single Responsibility Principle
 * Responsible only for displaying task status information
 * Uses existing contract-validated TaskStatus type
 */
export function TaskDisplay({ task, className, showDetails = false }: TaskDisplayProps) {
  const getStateIcon = (state: TaskState) => {
    switch (state) {
      case TaskState.COMPLETED:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case TaskState.FAILED:
        return <XCircle className="h-4 w-4 text-red-500" />;
      case TaskState.RUNNING:
      case TaskState.ACTIVE:
        return <Play className="h-4 w-4 text-blue-500" />;
      case TaskState.IDLE:
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case TaskState.CANCELLED:
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case TaskState.PENDING:
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStateVariant = (state: TaskState): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (state) {
      case TaskState.COMPLETED:
        return 'default';
      case TaskState.FAILED:
        return 'destructive';
      case TaskState.RUNNING:
      case TaskState.ACTIVE:
        return 'default';
      case TaskState.CANCELLED:
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(date);
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{task.taskId}</CardTitle>
          <Badge variant={getStateVariant(task.state)} className="flex items-center gap-1">
            {getStateIcon(task.state)}
            {task.state}
          </Badge>
        </div>
        {task.progress && (
          <CardDescription className="mt-1">
            {task.progress}
          </CardDescription>
        )}
      </CardHeader>

      {showDetails && (
        <CardContent className="pt-0">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Activity:</span>
              <span>{formatDate(task.lastActivity)}</span>
            </div>

            {task.pid && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Process ID:</span>
                <span className="font-mono">{task.pid}</span>
              </div>
            )}

            {task.exitCode !== undefined && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exit Code:</span>
                <span className={cn(
                  'font-mono',
                  task.exitCode === 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {task.exitCode}
                </span>
              </div>
            )}

            {task.error && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-red-800 font-medium text-xs">Error</div>
                    <div className="text-red-700 text-xs mt-1">{task.error}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}