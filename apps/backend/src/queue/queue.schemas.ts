import { z } from 'zod';

/**
 * Queue Job Schemas with Zod Validation
 *
 * Provides type-safe job data validation for all queue jobs following SSOT principle.
 * All job data is validated using these schemas before processing.
 */

// Job priority levels - defined early for use in schemas
export enum JobPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

// Base job metadata schema
const JobMetadataSchema = z.object({
  correlationId: z.string().uuid().optional(),
  userId: z.string().optional(),
  timestamp: z.date().default(() => new Date()),
  retryCount: z.number().int().min(0).default(0),
});

// Task notification job data
export const TaskNotificationJobSchema = z.object({
  type: z.literal('TASK_NOTIFICATION'),
  taskId: z.string(),
  notificationType: z.enum([
    'TASK_CREATED',
    'TASK_UPDATED',
    'TASK_ASSIGNED',
    'TASK_COMPLETED',
    'TASK_OVERDUE',
    'TASK_COMMENTED',
    'TASK_STATUS_CHANGED',
  ]),
  recipientIds: z.array(z.string()).min(1),
  taskTitle: z.string(),
  taskDescription: z.string().optional(),
  metadata: JobMetadataSchema,
});

// Email job data
export const EmailJobSchema = z.object({
  type: z.literal('EMAIL'),
  to: z.array(z.string().email()).min(1),
  subject: z.string().min(1),
  template: z.string(),
  templateData: z.record(z.unknown()),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string().or(z.instanceof(Buffer)),
    contentType: z.string().optional(),
  })).optional(),
  metadata: JobMetadataSchema,
});

// Report generation job data
export const ReportGenerationJobSchema = z.object({
  type: z.literal('REPORT_GENERATION'),
  reportType: z.enum([
    'TASK_SUMMARY',
    'USER_ACTIVITY',
    'PROJECT_PROGRESS',
    'OVERDUE_TASKS',
    'PERFORMANCE_METRICS',
  ]),
  parameters: z.object({
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    userId: z.string().optional(),
    projectId: z.string().optional(),
    includeSubtasks: z.boolean().default(false),
  }),
  format: z.enum(['PDF', 'EXCEL', 'CSV', 'JSON']).default('PDF'),
  recipients: z.array(z.string().email()).optional(),
  metadata: JobMetadataSchema,
});

// Data export job data
export const DataExportJobSchema = z.object({
  type: z.literal('DATA_EXPORT'),
  exportType: z.enum(['TASKS', 'USERS', 'PROJECTS', 'FULL_BACKUP']),
  filters: z.object({
    dateRange: z.object({
      start: z.date().optional(),
      end: z.date().optional(),
    }).optional(),
    status: z.array(z.string()).optional(),
    userIds: z.array(z.string()).optional(),
  }).optional(),
  format: z.enum(['JSON', 'CSV', 'SQL']).default('JSON'),
  destination: z.enum(['S3', 'EMAIL', 'DOWNLOAD']).default('DOWNLOAD'),
  destinationConfig: z.record(z.unknown()).optional(),
  metadata: JobMetadataSchema,
});

// Scheduled task job data
export const ScheduledTaskJobSchema = z.object({
  type: z.literal('SCHEDULED_TASK'),
  taskType: z.enum([
    'DATABASE_CLEANUP',
    'CACHE_REFRESH',
    'METRICS_AGGREGATION',
    'HEALTH_CHECK',
    'BACKUP',
  ]),
  schedule: z.string(), // Cron expression
  parameters: z.record(z.unknown()).optional(),
  metadata: JobMetadataSchema,
});

// Webhook delivery job data
export const WebhookDeliveryJobSchema = z.object({
  type: z.literal('WEBHOOK'),
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
  headers: z.record(z.string()).optional(),
  payload: z.record(z.unknown()),
  retryStrategy: z.object({
    maxRetries: z.number().int().min(0).max(10).default(3),
    backoffMultiplier: z.number().min(1).max(10).default(2),
    initialDelay: z.number().int().min(1000).default(1000), // milliseconds
  }).optional(),
  metadata: JobMetadataSchema,
});

// Claude Code task execution job data
export const ClaudeCodeTaskJobSchema = z.object({
  type: z.literal('CLAUDE_CODE_TASK'),
  prompt: z.string().min(1),
  workingDirectory: z.string().optional(),
  options: z.object({
    sessionId: z.string().optional(),
    resumeLastSession: z.boolean().default(false),
    exitOnComplete: z.boolean().default(true),
    permissionMode: z.enum(['ask', 'bypassPermissions']).default('ask'),
    timeout: z.number().int().min(0).max(3600000).default(300000), // 5 minutes default
  }).optional(),
  expectedDuration: z.number().int().min(0).optional(), // estimated duration in milliseconds
  priority: z.nativeEnum(JobPriority).default(JobPriority.NORMAL),
  metadata: JobMetadataSchema,
});

