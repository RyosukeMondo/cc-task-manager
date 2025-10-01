import * as React from 'react';
import { Task, TaskStatus, TaskPriority } from '@/types/task';
import { formatDistanceToNow } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  XOctagon,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TaskDetailProps {
  task: Task;
  className?: string;
}

/**
 * TaskDetail - Displays comprehensive task metadata with color-coded status indicators
 *
 * Features:
 * - Card layout with task metadata
 * - Status badges with icons and colors
 * - Priority badges with color coding
 * - Formatted timestamps with relative time
 * - Error message display for failed tasks
 * - Accessible with ARIA labels
 */
export const TaskDetail = React.memo<TaskDetailProps>(({ task, className }) => {
  const getStatusConfig = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.TODO:
        return {
          variant: 'outline' as const,
          className: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: <Clock className="w-3 h-3" />,
        };
      case TaskStatus.IN_PROGRESS:
        return {
          variant: 'secondary' as const,
          className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
        };
      case TaskStatus.IN_REVIEW:
        return {
          variant: 'secondary' as const,
          className: 'bg-purple-50 text-purple-700 border-purple-200',
          icon: <AlertCircle className="w-3 h-3" />,
        };
      case TaskStatus.DONE:
        return {
          variant: 'default' as const,
          className: 'bg-green-50 text-green-700 border-green-200',
          icon: <CheckCircle2 className="w-3 h-3" />,
        };
      case TaskStatus.CANCELLED:
        return {
          variant: 'destructive' as const,
          className: 'bg-red-50 text-red-700 border-red-200',
          icon: <XCircle className="w-3 h-3" />,
        };
      default:
        return {
          variant: 'outline' as const,
          className: '',
          icon: null,
        };
    }
  };

  const getPriorityConfig = (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.LOW:
        return {
          variant: 'outline' as const,
          className: 'bg-blue-50 text-blue-700 border-blue-200',
        };
      case TaskPriority.MEDIUM:
        return {
          variant: 'secondary' as const,
          className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        };
      case TaskPriority.HIGH:
        return {
          variant: 'secondary' as const,
          className: 'bg-orange-50 text-orange-700 border-orange-200',
        };
      case TaskPriority.URGENT:
        return {
          variant: 'destructive' as const,
          className: 'bg-red-50 text-red-700 border-red-200',
        };
      default:
        return {
          variant: 'outline' as const,
          className: '',
        };
    }
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'N/A';
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'Invalid date';
    }
  };

  const statusConfig = getStatusConfig(task.status);
  const priorityConfig = getPriorityConfig(task.priority);

  return (
    <Card
      className={cn('w-full', className)}
      role="article"
      aria-label={`Task details: ${task.title}`}
    >
      <CardHeader>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <CardTitle className="text-2xl">{task.title}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={statusConfig.variant}
                className={cn('gap-1', statusConfig.className)}
                aria-label={`Status: ${task.status}`}
              >
                {statusConfig.icon}
                {task.status}
              </Badge>
              <Badge
                variant={priorityConfig.variant}
                className={priorityConfig.className}
                aria-label={`Priority: ${task.priority}`}
              >
                {task.priority}
              </Badge>
            </div>
          </div>
          {task.description && (
            <CardDescription className="text-base">
              {task.description}
            </CardDescription>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error Message Alert */}
        {task.status === TaskStatus.CANCELLED && task.errorMessage && (
          <Alert variant="destructive" className="border-red-200">
            <AlertCircle className="h-4 w-4" />
            <div className="ml-2">
              <h4 className="font-medium">Error</h4>
              <pre className="mt-2 text-sm font-mono whitespace-pre-wrap break-words">
                {task.errorMessage}
              </pre>
            </div>
          </Alert>
        )}

        {/* Timestamps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Created</p>
            <p className="text-sm">
              <time dateTime={task.createdAt}>
                {formatTimestamp(task.createdAt)}
              </time>
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Updated</p>
            <p className="text-sm">
              <time dateTime={task.updatedAt}>
                {formatTimestamp(task.updatedAt)}
              </time>
            </p>
          </div>

          {task.startedAt && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Started</p>
              <p className="text-sm">
                <time dateTime={task.startedAt}>
                  {formatTimestamp(task.startedAt)}
                </time>
              </p>
            </div>
          )}

          {task.completedAt && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Completed</p>
              <p className="text-sm">
                <time dateTime={task.completedAt}>
                  {formatTimestamp(task.completedAt)}
                </time>
              </p>
            </div>
          )}
        </div>

        {/* Additional Metadata */}
        {(task.tags && task.tags.length > 0) && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Tags</p>
            <div className="flex flex-wrap gap-2">
              {task.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {task.project && (
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Project</p>
            <p className="text-sm">{task.project.name}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

TaskDetail.displayName = 'TaskDetail';
