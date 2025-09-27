/**
 * WebSocket Module Exports
 * 
 * This index file provides a clean interface for importing WebSocket functionality
 * throughout the application. It follows the barrel export pattern for better
 * organization and encapsulation.
 */

// Core WebSocket components
export { WebSocketModule } from './websocket.module';
export { WebSocketGateway } from './websocket.gateway';
export { WebSocketService } from './websocket.service';
export { WebSocketAuthGuard } from './websocket-auth.guard';

// WebSocket event schemas and types
export {
  // Enums
  WebSocketEventType,
  WebSocketRoomType,
  NotificationLevel,
  
  // Schemas
  WebSocketEventSchema,
  ClientWebSocketEventSchema,
  WebSocketAuthSchema,
  WebSocketErrorSchema,
  WebSocketAckSchema,
  
  // Types
  WebSocketEvent,
  ClientWebSocketEvent,
  WebSocketAuth,
  WebSocketError,
  WebSocketAck,
  TaskEventData,
  UserActivityEventData,
  NotificationEventData,
  RoomEventData,
  ConnectionEventData,
  BaseWebSocketEvent,
  
  // Validation functions
  validateWebSocketEvent,
  validateClientWebSocketEvent,
  validateWebSocketAuth,
  validateWebSocketError,
  validateWebSocketAck,
  
  // Helper functions
  createTaskEvent,
  createNotificationEvent,
  createUserActivityEvent,
} from './websocket-events.schemas';

/**
 * Re-export everything as a namespace for organized importing
 */
import * as WebSocket from './websocket-events.schemas';
export { WebSocket };
