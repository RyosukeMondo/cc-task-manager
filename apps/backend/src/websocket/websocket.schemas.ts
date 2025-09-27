import { z } from 'zod';

/**
 * WebSocket event types enumeration
 * Defines all possible events that can be sent/received via WebSocket
 */
export enum WebSocketEvent {
  // Connection events
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  
  // Task events
  TASK_CREATED = 'task_created',
  TASK_UPDATED = 'task_updated',
  TASK_DELETED = 'task_deleted',
  TASK_STATUS_CHANGED = 'task_status_changed',
  TASK_ASSIGNED = 'task_assigned',
  TASK_UNASSIGNED = 'task_unassigned',
  
  // User events
  USER_ONLINE = 'user_online',
  USER_OFFLINE = 'user_offline',
  USER_TYPING = 'user_typing',
  USER_STOPPED_TYPING = 'user_stopped_typing',
  
  // System notifications
  NOTIFICATION = 'notification',
  SYSTEM_ALERT = 'system_alert',
  
  // Real-time updates
  DATA_SYNC = 'data_sync',
  REALTIME_UPDATE = 'realtime_update',
}

/**
 * WebSocket room types for targeted messaging
 */
export enum WebSocketRoom {
  GLOBAL = 'global',
  USER_SPECIFIC = 'user_',
  PROJECT = 'project_',
  TASK = 'task_',
  TEAM = 'team_',
}

/**
 * Base WebSocket event schema with common properties
 */
export const BaseWebSocketEventSchema = z.object({
  event: z.nativeEnum(WebSocketEvent),
  timestamp: z.date().default(() => new Date()),
  correlationId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
});

/**
 * Room management event schemas
 */
export const JoinRoomEventSchema = BaseWebSocketEventSchema.extend({
  event: z.literal(WebSocketEvent.JOIN_ROOM),
  roomId: z.string().min(1, 'Room ID is required'),
  roomType: z.nativeEnum(WebSocketRoom),
});

export const LeaveRoomEventSchema = BaseWebSocketEventSchema.extend({
  event: z.literal(WebSocketEvent.LEAVE_ROOM),
  roomId: z.string().min(1, 'Room ID is required'),
  roomType: z.nativeEnum(WebSocketRoom),
});

/**
 * Task event schemas
 */
export const TaskCreatedEventSchema = BaseWebSocketEventSchema.extend({
  event: z.literal(WebSocketEvent.TASK_CREATED),
  data: z.object({
    taskId: z.string().uuid(),
    title: z.string(),
    description: z.string().optional(),
    status: z.string(),
    priority: z.string(),
    assigneeId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    createdBy: z.string().uuid(),
  }),
});

export const TaskUpdatedEventSchema = BaseWebSocketEventSchema.extend({
  event: z.literal(WebSocketEvent.TASK_UPDATED),
  data: z.object({
    taskId: z.string().uuid(),
    changes: z.record(z.any()),
    updatedBy: z.string().uuid(),
    previousValues: z.record(z.any()).optional(),
  }),
});

export const TaskDeletedEventSchema = BaseWebSocketEventSchema.extend({
  event: z.literal(WebSocketEvent.TASK_DELETED),
  data: z.object({
    taskId: z.string().uuid(),
    deletedBy: z.string().uuid(),
    reason: z.string().optional(),
  }),
});

export const TaskStatusChangedEventSchema = BaseWebSocketEventSchema.extend({
  event: z.literal(WebSocketEvent.TASK_STATUS_CHANGED),
  data: z.object({
    taskId: z.string().uuid(),
    oldStatus: z.string(),
    newStatus: z.string(),
    changedBy: z.string().uuid(),
    comment: z.string().optional(),
  }),
});

export const TaskAssignedEventSchema = BaseWebSocketEventSchema.extend({
  event: z.literal(WebSocketEvent.TASK_ASSIGNED),
  data: z.object({
    taskId: z.string().uuid(),
    assigneeId: z.string().uuid(),
    assignedBy: z.string().uuid(),
    message: z.string().optional(),
  }),
});

/**
 * User presence event schemas
 */
export const UserOnlineEventSchema = BaseWebSocketEventSchema.extend({
  event: z.literal(WebSocketEvent.USER_ONLINE),
  data: z.object({
    userId: z.string().uuid(),
    username: z.string(),
    status: z.string().default('online'),
    lastSeen: z.date(),
  }),
});

export const UserOfflineEventSchema = BaseWebSocketEventSchema.extend({
  event: z.literal(WebSocketEvent.USER_OFFLINE),
  data: z.object({
    userId: z.string().uuid(),
    username: z.string(),
    lastSeen: z.date(),
  }),
});

export const UserTypingEventSchema = BaseWebSocketEventSchema.extend({
  event: z.literal(WebSocketEvent.USER_TYPING),
  data: z.object({
    userId: z.string().uuid(),
    username: z.string(),
    context: z.string(), // e.g., 'task_comment', 'chat_message'
    contextId: z.string().uuid().optional(), // task ID, chat ID, etc.
  }),
});

/**
 * Notification event schemas
 */
export const NotificationEventSchema = BaseWebSocketEventSchema.extend({
  event: z.literal(WebSocketEvent.NOTIFICATION),
  data: z.object({
    id: z.string().uuid(),
    type: z.enum(['info', 'warning', 'error', 'success']),
    title: z.string(),
    message: z.string(),
    actionUrl: z.string().url().optional(),
    actionText: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    autoClose: z.boolean().default(true),
    duration: z.number().positive().optional(), // milliseconds
  }),
});

