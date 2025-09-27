import { z } from 'zod';

/**
 * Queue Job Schemas with Zod Validation
 *
 * Provides type-safe job data validation for all queue jobs following SSOT principle.
 * All job data is validated using these schemas before processing.
 */

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

// Union type for all job types
export const QueueJobSchema = z.discriminatedUnion('type', [
  TaskNotificationJobSchema,
  EmailJobSchema,
  ReportGenerationJobSchema,
  DataExportJobSchema,
  ScheduledTaskJobSchema,
  WebhookDeliveryJobSchema,
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

// Type exports
export type TaskNotificationJob = z.infer<typeof TaskNotificationJobSchema>;
export type EmailJob = z.infer<typeof EmailJobSchema>;
export type ReportGenerationJob = z.infer<typeof ReportGenerationJobSchema>;
export type DataExportJob = z.infer<typeof DataExportJobSchema>;
export type ScheduledTaskJob = z.infer<typeof ScheduledTaskJobSchema>;
export type WebhookDeliveryJob = z.infer<typeof WebhookDeliveryJobSchema>;
export type QueueJob = z.infer<typeof QueueJobSchema>;
export type JobOptions = z.infer<typeof JobOptionsSchema>;
export type QueueMetrics = z.infer<typeof QueueMetricsSchema>;