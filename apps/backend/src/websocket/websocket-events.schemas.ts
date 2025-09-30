import { z } from 'zod';
import { TaskStatus, TaskPriority } from '../schemas/task.schemas';

/**
 * WebSocket Event Types enumeration
 * Defines all possible real-time events that can be emitted
 */
export enum WebSocketEventType {
  // Task-related events
  TASK_CREATED = 'task:created',
  TASK_UPDATED = 'task:updated',
  TASK_DELETED = 'task:deleted',
  TASK_STATUS_CHANGED = 'task:status_changed',
  TASK_ASSIGNED = 'task:assigned',
  TASK_COMMENT_ADDED = 'task:comment_added',
  
  // User-related events
  USER_JOINED = 'user:joined',
  USER_LEFT = 'user:left',
  USER_TYPING = 'user:typing',
  USER_STOPPED_TYPING = 'user:stopped_typing',
  
  // System events
  NOTIFICATION = 'system:notification',
  ALERT = 'system:alert',
  SYSTEM_HEALTH_STATUS = 'system:health_status',
  SYSTEM_PERFORMANCE_METRICS = 'system:performance_metrics',
  SYSTEM_ALERT = 'system:alert_notification',

  // Queue job events
  QUEUE_JOB_STARTED = 'queue:job_started',
  QUEUE_JOB_PROGRESS = 'queue:job_progress',
  QUEUE_JOB_COMPLETED = 'queue:job_completed',
  QUEUE_JOB_FAILED = 'queue:job_failed',
  QUEUE_JOB_STALLED = 'queue:job_stalled',

  // Claude Code execution events
  CLAUDE_EXECUTION_STARTED = 'claude:execution_started',
  CLAUDE_EXECUTION_PROGRESS = 'claude:execution_progress',
  CLAUDE_EXECUTION_OUTPUT = 'claude:execution_output',
  CLAUDE_EXECUTION_COMPLETED = 'claude:execution_completed',
  CLAUDE_EXECUTION_FAILED = 'claude:execution_failed',
  CLAUDE_EXECUTION_PAUSED = 'claude:execution_paused',
  CLAUDE_EXECUTION_RESUMED = 'claude:execution_resumed',
  
  // Room events
  JOIN_ROOM = 'room:join',
  LEAVE_ROOM = 'room:leave',
  
  // Connection events
  CONNECT = 'connection:connect',
  DISCONNECT = 'connection:disconnect',
  HEARTBEAT = 'connection:heartbeat',
}

/**
 * WebSocket Room Types enumeration
 * Defines room categories for message targeting
 */
export enum WebSocketRoomType {
  USER = 'user',           // Personal user room
  PROJECT = 'project',     // Project-specific room
  TASK = 'task',           // Task-specific room
  GLOBAL = 'global',       // Global system announcements
}

/**
 * Notification Level enumeration
 */
export enum NotificationLevel {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

/**
 * Base WebSocket event schema with common properties
 */
export const BaseWebSocketEventSchema = z.object({
  eventType: z.nativeEnum(WebSocketEventType),
  timestamp: z.date().default(() => new Date()),
  userId: z.string().uuid('User ID must be a valid UUID'),
  correlationId: z.string().uuid('Correlation ID must be a valid UUID').optional(),
  room: z.string().min(1, 'Room is required').optional(),
  roomType: z.nativeEnum(WebSocketRoomType).optional(),
});

/**
 * Task event data schema for task-related WebSocket events
 */
export const TaskEventDataSchema = z.object({
  taskId: z.string().uuid('Task ID must be a valid UUID'),
  title: z.string().max(200, 'Task title must not exceed 200 characters'),
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assigneeId: z.string().uuid('Assignee ID must be a valid UUID').optional(),
  projectId: z.string().uuid('Project ID must be a valid UUID').optional(),
  previousStatus: z.nativeEnum(TaskStatus).optional(),
  changes: z.record(z.any()).optional(),
});

/**
 * User activity event data schema
 */
export const UserActivityEventDataSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  activity: z.string().min(1, 'Activity description is required'),
  targetId: z.string().uuid('Target ID must be a valid UUID').optional(),
  targetType: z.enum(['task', 'project', 'user']).optional(),
});

/**
 * System notification event data schema
 */
