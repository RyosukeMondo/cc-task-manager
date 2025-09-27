import { useEffect, useState, useCallback, useRef } from 'react';
import { WebSocketClient, defaultWebSocketClient } from './client';
import {
  WebSocketEvent,
  EventListener,
  ConnectionState,
  TaskUpdateEvent,
  SystemStatusEvent,
} from './types';
import { tokenStorage } from '../auth/token-storage';

/**
 * React hooks for WebSocket functionality
 * Provides easy integration with React components following hooks patterns
 */

/**
 * Hook for managing WebSocket connection state
 */
export function useWebSocket(client: WebSocketClient = defaultWebSocketClient) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    client.getConnectionState()
  );

  const connect = useCallback(async () => {
    try {
      await client.connect();
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
    }
  }, [client]);

  const disconnect = useCallback(() => {
    client.disconnect();
  }, [client]);

  useEffect(() => {
    // Update state when connection changes
    const updateState = () => {
      setConnectionState(client.getConnectionState());
    };

    // Listen for connection state changes
    client.on('auth:success', updateState);
    client.on('auth:error', updateState);
    client.on('user:connected', updateState);
    client.on('user:disconnected', updateState);

    // Initial state update
    updateState();

    // Auto-connect if not connected
    if (!client.isConnected()) {
      connect();
    }

    return () => {
      client.off('auth:success', updateState);
      client.off('auth:error', updateState);
      client.off('user:connected', updateState);
      client.off('user:disconnected', updateState);
    };
  }, [client, connect]);

  return {
    connectionState,
    connect,
    disconnect,
    isConnected: connectionState.isConnected,
    isAuthenticated: connectionState.isAuthenticated,
    isConnecting: connectionState.isConnecting,
    error: connectionState.error,
  };
}

/**
 * Hook for listening to specific WebSocket events
 */
export function useWebSocketEvent<T extends WebSocketEvent>(
  event: T['event'],
  listener: EventListener<T>,
  client: WebSocketClient = defaultWebSocketClient,
  dependencies: React.DependencyList = []
) {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    const stableListener: EventListener<T> = (data) => {
      listenerRef.current(data);
    };

    client.on(event, stableListener);

    return () => {
      client.off(event, stableListener);
    };
  }, [client, event, ...dependencies]);
}

/**
 * Hook for managing room subscriptions
 */
export function useWebSocketRoom(
  room: string,
  client: WebSocketClient = defaultWebSocketClient
) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const joinRoom = useCallback(async () => {
    if (isSubscribed || isJoining) return;

    setIsJoining(true);
    setError(null);

    try {
      await client.joinRoom(room);
      setIsSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setIsJoining(false);
    }
  }, [client, room, isSubscribed, isJoining]);

  const leaveRoom = useCallback(async () => {
    if (!isSubscribed) return;

    try {
      await client.leaveRoom(room);
      setIsSubscribed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave room');
    }
  }, [client, room, isSubscribed]);

  const subscribeToEvent = useCallback(
    <T extends WebSocketEvent>(event: T['event'], listener: EventListener<T>) => {
      client.subscribeToRoom(room, event, listener);
    },
    [client, room]
  );

  const unsubscribeFromEvent = useCallback(
    <T extends WebSocketEvent>(event: T['event'], listener: EventListener<T>) => {
      client.unsubscribeFromRoom(room, event, listener);
    },
    [client, room]
  );

  useEffect(() => {
    // Auto-join room when authenticated
    if (client.isAuthenticated() && !isSubscribed && !isJoining) {
      joinRoom();
    }
  }, [client, joinRoom, isSubscribed, isJoining]);

  useEffect(() => {
    // Leave room on unmount
    return () => {
      if (isSubscribed) {
        leaveRoom();
      }
    };
  }, [leaveRoom, isSubscribed]);

  return {
    isSubscribed,
    isJoining,
    error,
    joinRoom,
    leaveRoom,
    subscribeToEvent,
    unsubscribeFromEvent,
  };
}

/**
 * Hook for real-time task updates
 */
export function useTaskUpdates(
  taskId?: string,
  client: WebSocketClient = defaultWebSocketClient
) {
  const [taskStatus, setTaskStatus] = useState<TaskUpdateEvent['data'] | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useWebSocketEvent(
    'task:update',
    useCallback((event: TaskUpdateEvent) => {
      if (!taskId || event.data.taskId === taskId) {
        setTaskStatus(event.data);
        setLastUpdate(new Date());
      }
    }, [taskId]),
    client
  );

  useWebSocketEvent(
    'task:completed',
    useCallback((event) => {
      if (!taskId || event.data.taskId === taskId) {
        setLastUpdate(new Date());
      }
    }, [taskId]),
    client
  );

  useWebSocketEvent(
    'task:error',
    useCallback((event) => {
      if (!taskId || event.data.taskId === taskId) {
        setLastUpdate(new Date());
      }
    }, [taskId]),
    client
  );

  return {
    taskStatus,
    lastUpdate,
  };
}

/**
 * Hook for system status monitoring
 */
export function useSystemStatus(client: WebSocketClient = defaultWebSocketClient) {
  const [systemStatus, setSystemStatus] = useState<SystemStatusEvent['data'] | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useWebSocketEvent(
    'system:status',
    useCallback((event: SystemStatusEvent) => {
      setSystemStatus(event.data);
      setLastUpdate(new Date());
    }, []),
    client
  );

  return {
    systemStatus,
    lastUpdate,
    activeTasks: systemStatus?.activeTasks ?? 0,
    queueLength: systemStatus?.queueLength ?? 0,
    workerStatus: systemStatus?.workerStatus ?? 'unavailable',
    uptime: systemStatus?.uptime ?? 0,
  };
}

/**
 * Hook for automatic authentication with WebSocket
 */
export function useWebSocketAuth(client: WebSocketClient = defaultWebSocketClient) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const authenticate = useCallback(async () => {
    const token = tokenStorage.getToken();
    if (!token) {
      setAuthError('No authentication token available');
      return false;
    }

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      await client.authenticate(token);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      setAuthError(message);
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [client]);

  useEffect(() => {
    // Listen for auth required events
    const handleAuthRequired = () => {
      authenticate();
    };

    client.on('auth:required', handleAuthRequired);

    return () => {
      client.off('auth:required', handleAuthRequired);
    };
  }, [client, authenticate]);

  useEffect(() => {
    // Auto-authenticate when connected
    if (client.isConnected() && !client.isAuthenticated() && !isAuthenticating) {
      authenticate();
    }
  }, [client, authenticate, isAuthenticating]);

  return {
    authenticate,
    isAuthenticating,
    authError,
  };
}

/**
 * Combined hook for complete WebSocket functionality
 */
export function useWebSocketConnection(
  room?: string,
  client: WebSocketClient = defaultWebSocketClient
) {
  const connection = useWebSocket(client);
  const auth = useWebSocketAuth(client);
  const roomConnection = room ? useWebSocketRoom(room, client) : null;
  const systemStatus = useSystemStatus(client);

  return {
    // Connection state
    ...connection,

    // Authentication
    ...auth,

    // Room management (if room provided)
    room: roomConnection ? {
      ...roomConnection,
      room,
    } : null,

    // System monitoring
    systemStatus: systemStatus.systemStatus,
    systemLastUpdate: systemStatus.lastUpdate,
  };
}