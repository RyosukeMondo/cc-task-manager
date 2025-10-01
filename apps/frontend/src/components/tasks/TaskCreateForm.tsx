'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createTaskSchema, ApiTaskPriority, type CreateApiTaskDto } from '@cc-task-manager/schemas';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api/contract-client';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from '@/hooks/useToast';
import { useRouter } from 'next/navigation';

interface TaskCreateFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TaskCreateForm({ onSuccess, onCancel }: TaskCreateFormProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateApiTaskDto>({
    resolver: zodResolver(createTaskSchema),
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      priority: ApiTaskPriority.MEDIUM,
    },
  });

  // Watch title for character count
  const title = watch('title');
  const titleLength = title?.length || 0;

  // Watch description for character count
  const description = watch('description');
  const descriptionLength = description?.length || 0;

  // Auto-focus title field when component mounts
  React.useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  // Mutation for creating task
  const createTaskMutation = useMutation({
    mutationFn: async (data: CreateApiTaskDto) => {
      return apiClient.createTask(data);
    },
    onSuccess: (createdTask) => {
      // Invalidate tasks query to refetch
      queryClient.invalidateQueries({ queryKey: ['tasks'] });

      // Show success toast
      toast({
        title: 'Task created successfully!',
        variant: 'success',
      });

      // Reset form
      reset();

      // Call success callback
      onSuccess?.();
    },
    onError: (error: any) => {
      // Handle different error types
      if (error?.response?.status === 400) {
        // Map backend validation errors to form fields
        const backendErrors = error.response.data?.errors;
        if (backendErrors) {
          Object.keys(backendErrors).forEach((field) => {
            setError(field as keyof CreateApiTaskDto, {
              type: 'manual',
              message: backendErrors[field],
            });
          });
        } else {
          toast({
            title: 'Failed to create task. Please check your input.',
            variant: 'destructive',
          });
        }
      } else if (error?.response?.status === 401) {
        // Redirect to login on unauthorized
        router.push('/login');
      } else {
        // Generic error for 500/network errors
        toast({
          title: 'Failed to create task. Please try again.',
          variant: 'destructive',
        });
      }
    },
  });

  const onSubmit = async (data: CreateApiTaskDto) => {
    await createTaskMutation.mutateAsync(data);
  };

  // Handle Ctrl+Enter to submit
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  };

  // Handle Enter in title field (move to description, not submit)
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const descriptionField = document.getElementById('description') as HTMLTextAreaElement;
      descriptionField?.focus();
    }
  };

  const isLoading = isSubmitting || createTaskMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="space-y-4 p-4">
      {/* Title field */}
      <div className="space-y-2">
        <Label htmlFor="title" className="flex items-center justify-between">
          <span>
            Title <span className="text-red-500">*</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {titleLength}/200
          </span>
        </Label>
        <Input
          id="title"
          ref={titleInputRef}
          placeholder="Enter task title"
          {...register('title')}
          disabled={isLoading}
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'title-error' : undefined}
          aria-required="true"
          onKeyDown={handleTitleKeyDown}
        />
        {errors.title && (
          <p
            id="title-error"
            className="text-sm text-red-600"
            role="alert"
            aria-live="polite"
          >
            {errors.title.message}
          </p>
        )}
      </div>

      {/* Description field */}
      <div className="space-y-2">
        <Label htmlFor="description" className="flex items-center justify-between">
          <span>Description</span>
          <span className="text-xs text-muted-foreground">
            {descriptionLength}/2000
          </span>
        </Label>
        <Textarea
          id="description"
          placeholder="Enter task description (optional)"
          rows={4}
          {...register('description')}
          disabled={isLoading}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? 'description-error' : undefined}
        />
        {errors.description && (
          <p
            id="description-error"
            className="text-sm text-red-600"
            role="alert"
            aria-live="polite"
          >
            {errors.description.message}
          </p>
        )}
      </div>

      {/* Priority field */}
      <div className="space-y-2">
        <Label htmlFor="priority">Priority</Label>
        <Controller
          name="priority"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              disabled={isLoading}
            >
              <SelectTrigger
                id="priority"
                aria-invalid={!!errors.priority}
                aria-describedby={errors.priority ? 'priority-error' : undefined}
              >
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ApiTaskPriority.LOW}>Low</SelectItem>
                <SelectItem value={ApiTaskPriority.MEDIUM}>Medium</SelectItem>
                <SelectItem value={ApiTaskPriority.HIGH}>High</SelectItem>
                <SelectItem value={ApiTaskPriority.URGENT}>Urgent</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.priority && (
          <p
            id="priority-error"
            className="text-sm text-red-600"
            role="alert"
            aria-live="polite"
          >
            {errors.priority.message}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 justify-end pt-4">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={isLoading || Object.keys(errors).length > 0}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Task'
          )}
        </Button>
      </div>

      {/* Keyboard shortcut hint */}
      <p className="text-xs text-muted-foreground text-center pt-2">
        Press <kbd className="px-1 py-0.5 bg-muted rounded">Ctrl+Enter</kbd> to submit
      </p>
    </form>
  );
}