export const NotificationEventDataSchema = z.object({
  title: z.string().min(1, 'Notification title is required').max(100, 'Title must not exceed 100 characters'),
  message: z.string().min(1, 'Notification message is required').max(500, 'Message must not exceed 500 characters'),
  level: z.nativeEnum(NotificationLevel).default(NotificationLevel.INFO),
  actionUrl: z.string().url('Action URL must be valid').optional(),
  actionText: z.string().max(50, 'Action text must not exceed 50 characters').optional(),
  expiresAt: z.date().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * System health status enumeration
 */
export enum SystemHealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  CRITICAL = 'critical',
}

/**
 * System health event data schema
 */
export const SystemHealthEventDataSchema = z.object({
  service: z.string().min(1, 'Service name is required'),
  status: z.nativeEnum(SystemHealthStatus),
  message: z.string().optional(),
  details: z.record(z.any()).optional(),
  timestamp: z.date().default(() => new Date()),

  // Health check metadata
  responseTime: z.number().min(0).optional(), // milliseconds
  uptime: z.number().min(0).optional(), // seconds
  version: z.string().optional(),
  environment: z.string().optional(),

  // Previous status for tracking changes
  previousStatus: z.nativeEnum(SystemHealthStatus).optional(),
});

/**
 * System performance metrics event data schema
 */
export const SystemPerformanceEventDataSchema = z.object({
  // CPU metrics
  cpuUsage: z.number().min(0).max(100).optional(), // percentage
  cpuLoadAverage: z.array(z.number().min(0)).optional(), // 1min, 5min, 15min

  // Memory metrics
  memoryUsage: z.number().min(0).optional(), // bytes
  memoryTotal: z.number().min(0).optional(), // bytes
  memoryPercentage: z.number().min(0).max(100).optional(), // percentage
  heapUsed: z.number().min(0).optional(), // bytes
  heapTotal: z.number().min(0).optional(), // bytes

  // Disk metrics
  diskUsage: z.number().min(0).optional(), // bytes
  diskTotal: z.number().min(0).optional(), // bytes
  diskPercentage: z.number().min(0).max(100).optional(), // percentage

  // Network metrics
  networkBytesIn: z.number().min(0).optional(),
  networkBytesOut: z.number().min(0).optional(),

  // Application metrics
  activeConnections: z.number().int().min(0).optional(),
  requestsPerSecond: z.number().min(0).optional(),
  averageResponseTime: z.number().min(0).optional(), // milliseconds
  errorRate: z.number().min(0).max(100).optional(), // percentage

  // Database metrics
  dbConnections: z.number().int().min(0).optional(),
  dbQueryTime: z.number().min(0).optional(), // milliseconds
  dbQueueSize: z.number().int().min(0).optional(),

  // Queue metrics
  queueSize: z.number().int().min(0).optional(),
  queueProcessingRate: z.number().min(0).optional(), // jobs/second
  queueFailureRate: z.number().min(0).max(100).optional(), // percentage

  timestamp: z.date().default(() => new Date()),
  service: z.string().min(1, 'Service name is required'),
  environment: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * System alert event data schema
 */
export const SystemAlertEventDataSchema = z.object({
  alertId: z.string().min(1, 'Alert ID is required'),
  title: z.string().min(1, 'Alert title is required').max(100, 'Title must not exceed 100 characters'),
  message: z.string().min(1, 'Alert message is required').max(1000, 'Message must not exceed 1000 characters'),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.enum(['performance', 'security', 'availability', 'error', 'custom']),

  // Alert source information
  service: z.string().min(1, 'Service name is required'),
  component: z.string().optional(),
  environment: z.string().optional(),

  // Alert timing
  triggeredAt: z.date().default(() => new Date()),
  resolvedAt: z.date().optional(),
  acknowledged: z.boolean().default(false),
  acknowledgedBy: z.string().uuid().optional(),
  acknowledgedAt: z.date().optional(),

  // Alert rules and thresholds
  rule: z.string().optional(),
  threshold: z.number().optional(),
  currentValue: z.number().optional(),

  // Alert metadata
  tags: z.array(z.string()).optional(),
  runbook: z.string().url().optional(),
  actionRequired: z.boolean().default(false),
  autoResolve: z.boolean().default(false),
  escalated: z.boolean().default(false),

  metadata: z.record(z.any()).optional(),
});

/**
 * Room management event data schema
 */
export const RoomEventDataSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
  roomType: z.nativeEnum(WebSocketRoomType),
  action: z.enum(['join', 'leave']),
  metadata: z.record(z.any()).optional(),
});

/**
 * Queue job event data schema
 */
export const QueueJobEventDataSchema = z.object({
  jobId: z.string().min(1, 'Job ID is required'),
  queueName: z.string().min(1, 'Queue name is required'),
  jobType: z.string().min(1, 'Job type is required'),
  status: z.enum(['started', 'progress', 'completed', 'failed', 'stalled']),
  progress: z.number().min(0).max(100).optional(),
  result: z.any().optional(),
  error: z.string().optional(),
  attemptsMade: z.number().int().min(0).optional(),
  maxAttempts: z.number().int().min(1).optional(),
  processingTime: z.number().min(0).optional(), // milliseconds
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Connection event data schema
 */
export const ConnectionEventDataSchema = z.object({
  socketId: z.string().min(1, 'Socket ID is required'),
  userAgent: z.string().max(1000, 'User agent must not exceed 1000 characters').optional(),
  ipAddress: z.string().ip('Invalid IP address').optional(),
  connectedAt: z.date().default(() => new Date()),
});

/**
 * Claude execution event data schema
 */
export const ClaudeExecutionEventDataSchema = z.object({
  executionId: z.string().min(1, 'Execution ID is required'),
  taskId: z.string().uuid('Task ID must be a valid UUID').optional(),
  sessionId: z.string().min(1, 'Session ID is required').optional(),
  status: z.enum(['started', 'progress', 'output', 'completed', 'failed', 'paused', 'resumed']),
  progress: z.number().min(0).max(100).optional(),

  // Output data
  output: z.string().optional(),
  outputType: z.enum(['stdout', 'stderr', 'tool_use', 'tool_result', 'user_message', 'assistant_message']).optional(),
  outputChunk: z.string().optional(), // For streaming large outputs
  chunkIndex: z.number().int().min(0).optional(),
  totalChunks: z.number().int().min(1).optional(),

  // Execution metadata
  command: z.string().optional(),
  workingDirectory: z.string().optional(),
  environment: z.record(z.string()).optional(),

  // Performance metrics
  tokensUsed: z.number().int().min(0).optional(),
  executionTime: z.number().min(0).optional(), // milliseconds
  memoryUsage: z.number().min(0).optional(), // bytes
  cpuUsage: z.number().min(0).max(100).optional(), // percentage

  // Result data
  result: z.any().optional(),
  error: z.string().optional(),
  errorCode: z.string().optional(),
  exitCode: z.number().int().optional(),

  // Control flags
  isStreamable: z.boolean().default(true),
  isComplete: z.boolean().default(false),
  canPause: z.boolean().default(false),
  canResume: z.boolean().default(false),

  // Additional metadata
  metadata: z.record(z.any()).optional(),

  // Timestamps
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  lastOutputAt: z.date().optional(),
});

/**
 * Complete WebSocket event schema combining base and event-specific data
 */
export const WebSocketEventSchema = BaseWebSocketEventSchema.and(
  z.union([
    // Task events
    z.object({
      eventType: z.literal(WebSocketEventType.TASK_CREATED),
      data: TaskEventDataSchema,
    }),
    z.object({
      eventType: z.literal(WebSocketEventType.TASK_UPDATED),
      data: TaskEventDataSchema,
    }),
    z.object({
      eventType: z.literal(WebSocketEventType.TASK_DELETED),
      data: TaskEventDataSchema.pick({ taskId: true, title: true }),
    }),
    z.object({
      eventType: z.literal(WebSocketEventType.TASK_STATUS_CHANGED),
      data: TaskEventDataSchema.required({ previousStatus: true }),
    }),
    z.object({
      eventType: z.literal(WebSocketEventType.TASK_ASSIGNED),
      data: TaskEventDataSchema.required({ assigneeId: true }),
    }),
    z.object({
      eventType: z.literal(WebSocketEventType.TASK_COMMENT_ADDED),
      data: TaskEventDataSchema.extend({
        commentId: z.string().uuid('Comment ID must be a valid UUID'),
        commentContent: z.string().max(1000, 'Comment content must not exceed 1000 characters'),
        authorId: z.string().uuid('Author ID must be a valid UUID'),
      }),
    }),
    
    // User activity events
    z.object({
      eventType: z.enum([
        WebSocketEventType.USER_JOINED,
        WebSocketEventType.USER_LEFT,
        WebSocketEventType.USER_TYPING,
        WebSocketEventType.USER_STOPPED_TYPING,
      ]),
      data: UserActivityEventDataSchema,
    }),
    
    // System notification events
    z.object({
      eventType: z.enum([
        WebSocketEventType.NOTIFICATION,
        WebSocketEventType.ALERT,
      ]),
      data: NotificationEventDataSchema,
    }),

    // System health and monitoring events
    z.object({
      eventType: z.literal(WebSocketEventType.SYSTEM_HEALTH_STATUS),
      data: SystemHealthEventDataSchema,
    }),
    z.object({
      eventType: z.literal(WebSocketEventType.SYSTEM_PERFORMANCE_METRICS),
      data: SystemPerformanceEventDataSchema,
    }),
    z.object({
      eventType: z.literal(WebSocketEventType.SYSTEM_ALERT),
      data: SystemAlertEventDataSchema,
    }),

    // Queue job events
    z.object({
      eventType: z.enum([
        WebSocketEventType.QUEUE_JOB_STARTED,
        WebSocketEventType.QUEUE_JOB_PROGRESS,
        WebSocketEventType.QUEUE_JOB_COMPLETED,
        WebSocketEventType.QUEUE_JOB_FAILED,
        WebSocketEventType.QUEUE_JOB_STALLED,
      ]),
      data: QueueJobEventDataSchema,
    }),

    // Claude execution events
    z.object({
      eventType: z.enum([
        WebSocketEventType.CLAUDE_EXECUTION_STARTED,
        WebSocketEventType.CLAUDE_EXECUTION_PROGRESS,
        WebSocketEventType.CLAUDE_EXECUTION_OUTPUT,
        WebSocketEventType.CLAUDE_EXECUTION_COMPLETED,
        WebSocketEventType.CLAUDE_EXECUTION_FAILED,
        WebSocketEventType.CLAUDE_EXECUTION_PAUSED,
        WebSocketEventType.CLAUDE_EXECUTION_RESUMED,
      ]),
      data: ClaudeExecutionEventDataSchema,
    }),
    
    // Room management events
    z.object({
      eventType: z.enum([
        WebSocketEventType.JOIN_ROOM,
        WebSocketEventType.LEAVE_ROOM,
      ]),
      data: RoomEventDataSchema,
    }),
    
    // Connection events
    z.object({
      eventType: z.enum([
        WebSocketEventType.CONNECT,
        WebSocketEventType.DISCONNECT,
        WebSocketEventType.HEARTBEAT,
      ]),
      data: ConnectionEventDataSchema.optional(),
    }),
  ])
);

/**
 * Client-to-server event schema for incoming events
 */
export const ClientWebSocketEventSchema = z.object({
  eventType: z.nativeEnum(WebSocketEventType),
  data: z.record(z.any()).optional(),
  room: z.string().min(1, 'Room is required').optional(),
  targetUserId: z.string().uuid('Target user ID must be a valid UUID').optional(),
});

/**
 * WebSocket authentication schema for initial connection
 */
export const WebSocketAuthSchema = z.object({
  token: z.string().min(1, 'Authentication token is required'),
  userId: z.string().uuid('User ID must be a valid UUID').optional(),
  rooms: z.array(z.string()).default([]),
});

/**
 * WebSocket error response schema
 */
export const WebSocketErrorSchema = z.object({
  error: z.string().min(1, 'Error message is required'),
  code: z.string().min(1, 'Error code is required'),
  correlationId: z.string().uuid('Correlation ID must be a valid UUID').optional(),
  timestamp: z.date().default(() => new Date()),
});

/**
 * WebSocket acknowledgment schema
 */
export const WebSocketAckSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.record(z.any()).optional(),
  correlationId: z.string().uuid('Correlation ID must be a valid UUID').optional(),
});

/**
 * TypeScript types derived from Zod schemas
 */
export type BaseWebSocketEvent = z.infer<typeof BaseWebSocketEventSchema>;
export type TaskEventData = z.infer<typeof TaskEventDataSchema>;
export type UserActivityEventData = z.infer<typeof UserActivityEventDataSchema>;
export type NotificationEventData = z.infer<typeof NotificationEventDataSchema>;
export type SystemHealthEventData = z.infer<typeof SystemHealthEventDataSchema>;
export type SystemPerformanceEventData = z.infer<typeof SystemPerformanceEventDataSchema>;
export type SystemAlertEventData = z.infer<typeof SystemAlertEventDataSchema>;
export type QueueJobEventData = z.infer<typeof QueueJobEventDataSchema>;
export type RoomEventData = z.infer<typeof RoomEventDataSchema>;
export type ConnectionEventData = z.infer<typeof ConnectionEventDataSchema>;
export type ClaudeExecutionEventData = z.infer<typeof ClaudeExecutionEventDataSchema>;
export type WebSocketEvent = z.infer<typeof WebSocketEventSchema>;
export type ClientWebSocketEvent = z.infer<typeof ClientWebSocketEventSchema>;
export type WebSocketAuth = z.infer<typeof WebSocketAuthSchema>;
export type WebSocketError = z.infer<typeof WebSocketErrorSchema>;
export type WebSocketAck = z.infer<typeof WebSocketAckSchema>;

/**
 * Validation helper functions for runtime type checking
 */
export const validateWebSocketEvent = (data: unknown): WebSocketEvent => {
  return WebSocketEventSchema.parse(data);
};

export const validateClientWebSocketEvent = (data: unknown): ClientWebSocketEvent => {
  return ClientWebSocketEventSchema.parse(data);
};

export const validateWebSocketAuth = (data: unknown): WebSocketAuth => {
  return WebSocketAuthSchema.parse(data);
};

export const validateWebSocketError = (data: unknown): WebSocketError => {
  return WebSocketErrorSchema.parse(data);
};

export const validateWebSocketAck = (data: unknown): WebSocketAck => {
  return WebSocketAckSchema.parse(data);
};

/**
 * Helper functions for creating typed WebSocket events
 */
export const createTaskEvent = (
  eventType: WebSocketEventType,
  userId: string,
  taskData: TaskEventData,
  room?: string,
  roomType?: WebSocketRoomType
): WebSocketEvent => {
  return validateWebSocketEvent({
    eventType,
    userId,
    room,
    roomType,
    data: taskData,
  });
};

export const createNotificationEvent = (
  userId: string,
  notificationData: NotificationEventData,
  room?: string,
  roomType?: WebSocketRoomType
): WebSocketEvent => {
  return validateWebSocketEvent({
    eventType: WebSocketEventType.NOTIFICATION,
    userId,
    room,
    roomType,
    data: notificationData,
  });
};

export const createUserActivityEvent = (
  eventType: WebSocketEventType,
  userId: string,
  activityData: UserActivityEventData,
  room?: string,
  roomType?: WebSocketRoomType
): WebSocketEvent => {
  return validateWebSocketEvent({
    eventType,
    userId,
    room,
    roomType,
    data: activityData,
  });
};

export const createQueueJobEvent = (
  eventType: WebSocketEventType,
  userId: string,
  queueJobData: QueueJobEventData,
  room?: string,
  roomType?: WebSocketRoomType
): WebSocketEvent => {
  return validateWebSocketEvent({
    eventType,
    userId,
    room,
    roomType,
    data: queueJobData,
  });
};

export const createClaudeExecutionEvent = (
  eventType: WebSocketEventType,
  userId: string,
  claudeExecutionData: ClaudeExecutionEventData,
  room?: string,
  roomType?: WebSocketRoomType
): WebSocketEvent => {
  return validateWebSocketEvent({
    eventType,
    userId,
    room,
    roomType,
    data: claudeExecutionData,
  });
};

export const createSystemHealthEvent = (
  userId: string,
  systemHealthData: SystemHealthEventData,
  room?: string,
  roomType?: WebSocketRoomType
): WebSocketEvent => {
  return validateWebSocketEvent({
    eventType: WebSocketEventType.SYSTEM_HEALTH_STATUS,
    userId,
    room,
    roomType,
    data: systemHealthData,
  });
};

export const createSystemPerformanceEvent = (
  userId: string,
  performanceData: SystemPerformanceEventData,
  room?: string,
  roomType?: WebSocketRoomType
): WebSocketEvent => {
  return validateWebSocketEvent({
    eventType: WebSocketEventType.SYSTEM_PERFORMANCE_METRICS,
    userId,
    room,
    roomType,
    data: performanceData,
  });
};

export const createSystemAlertEvent = (
  userId: string,
  alertData: SystemAlertEventData,
  room?: string,
  roomType?: WebSocketRoomType
): WebSocketEvent => {
  return validateWebSocketEvent({
    eventType: WebSocketEventType.SYSTEM_ALERT,
    userId,
    room,
    roomType,
    data: alertData,
  });
};