// Union type for all job types
export const QueueJobSchema = z.discriminatedUnion('type', [
  TaskNotificationJobSchema,
  EmailJobSchema,
  ReportGenerationJobSchema,
  DataExportJobSchema,
  ScheduledTaskJobSchema,
  WebhookDeliveryJobSchema,
  ClaudeCodeTaskJobSchema,
]);

// Job options schema for BullMQ
export const JobOptionsSchema = z.object({
  delay: z.number().int().min(0).optional(),
  attempts: z.number().int().min(1).max(10).default(3),
  backoff: z.object({
    type: z.enum(['fixed', 'exponential']).default('exponential'),
    delay: z.number().int().min(1000).default(5000),
  }).optional(),
  removeOnComplete: z.union([z.boolean(), z.number()]).default(true),
  removeOnFail: z.union([z.boolean(), z.number()]).default(false),
  priority: z.number().int().min(0).max(1000).optional(),
});

// Queue metrics schema
export const QueueMetricsSchema = z.object({
  queueName: z.string(),
  waiting: z.number().int().min(0),
  active: z.number().int().min(0),
  completed: z.number().int().min(0),
  failed: z.number().int().min(0),
  delayed: z.number().int().min(0),
  paused: z.boolean(),
  timestamp: z.date(),
});

// Additional enums and schemas for Queue Manager Service

// Job status enumeration
export enum JobStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELAYED = 'delayed',
  PAUSED = 'paused',
}

// Job retry strategy schema
export const JobRetryStrategySchema = z.object({
  maxAttempts: z.number().int().min(1).max(10).default(3),
  backoffType: z.enum(['fixed', 'exponential']).default('exponential'),
  backoffDelay: z.number().int().min(1000).default(5000),
});

// Delayed job options schema
export const DelayedJobOptionsSchema = z.object({
  executeAt: z.date().optional(),
  delay: z.number().int().min(0).optional(),
  priority: z.nativeEnum(JobPriority).optional(),
  timezone: z.string().optional(),
}).refine(data => data.executeAt || data.delay, {
  message: 'Either executeAt or delay must be provided',
});

// Enhanced queue manager options schema
export const QueueManagerOptionsSchema = z.object({
  priority: z.nativeEnum(JobPriority).optional(),
  delay: z.number().int().min(0).optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  retryStrategy: JobRetryStrategySchema.optional(),
  removeOnComplete: z.union([z.boolean(), z.number()]).optional(),
  removeOnFail: z.union([z.boolean(), z.number()]).optional(),
  jobId: z.string().optional(),
  timezone: z.string().optional(),
});

// Bulk job operation schema
export const BulkJobOperationSchema = z.object({
  jobIds: z.array(z.string()).min(1),
  operation: z.enum(['retry', 'cancel', 'updatePriority']),
  options: z.object({
    priority: z.nativeEnum(JobPriority).optional(),
    retryStrategy: JobRetryStrategySchema.optional(),
  }).optional(),
});

// Job search filters schema
export const JobSearchFiltersSchema = z.object({
  queueName: z.string().optional(),
  status: z.nativeEnum(JobStatus).optional(),
  priority: z.nativeEnum(JobPriority).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

// Enhanced queue metrics schema
export const EnhancedQueueMetricsSchema = QueueMetricsSchema.extend({
  throughput: z.number().min(0).default(0),
  averageProcessingTime: z.number().min(0).default(0),
  failureRate: z.number().min(0).max(100).default(0),
});

// Type exports
export type TaskNotificationJob = z.infer<typeof TaskNotificationJobSchema>;
export type EmailJob = z.infer<typeof EmailJobSchema>;
export type ReportGenerationJob = z.infer<typeof ReportGenerationJobSchema>;
export type DataExportJob = z.infer<typeof DataExportJobSchema>;
export type ScheduledTaskJob = z.infer<typeof ScheduledTaskJobSchema>;
export type WebhookDeliveryJob = z.infer<typeof WebhookDeliveryJobSchema>;
export type ClaudeCodeTaskJob = z.infer<typeof ClaudeCodeTaskJobSchema>;
export type QueueJob = z.infer<typeof QueueJobSchema>;
export type JobOptions = z.infer<typeof JobOptionsSchema>;
export type QueueMetrics = z.infer<typeof EnhancedQueueMetricsSchema>;
export type JobRetryStrategy = z.infer<typeof JobRetryStrategySchema>;
export type DelayedJobOptions = z.infer<typeof DelayedJobOptionsSchema>;
export type QueueManagerOptions = z.infer<typeof QueueManagerOptionsSchema>;
export type BulkJobOperation = z.infer<typeof BulkJobOperationSchema>;
export type JobSearchFilters = z.infer<typeof JobSearchFiltersSchema>;