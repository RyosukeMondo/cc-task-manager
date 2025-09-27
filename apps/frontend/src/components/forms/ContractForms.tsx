'use client';

import React from 'react';
import { SubmitHandler } from 'react-hook-form';
import {
  ProcessConfigSchema,
  TaskExecutionRequestSchema,
  WorkerConfigSchema,
  ClaudeCodeOptionsSchema,
  validateProcessConfig,
  validateTaskExecutionRequest,
  validateWorkerConfig,
  validateClaudeCodeOptions
} from '@cc-task-manager/schemas';
import type {
  ProcessConfig,
  TaskExecutionRequest,
  WorkerConfig,
  ClaudeCodeOptions
} from '@cc-task-manager/types';
import { BaseForm } from './BaseForm';
import { TextField, NumberField, TextareaField, SelectField, SelectOption } from './FormField';

/**
 * Process configuration form using existing contract validation
 * Implements Single Responsibility Principle for process config creation
 */
interface ProcessConfigFormProps {
  onSubmit: SubmitHandler<ProcessConfig>;
  defaultValues?: Partial<ProcessConfig>;
  isLoading?: boolean;
  className?: string;
}

export function ProcessConfigForm({
  onSubmit,
  defaultValues,
  isLoading,
  className
}: ProcessConfigFormProps) {
  const handleSubmit: SubmitHandler<ProcessConfig> = async (data) => {
    // Validate using existing contract validation
    const validatedData = validateProcessConfig(data);
    await onSubmit(validatedData);
  };

  return (
    <BaseForm
      schema={ProcessConfigSchema}
      defaultValues={defaultValues}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      title="Process Configuration"
      description="Configure process parameters for Claude Code execution"
      submitText="Create Process Config"
      className={className}
    >
      {(form) => (
        <>
          <TextField
            form={form}
            name="jobId"
            label="Job ID"
            placeholder="unique-job-identifier"
            required
            description="Unique identifier for the job execution"
          />

          <TextField
            form={form}
            name="sessionName"
            label="Session Name"
            placeholder="session-name"
            required
            description="Name for the execution session"
          />

          <TextField
            form={form}
            name="workingDirectory"
            label="Working Directory"
            placeholder="/path/to/working/directory"
            required
            description="Directory where the process will execute"
          />

          <TextField
            form={form}
            name="pythonExecutable"
            label="Python Executable"
            placeholder="python3"
            description="Path to Python executable (defaults to python3)"
          />

          <TextField
            form={form}
            name="wrapperScriptPath"
            label="Wrapper Script Path"
            placeholder="/path/to/wrapper/script"
            required
            description="Path to the wrapper script for execution"
          />
        </>
      )}
    </BaseForm>
  );
}

/**
 * Task execution request form using existing contract validation
 * Implements Single Responsibility Principle for task request creation
 */
interface TaskExecutionRequestFormProps {
  onSubmit: SubmitHandler<TaskExecutionRequest>;
  defaultValues?: Partial<TaskExecutionRequest>;
  isLoading?: boolean;
  className?: string;
}

