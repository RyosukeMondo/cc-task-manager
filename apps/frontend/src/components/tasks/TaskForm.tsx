'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TaskExecutionRequestSchema, ClaudeCodeOptionsSchema } from '@cc-task-manager/schemas';
import type { TaskExecutionRequest } from '@cc-task-manager/types';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';

// Form schema using existing contract validation
const TaskFormSchema = TaskExecutionRequestSchema.omit({ id: true });

type TaskFormData = Omit<TaskExecutionRequest, 'id'>;

interface TaskFormProps {
  onSubmit: (data: TaskFormData) => Promise<void>;
  defaultValues?: Partial<TaskFormData>;
  isLoading?: boolean;
  className?: string;
}

/**
 * TaskForm component following Single Responsibility Principle
 * Responsible only for task creation/editing form with contract validation
 * Uses existing TaskExecutionRequestSchema for validation
 */
export function TaskForm({
  onSubmit,
  defaultValues,
  isLoading = false,
  className
}: TaskFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset
  } = useForm<TaskFormData>({
    resolver: zodResolver(TaskFormSchema),
    defaultValues: {
      prompt: '',
      sessionName: `task-${Date.now()}`,
      workingDirectory: process.cwd?.() || '/workspace',
      options: {
        timeout: 300000,
        permission_mode: 'default'
      },
      timeoutMs: 300000,
      ...defaultValues
    }
  });

  const permissionModes = [
    { value: 'bypassPermissions', label: 'Bypass Permissions' },
    { value: 'default', label: 'Default' },
    { value: 'plan', label: 'Plan Mode' },
    { value: 'acceptEdits', label: 'Accept Edits' }
  ] as const;

  const handleFormSubmit = async (data: TaskFormData) => {
    try {
      await onSubmit(data);
      reset();
    } catch (error) {
      // Error handling will be managed by parent component
      console.error('Form submission error:', error);
    }
  };

  const formatErrorMessage = (error: any): string => {
    if (typeof error?.message === 'string') return error.message;
    if (typeof error === 'string') return error;
    return 'Invalid input';
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>Create New Task</CardTitle>
        <CardDescription>
          Configure a new task execution with Claude Code options
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Prompt Field */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Task Prompt *</Label>
            <Textarea
              id="prompt"
              placeholder="Describe what you want Claude Code to accomplish..."
              className="min-h-[100px]"
              {...register('prompt')}
            />
            {errors.prompt && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {formatErrorMessage(errors.prompt)}
              </div>
            )}
          </div>

          {/* Session Name */}
          <div className="space-y-2">
            <Label htmlFor="sessionName">Session Name *</Label>
            <Input
              id="sessionName"
              placeholder="unique-session-name"
              {...register('sessionName')}
            />
            {errors.sessionName && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {formatErrorMessage(errors.sessionName)}
              </div>
            )}
          </div>

          {/* Working Directory */}
          <div className="space-y-2">
            <Label htmlFor="workingDirectory">Working Directory *</Label>
            <Input
              id="workingDirectory"
              placeholder="/path/to/working/directory"
              {...register('workingDirectory')}
            />
            {errors.workingDirectory && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                {formatErrorMessage(errors.workingDirectory)}
              </div>
            )}
          </div>

          {/* Claude Code Options */}
          <div className="space-y-4 border rounded-md p-4">
            <h3 className="text-sm font-medium">Claude Code Options</h3>

            {/* Model */}
            <div className="space-y-2">
              <Label htmlFor="options.model">Model</Label>
              <Input
                id="options.model"
                placeholder="claude-3-opus (optional)"
                {...register('options.model')}
              />
            </div>

            {/* Permission Mode */}
            <div className="space-y-2">
              <Label htmlFor="options.permission_mode">Permission Mode</Label>
              <Select
                value={watch('options.permission_mode')}
                onValueChange={(value) => setValue('options.permission_mode', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select permission mode" />
                </SelectTrigger>
                <SelectContent>
                  {permissionModes.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
              <Label htmlFor="options.maxTokens">Max Tokens</Label>
              <Input
                id="options.maxTokens"
                type="number"
                placeholder="8192"
                {...register('options.maxTokens', { valueAsNumber: true })}
              />
              {errors.options?.maxTokens && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  Must be a positive number
                </div>
              )}
            </div>

            {/* Temperature */}
            <div className="space-y-2">
              <Label htmlFor="options.temperature">Temperature</Label>
              <Input
                id="options.temperature"
                type="number"
                step="0.1"
                min="0"
                max="2"
                placeholder="0.7"
                {...register('options.temperature', { valueAsNumber: true })}
              />
              {errors.options?.temperature && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  Must be between 0 and 2
                </div>
              )}
            </div>

            {/* Timeout */}
            <div className="space-y-2">
              <Label htmlFor="timeoutMs">Timeout (milliseconds)</Label>
              <Input
                id="timeoutMs"
                type="number"
                placeholder="300000"
                {...register('timeoutMs', { valueAsNumber: true })}
              />
              {errors.timeoutMs && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  Must be a positive number
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="w-full"
          >
            {(isSubmitting || isLoading) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isSubmitting || isLoading ? 'Creating Task...' : 'Create Task'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}