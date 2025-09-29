import { z } from 'zod';
import {
  ProcessConfigSchema,
  ClaudeCodeOptionsSchema,
  TaskExecutionRequestSchema,
  WorkerConfigSchema,
  TaskStatusSchema,
  TaskState
} from '../../schemas/dist';

// Re-export TaskState for convenience
export { TaskState } from '../../schemas/dist';

/**
 * TypeScript type exports derived from Zod schemas
 * Provides compile-time type safety for all configuration objects
 */
export type ProcessConfig = z.infer<typeof ProcessConfigSchema>;
export type ClaudeCodeOptions = z.infer<typeof ClaudeCodeOptionsSchema>;
export type TaskExecutionRequest = z.infer<typeof TaskExecutionRequestSchema>;
export type WorkerConfig = z.infer<typeof WorkerConfigSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;