export const SystemAlertEventSchema = BaseWebSocketEventSchema.extend({
  event: z.literal(WebSocketEvent.SYSTEM_ALERT),
  data: z.object({
    id: z.string().uuid(),
    severity: z.enum(['info', 'warning', 'critical']),
    message: z.string(),
    affectedServices: z.array(z.string()).optional(),
    maintenanceWindow: z.object({
      start: z.date(),
      end: z.date(),
    }).optional(),
    actionRequired: z.boolean().default(false),
  }),
});

/**
 * Real-time data sync schemas
 */
export const DataSyncEventSchema = BaseWebSocketEventSchema.extend({
  event: z.literal(WebSocketEvent.DATA_SYNC),
  data: z.object({
    entityType: z.string(), // 'task', 'project', 'user', etc.
    entityId: z.string().uuid(),
    operation: z.enum(['create', 'update', 'delete']),
    payload: z.record(z.any()),
    version: z.number().optional(),
  }),
});

export const RealtimeUpdateEventSchema = BaseWebSocketEventSchema.extend({
  event: z.literal(WebSocketEvent.REALTIME_UPDATE),
  data: z.object({
    type: z.string(),
    payload: z.record(z.any()),
    targetRooms: z.array(z.string()).optional(),
    excludeUsers: z.array(z.string().uuid()).optional(),
  }),
});

/**
 * Connection authentication schema
 */
export const WebSocketAuthSchema = z.object({
  token: z.string().min(1, 'JWT token is required'),
  clientInfo: z.object({
    userAgent: z.string().optional(),
    platform: z.string().optional(),
    version: z.string().optional(),
  }).optional(),
});

/**
 * WebSocket error schema
 */
export const WebSocketErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  code: z.number().optional(),
  details: z.record(z.any()).optional(),
  timestamp: z.date().default(() => new Date()),
});

/**
 * Union type for all WebSocket events
 */
export const WebSocketEventSchema = z.discriminatedUnion('event', [
  JoinRoomEventSchema,
  LeaveRoomEventSchema,
  TaskCreatedEventSchema,
  TaskUpdatedEventSchema,
  TaskDeletedEventSchema,
  TaskStatusChangedEventSchema,
  TaskAssignedEventSchema,
  UserOnlineEventSchema,
  UserOfflineEventSchema,
  UserTypingEventSchema,
  NotificationEventSchema,
  SystemAlertEventSchema,
  DataSyncEventSchema,
  RealtimeUpdateEventSchema,
]);

/**
 * TypeScript types derived from Zod schemas
 */
export type BaseWebSocketEvent = z.infer<typeof BaseWebSocketEventSchema>;
export type JoinRoomEvent = z.infer<typeof JoinRoomEventSchema>;
export type LeaveRoomEvent = z.infer<typeof LeaveRoomEventSchema>;
export type TaskCreatedEvent = z.infer<typeof TaskCreatedEventSchema>;
export type TaskUpdatedEvent = z.infer<typeof TaskUpdatedEventSchema>;
export type TaskDeletedEvent = z.infer<typeof TaskDeletedEventSchema>;
export type TaskStatusChangedEvent = z.infer<typeof TaskStatusChangedEventSchema>;
export type TaskAssignedEvent = z.infer<typeof TaskAssignedEventSchema>;
export type UserOnlineEvent = z.infer<typeof UserOnlineEventSchema>;
export type UserOfflineEvent = z.infer<typeof UserOfflineEventSchema>;
export type UserTypingEvent = z.infer<typeof UserTypingEventSchema>;
export type NotificationEvent = z.infer<typeof NotificationEventSchema>;
export type SystemAlertEvent = z.infer<typeof SystemAlertEventSchema>;
export type DataSyncEvent = z.infer<typeof DataSyncEventSchema>;
export type RealtimeUpdateEvent = z.infer<typeof RealtimeUpdateEventSchema>;
export type WebSocketAuth = z.infer<typeof WebSocketAuthSchema>;
export type WebSocketError = z.infer<typeof WebSocketErrorSchema>;
export type WebSocketEventUnion = z.infer<typeof WebSocketEventSchema>;

/**
 * Validation helper functions for runtime type checking
 */
export const validateWebSocketEvent = (data: unknown): WebSocketEventUnion => {
  return WebSocketEventSchema.parse(data);
};

export const validateWebSocketAuth = (data: unknown): WebSocketAuth => {
  return WebSocketAuthSchema.parse(data);
};

export const validateJoinRoomEvent = (data: unknown): JoinRoomEvent => {
  return JoinRoomEventSchema.parse(data);
};

export const validateLeaveRoomEvent = (data: unknown): LeaveRoomEvent => {
  return LeaveRoomEventSchema.parse(data);
};

export const validateTaskCreatedEvent = (data: unknown): TaskCreatedEvent => {
  return TaskCreatedEventSchema.parse(data);
};

export const validateTaskUpdatedEvent = (data: unknown): TaskUpdatedEvent => {
  return TaskUpdatedEventSchema.parse(data);
};

export const validateNotificationEvent = (data: unknown): NotificationEvent => {
  return NotificationEventSchema.parse(data);
};

export const validateDataSyncEvent = (data: unknown): DataSyncEvent => {
  return DataSyncEventSchema.parse(data);
};