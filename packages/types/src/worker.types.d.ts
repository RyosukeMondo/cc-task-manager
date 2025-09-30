import { z } from 'zod';
import { ProcessConfigSchema, ClaudeCodeOptionsSchema, TaskExecutionRequestSchema, WorkerConfigSchema, TaskStatusSchema } from '../../schemas/dist';
export { TaskState } from '../../schemas/dist';
export type ProcessConfig = z.infer<typeof ProcessConfigSchema>;
export type ClaudeCodeOptions = z.infer<typeof ClaudeCodeOptionsSchema>;
export type TaskExecutionRequest = z.infer<typeof TaskExecutionRequestSchema>;
export type WorkerConfig = z.infer<typeof WorkerConfigSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
