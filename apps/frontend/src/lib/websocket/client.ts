import { io, Socket } from 'socket.io-client';
import { z } from 'zod';
import { tokenStorage, TokenUtils } from '../auth/token-storage';
import {
  WebSocketConfig,
  ConnectionState,
  EventListener,
  WebSocketEvent,
  WebSocketEventSchema,
  IWebSocketClient,
  IEventEmitter,
  IRoomManager,
  RoomSubscription,
} from './types';

/**
 * WebSocket client implementation with JWT authentication and type-safe events
 * Follows SOLID principles with clear separation of concerns
 */
export class WebSocketClient implements IWebSocketClient, IEventEmitter, IRoomManager {
  private socket: Socket | null = null;
  private config: WebSocketConfig;
  private connectionState: ConnectionState;
  private eventListeners: Map<string, Set<EventListener>> = new Map();
  private roomSubscriptions: Map<string, RoomSubscription> = new Map();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private authRetryTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3005',
      autoReconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 5,
      timeout: 10000,
      enableDebugLogs: process.env.NODE_ENV === 'development',
      ...config,
    };

    this.connectionState = {
      isConnected: false,
      isConnecting: false,
      isAuthenticated: false,
      reconnectAttempts: 0,
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      error: null,
    };

    this.log('WebSocket client initialized with config:', this.config);
  }

  /**
   * Connect to WebSocket server with automatic authentication
   */
  async connect(): Promise<void> {
    if (this.connectionState.isConnected || this.connectionState.isConnecting) {
      this.log('Already connected or connecting');
      return;
    }

    this.connectionState.isConnecting = true;
    this.connectionState.error = null;

    try {
      this.log('Connecting to WebSocket server:', this.config.url);

      this.socket = io(this.config.url, {
        timeout: this.config.timeout,
        transports: ['websocket', 'polling'],
        autoConnect: false,
      });

      this.setupEventListeners();

      // Connect with timeout
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, this.config.timeout);

        this.socket!.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.socket!.once('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        this.socket!.connect();
      });

      this.connectionState.isConnected = true;
      this.connectionState.isConnecting = false;
      this.connectionState.lastConnectedAt = new Date();
      this.connectionState.reconnectAttempts = 0;

      this.log('Connected to WebSocket server');

      // Attempt authentication if token is available
      const token = tokenStorage.getToken();
      if (token && !TokenUtils.isTokenExpired(token)) {
        await this.authenticate(token);
      }

    } catch (error) {
      this.connectionState.isConnecting = false;
      this.connectionState.error = error instanceof Error ? error.message : 'Connection failed';
      this.log('Connection failed:', error);

      if (this.config.autoReconnect) {
        this.scheduleReconnect();
      }

      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.log('Disconnecting from WebSocket server');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.authRetryTimer) {
      clearTimeout(this.authRetryTimer);
      this.authRetryTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.connectionState.isConnected = false;
    this.connectionState.isConnecting = false;
    this.connectionState.isAuthenticated = false;
    this.connectionState.lastDisconnectedAt = new Date();
    this.connectionState.reconnectAttempts = 0;

    // Clear room subscriptions
    this.roomSubscriptions.clear();
  }

  /**
   * Authenticate with JWT token
   */
  async authenticate(token: string): Promise<void> {
    if (!this.socket || !this.connectionState.isConnected) {
      throw new Error('Not connected to WebSocket server');
    }

    if (TokenUtils.isTokenExpired(token)) {
      throw new Error('Token is expired');
    }

    this.log('Authenticating with server');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, this.config.timeout);

      this.socket!.once('auth:success', (data) => {
        clearTimeout(timeout);
        this.connectionState.isAuthenticated = true;
        this.connectionState.error = null;
        this.log('Authentication successful:', data);
        resolve();
      });

      this.socket!.once('auth:error', (error) => {
        clearTimeout(timeout);
        this.connectionState.isAuthenticated = false;
        this.connectionState.error = error.message || 'Authentication failed';
        this.log('Authentication failed:', error);
        reject(new Error(error.message || 'Authentication failed'));
      });

      this.socket!.emit('authenticate', { token });
    });
  }

  /**
   * Check if connected to server
   */
  isConnected(): boolean {
    return this.connectionState.isConnected;
  }

  /**
   * Check if authenticated with server
   */
  isAuthenticated(): boolean {
    return this.connectionState.isAuthenticated;
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Register event listener
   */
  on<T extends WebSocketEvent>(event: T['event'], listener: EventListener<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }

    this.eventListeners.get(event)!.add(listener as EventListener);
    this.log(`Event listener registered for: ${event}`);
  }

  /**
   * Remove event listener
   */
  off<T extends WebSocketEvent>(event: T['event'], listener: EventListener<T>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener as EventListener);
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
      this.log(`Event listener removed for: ${event}`);
    }
  }

  /**
   * Emit event to listeners
   */
  emit<T extends WebSocketEvent>(event: T['event'], data: T): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          this.log(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Join a room for real-time updates
   */
  async joinRoom(room: string): Promise<void> {
    if (!this.socket || !this.connectionState.isAuthenticated) {
      throw new Error('Not connected or authenticated');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Failed to join room: ${room}`));
      }, this.config.timeout);

      this.socket!.once('room:joined', (data) => {
        if (data.room === room) {
          clearTimeout(timeout);

          if (!this.roomSubscriptions.has(room)) {
            this.roomSubscriptions.set(room, {
              room,
              subscriptions: new Set(),
              isSubscribed: true,
            });
          } else {
            this.roomSubscriptions.get(room)!.isSubscribed = true;
          }

          this.log(`Joined room: ${room}, members: ${data.members}`);
          resolve();
        }
      });

      this.socket!.once('room:error', (error) => {
        clearTimeout(timeout);
        this.log(`Failed to join room ${room}:`, error);
        reject(new Error(error.message || `Failed to join room: ${room}`));
      });

      this.socket!.emit('join:room', { room });
    });
  }

  /**
   * Leave a room
   */
  async leaveRoom(room: string): Promise<void> {
    if (!this.socket) {
      throw new Error('Not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Failed to leave room: ${room}`));
      }, this.config.timeout);

      this.socket!.once('room:left', (data) => {
        if (data.room === room) {
          clearTimeout(timeout);

          const subscription = this.roomSubscriptions.get(room);
          if (subscription) {
            subscription.isSubscribed = false;
          }

          this.log(`Left room: ${room}`);
          resolve();
        }
      });

      this.socket!.emit('leave:room', { room });
    });
  }

  /**
   * Subscribe to room-specific events
   */
  subscribeToRoom<T extends WebSocketEvent>(
    room: string,
    event: T['event'],
    listener: EventListener<T>
  ): void {
    if (!this.roomSubscriptions.has(room)) {
      this.roomSubscriptions.set(room, {
        room,
        subscriptions: new Set(),
        isSubscribed: false,
      });
    }

    const subscription = this.roomSubscriptions.get(room)!;
    subscription.subscriptions.add(listener as EventListener);

    this.on(event, listener);
    this.log(`Subscribed to ${event} in room: ${room}`);
  }

  /**
   * Unsubscribe from room-specific events
   */
  unsubscribeFromRoom<T extends WebSocketEvent>(
    room: string,
    event: T['event'],
    listener: EventListener<T>
  ): void {
    const subscription = this.roomSubscriptions.get(room);
    if (subscription) {
      subscription.subscriptions.delete(listener as EventListener);
      this.off(event, listener);
      this.log(`Unsubscribed from ${event} in room: ${room}`);
    }
  }

  /**
   * Get room subscriptions
   */
  getRoomSubscriptions(): Record<string, RoomSubscription> {
    const result: Record<string, RoomSubscription> = {};
    this.roomSubscriptions.forEach((subscription, room) => {
      result[room] = { ...subscription };
    });
    return result;
  }

  /**
   * Set up Socket.IO event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      this.log('Socket connected');
      this.connectionState.isConnected = true;
      this.connectionState.isConnecting = false;
      this.connectionState.lastConnectedAt = new Date();
      this.connectionState.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      this.log('Socket disconnected:', reason);
      this.connectionState.isConnected = false;
      this.connectionState.isAuthenticated = false;
      this.connectionState.lastDisconnectedAt = new Date();

      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't auto-reconnect
        this.connectionState.error = 'Server disconnected';
      } else if (this.config.autoReconnect) {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      this.log('Connection error:', error);
      this.connectionState.error = error.message;

      if (this.config.autoReconnect) {
        this.scheduleReconnect();
      }
    });

    // Generic event handler with validation
    this.socket.onAny((eventName: string, data: unknown) => {
      try {
        // Validate event structure
        const eventData = {
          event: eventName,
          timestamp: new Date().toISOString(),
          ...data,
        };

        const validatedEvent = WebSocketEventSchema.parse(eventData);
        this.emit(validatedEvent.event, validatedEvent);

      } catch (error) {
        if (error instanceof z.ZodError) {
          this.log(`Invalid event format for ${eventName}:`, error.errors);
        } else {
          this.log(`Error processing event ${eventName}:`, error);
        }
      }
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.connectionState.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.log('Max reconnection attempts reached');
      this.connectionState.error = 'Max reconnection attempts reached';
      return;
    }

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.connectionState.reconnectAttempts),
      30000 // Max 30 seconds
    );

    this.connectionState.reconnectAttempts++;
    this.log(`Scheduling reconnection attempt ${this.connectionState.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.log(`Reconnection attempt ${this.connectionState.reconnectAttempts}`);
      this.connect().catch(error => {
        this.log('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Debug logging utility
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.config.enableDebugLogs) {
      console.log(`[WebSocket] ${message}`, ...args);
    }
  }
}

/**
 * Default WebSocket client instance
 */
export const defaultWebSocketClient = new WebSocketClient();