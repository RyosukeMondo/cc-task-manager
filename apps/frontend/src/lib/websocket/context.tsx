'use client';

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { WebSocketClient, defaultWebSocketClient } from './client';
import { useWebSocketConnection } from './hooks';

/**
 * WebSocket context for providing WebSocket client throughout the app
 * Follows React Context patterns for global state management
 */

interface WebSocketContextType {
  client: WebSocketClient;
  isConnected: boolean;
  isAuthenticated: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  authenticate: () => Promise<boolean>;
  isAuthenticating: boolean;
  authError: string | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: React.ReactNode;
  client?: WebSocketClient;
  autoConnect?: boolean;
  room?: string;
}

/**
 * WebSocket provider component
 */
export function WebSocketProvider({
  children,
  client = defaultWebSocketClient,
  autoConnect = true,
  room,
}: WebSocketProviderProps) {
  const connection = useWebSocketConnection(room, client);
  const hasAutoConnected = useRef(false);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && !hasAutoConnected.current && !connection.isConnected && !connection.isConnecting) {
      hasAutoConnected.current = true;
      connection.connect().catch(error => {
        console.error('Auto-connect failed:', error);
      });
    }
  }, [autoConnect, connection]);

  const contextValue: WebSocketContextType = {
    client,
    isConnected: connection.isConnected,
    isAuthenticated: connection.isAuthenticated,
    isConnecting: connection.isConnecting,
    error: connection.error,
    connect: connection.connect,
    disconnect: connection.disconnect,
    authenticate: connection.authenticate,
    isAuthenticating: connection.isAuthenticating,
    authError: connection.authError,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

/**
 * Hook to use WebSocket context
 */
export function useWebSocketContext(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}

/**
 * Hook to use WebSocket client directly
 */
export function useWebSocketClient(): WebSocketClient {
  const { client } = useWebSocketContext();
  return client;
}