export function TaskExecutionRequestForm({
  onSubmit,
  defaultValues,
  isLoading,
  className
}: TaskExecutionRequestFormProps) {
  const permissionModeOptions: SelectOption[] = [
    { value: 'bypassPermissions', label: 'Bypass Permissions' },
    { value: 'default', label: 'Default' },
    { value: 'plan', label: 'Plan Mode' },
    { value: 'acceptEdits', label: 'Accept Edits' }
  ];

  const handleSubmit: SubmitHandler<TaskExecutionRequest> = async (data) => {
    // Validate using existing contract validation
    const validatedData = validateTaskExecutionRequest(data);
    await onSubmit(validatedData);
  };

  return (
    <BaseForm
      schema={TaskExecutionRequestSchema}
      defaultValues={{
        sessionName: `task-${Date.now()}`,
        workingDirectory: process.cwd?.() || '/workspace',
        options: {
          timeout: 300000,
          permission_mode: 'default'
        },
        timeoutMs: 300000,
        ...defaultValues
      }}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      title="Task Execution Request"
      description="Configure a new task execution with Claude Code options"
      submitText="Create Task"
      className={className}
    >
      {(form) => (
        <>
          <TextField
            form={form}
            name="id"
            label="Task ID"
            placeholder="unique-task-id"
            required
            description="Unique identifier for the task"
          />

          <TextareaField
            form={form}
            name="prompt"
            label="Task Prompt"
            placeholder="Describe what you want Claude Code to accomplish..."
            rows={4}
            required
            description="Detailed description of the task to execute"
          />

          <TextField
            form={form}
            name="sessionName"
            label="Session Name"
            placeholder="unique-session-name"
            required
            description="Name for the execution session"
          />

          <TextField
            form={form}
            name="workingDirectory"
            label="Working Directory"
            placeholder="/path/to/working/directory"
            required
            description="Directory where the task will execute"
          />

          <NumberField
            form={form}
            name="timeoutMs"
            label="Timeout (milliseconds)"
            placeholder="300000"
            min={1000}
            description="Maximum time allowed for task execution"
          />

          {/* Claude Code Options Section */}
          <div className="space-y-4 border rounded-md p-4">
            <h3 className="text-sm font-medium">Claude Code Options</h3>

            <TextField
              form={form}
              name="options.model"
              label="Model"
              placeholder="claude-3-opus"
              description="AI model to use for task execution"
            />

            <SelectField
              form={form}
              name="options.permission_mode"
              label="Permission Mode"
              options={permissionModeOptions}
              placeholder="Select permission mode"
              description="How Claude Code handles permissions"
            />

            <NumberField
              form={form}
              name="options.maxTokens"
              label="Max Tokens"
              placeholder="8192"
              min={1}
              description="Maximum tokens for the response"
            />

            <NumberField
              form={form}
              name="options.temperature"
              label="Temperature"
              placeholder="0.7"
              min={0}
              max={2}
              step={0.1}
              description="Randomness in AI responses (0-2)"
            />

            <NumberField
              form={form}
              name="options.timeout"
              label="Options Timeout (milliseconds)"
              placeholder="300000"
              min={1000}
              description="Timeout for individual operations"
            />
          </div>
        </>
      )}
    </BaseForm>
  );
}

/**
 * Claude Code options form using existing contract validation
 * Implements Single Responsibility Principle for options configuration
 */
interface ClaudeCodeOptionsFormProps {
  onSubmit: SubmitHandler<ClaudeCodeOptions>;
  defaultValues?: Partial<ClaudeCodeOptions>;
  isLoading?: boolean;
  className?: string;
}

export function ClaudeCodeOptionsForm({
  onSubmit,
  defaultValues,
  isLoading,
  className
}: ClaudeCodeOptionsFormProps) {
  const permissionModeOptions: SelectOption[] = [
    { value: 'bypassPermissions', label: 'Bypass Permissions' },
    { value: 'default', label: 'Default' },
    { value: 'plan', label: 'Plan Mode' },
    { value: 'acceptEdits', label: 'Accept Edits' }
  ];

  const handleSubmit: SubmitHandler<ClaudeCodeOptions> = async (data) => {
    // Validate using existing contract validation
    const validatedData = validateClaudeCodeOptions(data);
    await onSubmit(validatedData);
  };

  return (
    <BaseForm
      schema={ClaudeCodeOptionsSchema}
      defaultValues={{
        timeout: 300000,
        permission_mode: 'default',
        ...defaultValues
      }}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      title="Claude Code Options"
      description="Configure Claude Code API parameters"
      submitText="Save Options"
      className={className}
    >
      {(form) => (
        <>
          <TextField
            form={form}
            name="model"
            label="Model"
            placeholder="claude-3-opus"
            description="AI model to use for requests"
          />

          <SelectField
            form={form}
            name="permission_mode"
            label="Permission Mode"
            options={permissionModeOptions}
            placeholder="Select permission mode"
            description="How Claude Code handles file permissions"
          />

          <NumberField
            form={form}
            name="maxTokens"
            label="Max Tokens"
            placeholder="8192"
            min={1}
            description="Maximum tokens for responses"
          />

          <NumberField
            form={form}
            name="temperature"
            label="Temperature"
            placeholder="0.7"
            min={0}
            max={2}
            step={0.1}
            description="Randomness in AI responses (0-2)"
          />

          <NumberField
            form={form}
            name="timeout"
            label="Timeout (milliseconds)"
            placeholder="300000"
            min={1000}
            description="Maximum time allowed for operations"
          />
        </>
      )}
    </BaseForm>
  );
}

/**
 * Worker configuration form using existing contract validation
 * Implements Single Responsibility Principle for worker config creation
 */
interface WorkerConfigFormProps {
  onSubmit: SubmitHandler<WorkerConfig>;
  defaultValues?: Partial<WorkerConfig>;
  isLoading?: boolean;
  className?: string;
}

