import { z } from 'zod';
import { TaskStatusSchema, TaskState } from '@cc-task-manager/schemas';

/**
 * WebSocket event types for type-safe client-server communication
 */

// Base event schema for all WebSocket messages
export const BaseEventSchema = z.object({
  event: z.string(),
  timestamp: z.string().datetime(),
  id: z.string().uuid().optional(),
});

// Task-related events
export const TaskUpdateEventSchema = BaseEventSchema.extend({
  event: z.literal('task:update'),
  data: TaskStatusSchema,
});

export const TaskCreatedEventSchema = BaseEventSchema.extend({
  event: z.literal('task:created'),
  data: z.object({
    taskId: z.string(),
    sessionName: z.string(),
    userId: z.string(),
    createdAt: z.string().datetime(),
  }),
});

export const TaskCompletedEventSchema = BaseEventSchema.extend({
  event: z.literal('task:completed'),
  data: z.object({
    taskId: z.string(),
    result: z.string().optional(),
    duration: z.number(),
    exitCode: z.number(),
  }),
});

export const TaskErrorEventSchema = BaseEventSchema.extend({
  event: z.literal('task:error'),
  data: z.object({
    taskId: z.string(),
    error: z.string(),
    stackTrace: z.string().optional(),
  }),
});

// System events
export const SystemStatusEventSchema = BaseEventSchema.extend({
  event: z.literal('system:status'),
  data: z.object({
    activeTasks: z.number(),
    queueLength: z.number(),
    workerStatus: z.enum(['healthy', 'degraded', 'unavailable']),
    uptime: z.number(),
  }),
});

export const UserConnectedEventSchema = BaseEventSchema.extend({
  event: z.literal('user:connected'),
  data: z.object({
    userId: z.string(),
    sessionId: z.string(),
    connectedAt: z.string().datetime(),
  }),
});

export const UserDisconnectedEventSchema = BaseEventSchema.extend({
  event: z.literal('user:disconnected'),
  data: z.object({
    userId: z.string(),
    sessionId: z.string(),
    disconnectedAt: z.string().datetime(),
    reason: z.string().optional(),
  }),
});

// Authentication events
export const AuthRequiredEventSchema = BaseEventSchema.extend({
  event: z.literal('auth:required'),
  data: z.object({
    message: z.string(),
    retryAfter: z.number().optional(),
  }),
});

export const AuthSuccessEventSchema = BaseEventSchema.extend({
  event: z.literal('auth:success'),
  data: z.object({
    userId: z.string(),
    sessionId: z.string(),
    permissions: z.array(z.string()),
  }),
});

export const AuthErrorEventSchema = BaseEventSchema.extend({
  event: z.literal('auth:error'),
  data: z.object({
    message: z.string(),
    code: z.string(),
  }),
});

// Room/subscription events
export const RoomJoinedEventSchema = BaseEventSchema.extend({
  event: z.literal('room:joined'),
  data: z.object({
    room: z.string(),
    members: z.number(),
  }),
});

export const RoomLeftEventSchema = BaseEventSchema.extend({
  event: z.literal('room:left'),
  data: z.object({
    room: z.string(),
    reason: z.string().optional(),
  }),
});

// Union type for all possible events
export const WebSocketEventSchema = z.discriminatedUnion('event', [
  TaskUpdateEventSchema,
  TaskCreatedEventSchema,
  TaskCompletedEventSchema,
  TaskErrorEventSchema,
  SystemStatusEventSchema,
  UserConnectedEventSchema,
  UserDisconnectedEventSchema,
  AuthRequiredEventSchema,
  AuthSuccessEventSchema,
  AuthErrorEventSchema,
  RoomJoinedEventSchema,
  RoomLeftEventSchema,
]);

// TypeScript types
export type WebSocketEvent = z.infer<typeof WebSocketEventSchema>;
export type TaskUpdateEvent = z.infer<typeof TaskUpdateEventSchema>;
export type TaskCreatedEvent = z.infer<typeof TaskCreatedEventSchema>;
export type TaskCompletedEvent = z.infer<typeof TaskCompletedEventSchema>;
export type TaskErrorEvent = z.infer<typeof TaskErrorEventSchema>;
export type SystemStatusEvent = z.infer<typeof SystemStatusEventSchema>;
export type UserConnectedEvent = z.infer<typeof UserConnectedEventSchema>;
export type UserDisconnectedEvent = z.infer<typeof UserDisconnectedEventSchema>;
export type AuthRequiredEvent = z.infer<typeof AuthRequiredEventSchema>;
export type AuthSuccessEvent = z.infer<typeof AuthSuccessEventSchema>;
export type AuthErrorEvent = z.infer<typeof AuthErrorEventSchema>;
export type RoomJoinedEvent = z.infer<typeof RoomJoinedEventSchema>;
export type RoomLeftEvent = z.infer<typeof RoomLeftEventSchema>;

/**
 * WebSocket client configuration
 */
export interface WebSocketConfig {
  url: string;
  autoReconnect: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  timeout: number;
  enableDebugLogs: boolean;
}

/**
 * WebSocket connection state
 */
export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isAuthenticated: boolean;
  reconnectAttempts: number;
  lastConnectedAt: Date | null;
  lastDisconnectedAt: Date | null;
  error: string | null;
}

/**
 * Event listener function type
 */
export type EventListener<T extends WebSocketEvent = WebSocketEvent> = (event: T) => void;

/**
 * Room subscription interface
 */
export interface RoomSubscription {
  room: string;
  subscriptions: Set<EventListener>;
  isSubscribed: boolean;
}

/**
 * WebSocket client interface following Interface Segregation Principle
 */
export interface IWebSocketClient {
  connect(): Promise<void>;
  disconnect(): void;
  authenticate(token: string): Promise<void>;
  isConnected(): boolean;
  isAuthenticated(): boolean;
  getConnectionState(): ConnectionState;
}

export interface IEventEmitter {
  on<T extends WebSocketEvent>(event: T['event'], listener: EventListener<T>): void;
  off<T extends WebSocketEvent>(event: T['event'], listener: EventListener<T>): void;
  emit<T extends WebSocketEvent>(event: T['event'], data: T): void;
}

export interface IRoomManager {
  joinRoom(room: string): Promise<void>;
  leaveRoom(room: string): Promise<void>;
  subscribeToRoom<T extends WebSocketEvent>(
    room: string,
    event: T['event'],
    listener: EventListener<T>
  ): void;
  unsubscribeFromRoom<T extends WebSocketEvent>(
    room: string,
    event: T['event'],
    listener: EventListener<T>
  ): void;
  getRoomSubscriptions(): Record<string, RoomSubscription>;
}