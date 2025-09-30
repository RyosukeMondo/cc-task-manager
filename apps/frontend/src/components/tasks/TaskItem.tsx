import * as React from 'react';
import { Task, TaskStatus, TaskPriority } from '@/types/task';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TaskItemProps {
  task: Task;
  onStatusChange?: (taskId: string, status: TaskStatus) => void;
  onEdit?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  className?: string;
}

/**
 * TaskItem - Presentational component for displaying a single task
 *
 * Features:
 * - Displays task details (title, description, status, priority, timestamps)
 * - Status badges with visual distinction
 * - Priority indicators
 * - Interactive buttons for actions
 * - Accessible with ARIA labels
 * - Responsive design
 */
export const TaskItem = React.memo<TaskItemProps>(({
  task,
  onStatusChange,
  onEdit,
  onDelete,
  className,
}) => {
  const getStatusVariant = (status: TaskStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'default';
      case TaskStatus.ACTIVE:
        return 'secondary';
      case TaskStatus.FAILED:
        return 'destructive';
      case TaskStatus.PENDING:
      default:
        return 'outline';
    }
  };

  const getPriorityVariant = (priority: TaskPriority): 'default' | 'secondary' | 'destructive' => {
    switch (priority) {
      case TaskPriority.HIGH:
        return 'destructive';
      case TaskPriority.MEDIUM:
        return 'secondary';
      case TaskPriority.LOW:
      default:
        return 'default';
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        className
      )}
      role="article"
      aria-label={`Task: ${task.title}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">{task.title}</CardTitle>
              <Badge
                variant={getStatusVariant(task.status)}
                aria-label={`Status: ${task.status}`}
              >
                {task.status}
              </Badge>
              {task.priority && (
                <Badge
                  variant={getPriorityVariant(task.priority)}
                  aria-label={`Priority: ${task.priority}`}
                >
                  {task.priority}
                </Badge>
              )}
            </div>
            {task.description && (
              <CardDescription>{task.description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground space-y-1">
            <div>
              Created: <time dateTime={new Date(task.createdAt).toISOString()}>
                {formatDate(task.createdAt)}
              </time>
            </div>
            {task.updatedAt && (
              <div>
                Updated: <time dateTime={new Date(task.updatedAt).toISOString()}>
                  {formatDate(task.updatedAt)}
                </time>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onStatusChange && task.status !== TaskStatus.COMPLETED && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange(task.id, TaskStatus.COMPLETED)}
                aria-label={`Mark task "${task.title}" as completed`}
              >
                Complete
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(task.id)}
                aria-label={`Edit task "${task.title}"`}
              >
                Edit
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(task.id)}
                aria-label={`Delete task "${task.title}"`}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

TaskItem.displayName = 'TaskItem';