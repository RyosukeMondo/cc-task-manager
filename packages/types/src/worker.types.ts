import { z } from 'zod';
import { 
  ProcessConfigSchema,
  ClaudeCodeOptionsSchema,
  TaskExecutionRequestSchema,
  WorkerConfigSchema,
  TaskStatusSchema
} from '@cc-task-manager/schemas/src/worker.schemas';

/**
 * Task state enumeration for process lifecycle tracking
 * Represents all possible states in the task execution lifecycle
 */
export enum TaskState {
  PENDING = 'pending',
  RUNNING = 'running',
  ACTIVE = 'active',
  IDLE = 'idle',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * TypeScript type exports derived from Zod schemas
 * Provides compile-time type safety for all configuration objects
 */
export type ProcessConfig = z.infer<typeof ProcessConfigSchema>;
export type ClaudeCodeOptions = z.infer<typeof ClaudeCodeOptionsSchema>;
export type TaskExecutionRequest = z.infer<typeof TaskExecutionRequestSchema>;
export type WorkerConfig = z.infer<typeof WorkerConfigSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;