export function WorkerConfigForm({
  onSubmit,
  defaultValues,
  isLoading,
  className
}: WorkerConfigFormProps) {
  const logLevelOptions: SelectOption[] = [
    { value: 'fatal', label: 'Fatal' },
    { value: 'error', label: 'Error' },
    { value: 'warn', label: 'Warning' },
    { value: 'info', label: 'Info' },
    { value: 'debug', label: 'Debug' },
    { value: 'trace', label: 'Trace' }
  ];

  const handleSubmit: SubmitHandler<WorkerConfig> = async (data) => {
    // Validate using existing contract validation
    const validatedData = validateWorkerConfig(data);
    await onSubmit(validatedData);
  };

  return (
    <BaseForm
      schema={WorkerConfigSchema}
      defaultValues={defaultValues}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      title="Worker Configuration"
      description="Configure worker service parameters and monitoring settings"
      submitText="Save Worker Config"
      className={className}
    >
      {(form) => (
        <>
          {/* Process Management */}
          <div className="space-y-4 border rounded-md p-4">
            <h3 className="text-sm font-medium">Process Management</h3>

            <NumberField
              form={form}
              name="maxConcurrentTasks"
              label="Max Concurrent Tasks"
              placeholder="5"
              min={1}
              description="Maximum number of tasks to run simultaneously"
            />

            <NumberField
              form={form}
              name="processTimeoutMs"
              label="Process Timeout (milliseconds)"
              placeholder="600000"
              min={1000}
              description="Maximum time for process execution"
            />

            <NumberField
              form={form}
              name="gracefulShutdownMs"
              label="Graceful Shutdown (milliseconds)"
              placeholder="5000"
              min={1000}
              description="Time to wait for graceful shutdown"
            />
          </div>

          {/* Monitoring Settings */}
          <div className="space-y-4 border rounded-md p-4">
            <h3 className="text-sm font-medium">Monitoring Settings</h3>

            <NumberField
              form={form}
              name="pidCheckIntervalMs"
              label="PID Check Interval (milliseconds)"
              placeholder="1000"
              min={100}
              description="How often to check process status"
            />

            <NumberField
              form={form}
              name="fileWatchTimeoutMs"
              label="File Watch Timeout (milliseconds)"
              placeholder="30000"
              min={1000}
              description="Timeout for file watching operations"
            />

            <NumberField
              form={form}
              name="inactivityTimeoutMs"
              label="Inactivity Timeout (milliseconds)"
              placeholder="120000"
              min={1000}
              description="Time before considering a process inactive"
            />
          </div>

          {/* Python Settings */}
          <div className="space-y-4 border rounded-md p-4">
            <h3 className="text-sm font-medium">Python Settings</h3>

            <TextField
              form={form}
              name="pythonExecutable"
              label="Python Executable"
              placeholder="python3"
              description="Path to Python executable"
            />

            <TextField
              form={form}
              name="wrapperScriptPath"
              label="Wrapper Script Path"
              placeholder="/path/to/wrapper/script"
              required
              description="Path to the wrapper script"
            />

            <TextField
              form={form}
              name="wrapperWorkingDir"
              label="Wrapper Working Directory"
              placeholder="/path/to/working/directory"
              description="Working directory for wrapper script"
            />
          </div>

          {/* Redis/Queue Settings */}
          <div className="space-y-4 border rounded-md p-4">
            <h3 className="text-sm font-medium">Queue Settings</h3>

            <TextField
              form={form}
              name="queueName"
              label="Queue Name"
              placeholder="claude-code-tasks"
              description="Name of the task queue"
            />

            <TextField
              form={form}
              name="redisHost"
              label="Redis Host"
              placeholder="localhost"
              description="Redis server hostname"
            />

            <NumberField
              form={form}
              name="redisPort"
              label="Redis Port"
              placeholder="6379"
              min={1}
              max={65535}
              description="Redis server port"
            />

            <TextField
              form={form}
              name="redisPassword"
              label="Redis Password"
              type="password"
              placeholder="(optional)"
              description="Redis server password"
            />
          </div>

          {/* Logging Settings */}
          <div className="space-y-4 border rounded-md p-4">
            <h3 className="text-sm font-medium">Logging Settings</h3>

            <SelectField
              form={form}
              name="logLevel"
              label="Log Level"
              options={logLevelOptions}
              placeholder="Select log level"
              description="Minimum log level to record"
            />

            <TextField
              form={form}
              name="sessionLogsDir"
              label="Session Logs Directory"
              placeholder="/path/to/logs"
              description="Directory to store session logs"
            />
          </div>
        </>
      )}
    </BaseForm>
  );
}