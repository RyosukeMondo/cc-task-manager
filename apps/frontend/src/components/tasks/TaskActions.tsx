'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { ApiTaskDto } from '@cc-task-manager/schemas';
import { ApiTaskStatus } from '@cc-task-manager/schemas';
import { useTaskActions } from '@/hooks/useTaskActions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { XCircle, RotateCcw, Trash2, Loader2 } from 'lucide-react';

export interface TaskActionsProps {
  task: ApiTaskDto;
  className?: string;
}

/**
 * TaskActions Component
 *
 * Provides action buttons for task lifecycle management:
 * - Cancel: Available for PENDING or RUNNING tasks
 * - Retry: Available for FAILED tasks (creates new task with same params)
 * - Delete: Available for COMPLETED, FAILED, or CANCELLED tasks
 *
 * All actions require confirmation via AlertDialog
 * Shows loading state during mutations
 * Displays success/error toasts
 */
export const TaskActions = React.memo<TaskActionsProps>(
  ({ task, className }) => {
    const router = useRouter();
    const { toast } = useToast();
    const { cancelTask, retryTask, deleteTask, isPending } = useTaskActions();

    const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [retryDialogOpen, setRetryDialogOpen] = React.useState(false);

    const handleCancel = React.useCallback(() => {
      if (!task.id) return;
      cancelTask(task.id, {
        onSuccess: () => {
          toast({
            title: 'Task cancelled',
            description: `Task "${task.title}" has been cancelled successfully.`,
          });
          setCancelDialogOpen(false);
        },
        onError: (error) => {
          toast({
            title: 'Failed to cancel task',
            description:
              error instanceof Error
                ? error.message
                : 'An unexpected error occurred.',
            variant: 'destructive',
          });
        },
      });
    }, [cancelTask, task.id, task.title, toast]);

    const handleRetry = React.useCallback(() => {
      retryTask(task, {
        onSuccess: (newTask) => {
          toast({
            title: 'Task retry initiated',
            description: `A new task "${newTask.title}" has been created.`,
          });
          setRetryDialogOpen(false);
          // Navigate to the new task
          router.push(`/tasks/${newTask.id}`);
        },
        onError: (error) => {
          toast({
            title: 'Failed to retry task',
            description:
              error instanceof Error
                ? error.message
                : 'An unexpected error occurred.',
            variant: 'destructive',
          });
        },
      });
    }, [retryTask, task, toast, router]);

    const handleDelete = React.useCallback(() => {
      if (!task.id) return;
      deleteTask(task.id, {
        onSuccess: () => {
          toast({
            title: 'Task deleted',
            description: `Task "${task.title}" has been deleted successfully.`,
          });
          setDeleteDialogOpen(false);
          // Redirect to tasks list
          router.push('/tasks');
        },
        onError: (error) => {
          toast({
            title: 'Failed to delete task',
            description:
              error instanceof Error
                ? error.message
                : 'An unexpected error occurred.',
            variant: 'destructive',
          });
        },
      });
    }, [deleteTask, task.id, task.title, toast, router]);

    // Determine which buttons to show based on task status
    const showCancel =
      task.status === ApiTaskStatus.PENDING || task.status === ApiTaskStatus.RUNNING;
    const showRetry = task.status === ApiTaskStatus.FAILED;
    const showDelete =
      task.status === ApiTaskStatus.COMPLETED ||
      task.status === ApiTaskStatus.FAILED ||
      task.status === ApiTaskStatus.CANCELLED;

    // If no actions are available, don't render anything
    if (!showCancel && !showRetry && !showDelete) {
      return null;
    }

    return (
      <div className={className}>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Cancel Button */}
          {showCancel && (
            <AlertDialog
              open={cancelDialogOpen}
              onOpenChange={setCancelDialogOpen}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isPending}
                  aria-label="Cancel task"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Cancel
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Task</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel this task? This action
                    cannot be undone, and the task will stop executing.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>No, keep running</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel}>
                    Yes, cancel task
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Retry Button */}
          {showRetry && (
            <AlertDialog
              open={retryDialogOpen}
              onOpenChange={setRetryDialogOpen}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="default"
                  disabled={isPending}
                  aria-label="Retry task"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4 mr-2" />
                  )}
                  Retry
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Retry Task</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will create a new task with the same parameters as this
                    failed task. You will be redirected to the new task page.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRetry}>
                    Retry Task
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Delete Button */}
          {showDelete && (
            <AlertDialog
              open={deleteDialogOpen}
              onOpenChange={setDeleteDialogOpen}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={isPending}
                  aria-label="Delete task"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Task</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this task? This action
                    cannot be undone, and all task data will be permanently
                    removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Task
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    );
  }
);

TaskActions.displayName = 'TaskActions';
