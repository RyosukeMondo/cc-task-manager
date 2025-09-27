/**
 * WebSocket client library for real-time communication
 *
 * Features:
 * - JWT authentication integration
 * - Type-safe event handling with Zod validation
 * - Automatic reconnection with exponential backoff
 * - Room-based subscriptions
 * - React hooks for easy integration
 * - SOLID principles implementation
 */

// Core client and types
export { WebSocketClient, defaultWebSocketClient } from './client';
export * from './types';

// React integration
export * from './hooks';
export * from './context';

// Utilities
export { validateWebSocketEvent } from './utils';