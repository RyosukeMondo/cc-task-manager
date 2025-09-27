import { z } from 'zod';
import { WebSocketEventSchema, WebSocketEvent } from './types';

/**
 * Utility functions for WebSocket event handling
 */

/**
 * Validate WebSocket event against schema
 */
export function validateWebSocketEvent(data: unknown): WebSocketEvent | null {
  try {
    return WebSocketEventSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn('Invalid WebSocket event format:', error.errors);
    }
    return null;
  }
}

/**
 * Create a typed event data object
 */
export function createWebSocketEvent<T extends WebSocketEvent>(
  event: T['event'],
  data: Omit<T['data'], 'timestamp'>,
  id?: string
): T {
  return {
    event,
    timestamp: new Date().toISOString(),
    id,
    data,
  } as T;
}

/**
 * Format error for WebSocket transmission
 */
export function formatWebSocketError(error: Error | string): {
  message: string;
  code: string;
  timestamp: string;
} {
  const message = typeof error === 'string' ? error : error.message;
  const code = typeof error === 'object' && 'code' in error ?
    String(error.code) : 'UNKNOWN_ERROR';

  return {
    message,
    code,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate room name for task-specific updates
 */
export function getTaskRoom(taskId: string): string {
  return `task:${taskId}`;
}

/**
 * Generate room name for user-specific updates
 */
export function getUserRoom(userId: string): string {
  return `user:${userId}`;
}

/**
 * Generate room name for system-wide updates
 */
export function getSystemRoom(): string {
  return 'system:global';
}

/**
 * Parse room type and ID from room name
 */
export function parseRoomName(room: string): {
  type: 'task' | 'user' | 'system' | 'unknown';
  id?: string;
} {
  const parts = room.split(':');

  if (parts.length !== 2) {
    return { type: 'unknown' };
  }

  const [type, id] = parts;

  switch (type) {
    case 'task':
    case 'user':
    case 'system':
      return { type, id };
    default:
      return { type: 'unknown' };
  }
}

/**
 * Debounce function for event handling
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttle function for event handling
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let isThrottled = false;

  return (...args: Parameters<T>) => {
    if (!isThrottled) {
      func(...args);
      isThrottled = true;
      setTimeout(() => {
        isThrottled = false;
      }, delay);
    }
  };
}