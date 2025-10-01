'use client';

import React, { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Play,
  Pause,
  Square,
  Timer,
  TrendingUp,
  Activity
} from 'lucide-react';
import { WorkerTaskStatus, TaskState } from '@cc-task-manager/types';
import { cn } from '@/lib/utils';

interface TaskProgressProps {
  task: WorkerTaskStatus;
  showDetails?: boolean;
  className?: string;
  compact?: boolean;
}

interface ProgressMetrics {
  percentage: number;
  estimatedTimeRemaining?: number;
  elapsedTime: number;
  phase: string;
  stepsCompleted: number;
  totalSteps: number;
}

/**
 * TaskProgress Component
 * Displays visual progress tracking for individual task execution
 * Provides detailed progress indicators and status information
 */
export function TaskProgress({
  task,
  showDetails = true,
  className,
  compact = false
}: TaskProgressProps) {
  // Calculate progress metrics from task status
  const progressMetrics = useMemo((): ProgressMetrics => {
    const now = new Date();
    const elapsedMs = now.getTime() - task.lastActivity.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);

    // Parse progress information from task.progress string
    let percentage = 0;
    let phase = 'Initializing';
    let stepsCompleted = 0;
    let totalSteps = 1;

    if (task.progress) {
      // Expected format: "Phase: step_name | Progress: 45% | Steps: 3/7"
      const progressMatch = task.progress.match(/Progress:\s*(\d+)%/);
      const phaseMatch = task.progress.match(/Phase:\s*([^|]+)/);
      const stepsMatch = task.progress.match(/Steps:\s*(\d+)\/(\d+)/);

      if (progressMatch) percentage = parseInt(progressMatch[1]);
      if (phaseMatch) phase = phaseMatch[1].trim();
      if (stepsMatch) {
        stepsCompleted = parseInt(stepsMatch[1]);
        totalSteps = parseInt(stepsMatch[2]);
      }
    }

    // Calculate progress based on task state if no explicit progress
    if (percentage === 0) {
      switch (task.state) {
        case TaskState.PENDING:
          percentage = 0;
          phase = 'Queued';
          break;
        case TaskState.RUNNING:
        case TaskState.ACTIVE:
          percentage = Math.min(50 + elapsedMinutes * 2, 95); // Progressive increase
          phase = 'Executing';
          break;
        case TaskState.COMPLETED:
          percentage = 100;
          phase = 'Completed';
          break;
        case TaskState.FAILED:
          percentage = Math.min(elapsedMinutes * 3, 85);
          phase = 'Failed';
          break;
        case TaskState.CANCELLED:
          percentage = Math.min(elapsedMinutes * 2, 75);
          phase = 'Cancelled';
          break;
        default:
          percentage = 10;
          phase = 'Processing';
      }
    }

    // Estimate remaining time (simple heuristic)
    const estimatedTimeRemaining = percentage > 0 && percentage < 100
      ? Math.round((elapsedMinutes * (100 - percentage)) / percentage)
      : undefined;

    return {
      percentage,
      estimatedTimeRemaining,
      elapsedTime: elapsedMinutes,
      phase,
      stepsCompleted,
      totalSteps
    };
  }, [task]);

  // Get status icon and color based on task state
  const getStatusIndicator = () => {
    const iconClass = "w-4 h-4";

    switch (task.state) {
      case TaskState.PENDING:
        return {
          icon: <Clock className={iconClass} />,
          color: "text-yellow-600",
          bg: "bg-yellow-100",
          label: "Pending"
        };
      case TaskState.RUNNING:
      case TaskState.ACTIVE:
        return {
          icon: <Loader2 className={`${iconClass} animate-spin`} />,
          color: "text-blue-600",
          bg: "bg-blue-100",
          label: "Running"
        };
      case TaskState.COMPLETED:
        return {
          icon: <CheckCircle className={iconClass} />,
          color: "text-green-600",
          bg: "bg-green-100",
          label: "Completed"
        };
      case TaskState.FAILED:
        return {
          icon: <AlertCircle className={iconClass} />,
          color: "text-red-600",
          bg: "bg-red-100",
          label: "Failed"
        };
      case TaskState.CANCELLED:
        return {
          icon: <Square className={iconClass} />,
          color: "text-gray-600",
          bg: "bg-gray-100",
          label: "Cancelled"
        };
      default:
        return {
          icon: <Activity className={iconClass} />,
          color: "text-gray-600",
          bg: "bg-gray-100",
          label: "Unknown"
        };
    }
  };

  const statusIndicator = getStatusIndicator();

  // Get progress bar color based on state and percentage
  const getProgressColor = () => {
    switch (task.state) {
      case TaskState.COMPLETED:
        return "bg-green-500";
      case TaskState.FAILED:
        return "bg-red-500";
      case TaskState.CANCELLED:
        return "bg-gray-500";
      case TaskState.RUNNING:
      case TaskState.ACTIVE:
        return progressMetrics.percentage > 75 ? "bg-green-500" : "bg-blue-500";
      default:
        return "bg-yellow-500";
    }
  };

  // Format time duration
  const formatDuration = (minutes: number): string => {
    if (minutes < 1) return "< 1 min";
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  if (compact) {
    return (
      <div className={cn("flex items-center space-x-3 p-3 rounded-lg border", className)}>
        <div className={cn("p-2 rounded-full", statusIndicator.bg)}>
          <div className={statusIndicator.color}>
            {statusIndicator.icon}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium truncate">
              Task {task.taskId.slice(0, 8)}
            </span>
            <Badge variant="secondary" className="text-xs">
              {progressMetrics.percentage}%
            </Badge>
          </div>
          <Progress
            value={progressMetrics.percentage}
            className="h-2"
          />
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={cn("p-2 rounded-full", statusIndicator.bg)}>
              <div className={statusIndicator.color}>
                {statusIndicator.icon}
              </div>
            </div>
            <div>
              <CardTitle className="text-base">
                Task {task.taskId.slice(0, 8)}
              </CardTitle>
              <CardDescription>
                {progressMetrics.phase}
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className={statusIndicator.color}>
            {statusIndicator.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progressMetrics.percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={cn("h-2.5 rounded-full transition-all duration-300", getProgressColor())}
              style={{ width: `${progressMetrics.percentage}%` }}
              role="progressbar"
              aria-valuenow={progressMetrics.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Task progress: ${progressMetrics.percentage}%`}
            />
          </div>
        </div>

        {showDetails && (
          <>
            {/* Steps Progress */}
            {progressMetrics.totalSteps > 1 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Steps</span>
                  <span className="font-medium">
                    {progressMetrics.stepsCompleted} of {progressMetrics.totalSteps}
                  </span>
                </div>
                <div className="flex space-x-1">
                  {Array.from({ length: progressMetrics.totalSteps }, (_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 h-2 rounded-full",
                        i < progressMetrics.stepsCompleted
                          ? getProgressColor()
                          : "bg-gray-200"
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Timing Information */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <Timer className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Elapsed</p>
                  <p className="font-medium">{formatDuration(progressMetrics.elapsedTime)}</p>
                </div>
              </div>

              {progressMetrics.estimatedTimeRemaining && (
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Est. Remaining</p>
                    <p className="font-medium">
                      {formatDuration(progressMetrics.estimatedTimeRemaining)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error Information */}
            {task.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Error Details</p>
                    <p className="text-sm text-red-700 mt-1">{task.error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Process Information */}
            {task.pid && (
              <div className="text-xs text-muted-foreground">
                Process ID: {task.pid}
                {task.exitCode !== undefined && (
                  <span className="ml-2">Exit Code: {task.exitCode}</span>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * TaskProgressList Component
 * Displays multiple task progress indicators in a compact list format
 */
interface TaskProgressListProps {
  tasks: TaskStatus[];
  className?: string;
  maxItems?: number;
}

export function TaskProgressList({
  tasks,
  className,
  maxItems = 10
}: TaskProgressListProps) {
  const displayTasks = tasks.slice(0, maxItems);

  if (displayTasks.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No active tasks</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {displayTasks.map((task) => (
        <TaskProgress
          key={task.taskId}
          task={task}
          compact
          showDetails={false}
        />
      ))}
    </div>
  );
}