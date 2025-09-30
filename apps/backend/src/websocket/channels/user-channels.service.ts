import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JWTPayload, UserRole } from '@schemas/auth';
import {
  WebSocketEvent,
  WebSocketEventType,
  WebSocketRoomType,
  validateWebSocketEvent,
} from '../websocket-events.schemas';

/**
 * Permission context interface for event filtering
 */
export interface PermissionContext {
  userId: string;
  role: UserRole;
  projectIds: string[];
  taskIds: string[];
}

/**
 * Event filter interface for customizable filtering logic
 */
export interface EventFilter {
  canReceiveEvent(event: WebSocketEvent, context: PermissionContext): boolean;
}

/**
 * User-specific event channels service
 *
 * This service implements SOLID principles:
 * 1. Single Responsibility Principle - manages user-specific event channels and permissions
 * 2. Open/Closed Principle - extensible via EventFilter interface for custom filtering
 * 3. Liskov Substitution Principle - EventFilter implementations are substitutable
 * 4. Interface Segregation Principle - clean separation of concerns with focused interfaces
 * 5. Dependency Inversion Principle - depends on abstractions (EventFilter interface)
 *
 * Features:
 * - User-specific event channel management with secure isolation
 * - Permission-based event filtering with role and context awareness
 * - Dynamic permission updates with real-time channel management
 * - Performance-optimized permission checks with caching
 * - Comprehensive security boundaries to prevent unauthorized access
 */
@Injectable()
export class UserChannelsService {
  private readonly logger = new Logger(UserChannelsService.name);

  // User channel mapping for quick lookups
  private userChannels = new Map<string, Set<string>>(); // userId -> channel names
  private channelUsers = new Map<string, Set<string>>(); // channel -> userIds

  // Permission context cache for performance
  private permissionCache = new Map<string, PermissionContext>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Event filters for extensible filtering logic
  private eventFilters: EventFilter[] = [];

  /**
   * Initialize user channels for a connected user
   * Creates user-specific channels and sets up permission context
   */
  async initializeUserChannels(userId: string, user: JWTPayload, server: Server): Promise<void> {
    try {
      this.logger.debug(`Initializing channels for user ${user.username} (${userId})`);

      // Create permission context
      const context = await this.buildPermissionContext(userId, user);
      this.setPermissionContext(userId, context);

      // Create user-specific channels
      const personalChannel = this.getPersonalChannelName(userId);
      const roleChannel = this.getRoleChannelName(user.role);

      // Initialize channel mappings
      this.initializeChannelMapping(userId, [personalChannel, roleChannel]);

      // Join user to appropriate project and task channels based on permissions
      await this.subscribeToPermittedChannels(userId, context, server);

      this.logger.log(`User ${user.username} initialized with ${this.getUserChannels(userId).size} channels`);

    } catch (error) {
      this.logger.error(`Failed to initialize channels for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean up user channels on disconnection
   */
  async cleanupUserChannels(userId: string): Promise<void> {
    try {
      this.logger.debug(`Cleaning up channels for user ${userId}`);

      // Remove from all channel mappings
      const userChannels = this.userChannels.get(userId) || new Set();
      for (const channel of userChannels) {
        const channelUserSet = this.channelUsers.get(channel);
        if (channelUserSet) {
          channelUserSet.delete(userId);
          if (channelUserSet.size === 0) {
            this.channelUsers.delete(channel);
          }
        }
      }

      // Clean up user data
      this.userChannels.delete(userId);
      this.permissionCache.delete(userId);
      this.cacheExpiry.delete(userId);

      this.logger.debug(`Cleaned up ${userChannels.size} channels for user ${userId}`);

    } catch (error) {
      this.logger.error(`Failed to cleanup channels for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Filter events based on user permissions
   * Ensures users only receive events they're authorized to see
   */
  async filterEventForUser(event: WebSocketEvent, userId: string): Promise<boolean> {
    try {
      // Get user permission context
      const context = await this.getPermissionContext(userId);
      if (!context) {
        this.logger.warn(`No permission context found for user ${userId}`);
        return false;
      }

      // Apply built-in permission logic
      if (!this.checkBuiltInPermissions(event, context)) {
        return false;
      }

      // Apply custom event filters
      for (const filter of this.eventFilters) {
        if (!filter.canReceiveEvent(event, context)) {
          return false;
        }
      }

      return true;

    } catch (error) {
      this.logger.error(`Error filtering event for user ${userId}: ${error.message}`);
      return false; // Fail secure - deny access on error
    }
  }

  /**
   * Get channels a user is subscribed to
   */
  getUserChannels(userId: string): Set<string> {
    return this.userChannels.get(userId) || new Set();
  }

  /**
   * Get users subscribed to a channel
   */
  getChannelUsers(channel: string): Set<string> {
    return this.channelUsers.get(channel) || new Set();
  }

  /**
   * Subscribe user to additional channels based on permissions
   */
  async subscribeUserToChannel(userId: string, channelName: string, server: Server): Promise<boolean> {
    try {
      const context = await this.getPermissionContext(userId);
      if (!context) {
        return false;
      }

      // Validate channel access
      if (!await this.validateChannelAccess(userId, channelName, context)) {
        this.logger.warn(`User ${userId} denied access to channel ${channelName}`);
        return false;
      }

      // Add to mappings
      this.addUserToChannel(userId, channelName);

      // Find user's socket and join the channel
      const userSockets = await this.findUserSockets(userId, server);
      for (const socket of userSockets) {
        await socket.join(channelName);
      }

      this.logger.debug(`User ${userId} subscribed to channel ${channelName}`);
      return true;

    } catch (error) {
      this.logger.error(`Failed to subscribe user ${userId} to channel ${channelName}: ${error.message}`);
      return false;
    }
  }

  /**
   * Unsubscribe user from channel
   */
  async unsubscribeUserFromChannel(userId: string, channelName: string, server: Server): Promise<void> {
    try {
      // Remove from mappings
      this.removeUserFromChannel(userId, channelName);

      // Find user's socket and leave the channel
      const userSockets = await this.findUserSockets(userId, server);
      for (const socket of userSockets) {
        await socket.leave(channelName);
      }

      this.logger.debug(`User ${userId} unsubscribed from channel ${channelName}`);

    } catch (error) {
      this.logger.error(`Failed to unsubscribe user ${userId} from channel ${channelName}: ${error.message}`);
    }
  }

  /**
   * Update user permissions and refresh channel subscriptions
   */
  async updateUserPermissions(userId: string, newContext: PermissionContext, server: Server): Promise<void> {
    try {
      this.logger.debug(`Updating permissions for user ${userId}`);

      // Update permission context
      this.setPermissionContext(userId, newContext);

      // Get current channels
      const currentChannels = this.getUserChannels(userId);

      // Determine new permitted channels
      const permittedChannels = await this.getPermittedChannels(newContext);

      // Calculate channels to add and remove
      const channelsToAdd = permittedChannels.filter(channel => !currentChannels.has(channel));
      const channelsToRemove = Array.from(currentChannels).filter(channel =>
        !permittedChannels.includes(channel) && !this.isSystemChannel(channel)
      );

      // Apply channel changes
      for (const channel of channelsToAdd) {
        await this.subscribeUserToChannel(userId, channel, server);
      }

      for (const channel of channelsToRemove) {
        await this.unsubscribeUserFromChannel(userId, channel, server);
      }

      this.logger.log(`Updated permissions for user ${userId}: +${channelsToAdd.length} -${channelsToRemove.length} channels`);

    } catch (error) {
      this.logger.error(`Failed to update permissions for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Register custom event filter
   */
  registerEventFilter(filter: EventFilter): void {
    this.eventFilters.push(filter);
    this.logger.debug(`Registered new event filter`);
  }

  /**
   * Get channel statistics for monitoring
   */
  getChannelStatistics(): { totalChannels: number; totalUsers: number; channelUserCounts: Record<string, number> } {
    const channelUserCounts: Record<string, number> = {};
    for (const [channel, users] of this.channelUsers) {
      channelUserCounts[channel] = users.size;
    }

    return {
      totalChannels: this.channelUsers.size,
      totalUsers: this.userChannels.size,
      channelUserCounts,
    };
  }

  /**
   * Build permission context from user data
   */
  private async buildPermissionContext(userId: string, user: JWTPayload): Promise<PermissionContext> {
    // TODO: In a real implementation, fetch user's project/task associations from database
    // For now, return basic context with role-based permissions

    const context: PermissionContext = {
      userId,
      role: user.role,
      projectIds: [], // TODO: Fetch from user-project associations
      taskIds: [], // TODO: Fetch from user-task associations
    };

    return context;
  }

  /**
   * Get or fetch permission context with caching
   */
  private async getPermissionContext(userId: string): Promise<PermissionContext | null> {
    // Check cache validity
    const cacheTime = this.cacheExpiry.get(userId);
    if (cacheTime && Date.now() > cacheTime) {
      this.permissionCache.delete(userId);
      this.cacheExpiry.delete(userId);
    }

    // Return cached context if valid
    let context = this.permissionCache.get(userId);
    if (context) {
      return context;
    }

    // TODO: Refresh context from database if not cached
    // For now, return null to indicate missing context
    return null;
  }

  /**
   * Set permission context with cache
   */
  private setPermissionContext(userId: string, context: PermissionContext): void {
    this.permissionCache.set(userId, context);
    this.cacheExpiry.set(userId, Date.now() + this.CACHE_TTL);
  }

  /**
   * Check built-in permission logic
   */
  private checkBuiltInPermissions(event: WebSocketEvent, context: PermissionContext): boolean {
    // Personal events - users can only see their own
    if (event.eventType.includes('user:') && event.userId !== context.userId) {
      return false;
    }

    // Task events - check task access permissions
    if (event.eventType.startsWith('task:')) {
      const taskData = event.data as any;
      if (taskData?.taskId && !context.taskIds.includes(taskData.taskId)) {
        // Admin users can see all task events
        if (context.role !== UserRole.ADMIN) {
          return false;
        }
      }
    }

    // Project events - check project access permissions
    if (event.roomType === WebSocketRoomType.PROJECT && event.room) {
      const projectId = event.room.replace('project:', '');
      if (!context.projectIds.includes(projectId) && context.role !== UserRole.ADMIN) {
        return false;
      }
    }

    // System events - only admins and moderators
    if (event.eventType.startsWith('system:')) {
      if (context.role !== UserRole.ADMIN && context.role !== UserRole.MODERATOR) {
        return false;
      }
    }

    return true;
  }

  /**
   * Initialize channel mappings for a user
   */
  private initializeChannelMapping(userId: string, channels: string[]): void {
    const userChannelSet = new Set(channels);
    this.userChannels.set(userId, userChannelSet);

    for (const channel of channels) {
      this.addUserToChannel(userId, channel);
    }
  }

  /**
   * Add user to channel mapping
   */
  private addUserToChannel(userId: string, channel: string): void {
    // Add to user's channel set
    let userChannelSet = this.userChannels.get(userId);
    if (!userChannelSet) {
      userChannelSet = new Set();
      this.userChannels.set(userId, userChannelSet);
    }
    userChannelSet.add(channel);

    // Add to channel's user set
    let channelUserSet = this.channelUsers.get(channel);
    if (!channelUserSet) {
      channelUserSet = new Set();
      this.channelUsers.set(channel, channelUserSet);
    }
    channelUserSet.add(userId);
  }

  /**
   * Remove user from channel mapping
   */
  private removeUserFromChannel(userId: string, channel: string): void {
    // Remove from user's channel set
    const userChannelSet = this.userChannels.get(userId);
    if (userChannelSet) {
      userChannelSet.delete(channel);
    }

    // Remove from channel's user set
    const channelUserSet = this.channelUsers.get(channel);
    if (channelUserSet) {
      channelUserSet.delete(userId);
      if (channelUserSet.size === 0) {
        this.channelUsers.delete(channel);
      }
    }
  }

  /**
   * Subscribe user to channels based on permissions
   */
  private async subscribeToPermittedChannels(userId: string, context: PermissionContext, server: Server): Promise<void> {
    const permittedChannels = await this.getPermittedChannels(context);

    for (const channel of permittedChannels) {
      await this.subscribeUserToChannel(userId, channel, server);
    }
  }

  /**
   * Get channels user is permitted to join
   */
  private async getPermittedChannels(context: PermissionContext): Promise<string[]> {
    const channels: string[] = [];

    // Add project channels based on user's project associations
    for (const projectId of context.projectIds) {
      channels.push(this.getProjectChannelName(projectId));
    }

    // Add task channels based on user's task associations
    for (const taskId of context.taskIds) {
      channels.push(this.getTaskChannelName(taskId));
    }

    // Add role-based channels
    if (context.role === UserRole.ADMIN || context.role === UserRole.MODERATOR) {
      channels.push('admin-notifications');
      channels.push('system-events');
    }

    return channels;
  }

  /**
   * Validate if user can access a specific channel
   */
  private async validateChannelAccess(userId: string, channelName: string, context: PermissionContext): Promise<boolean> {
    // Personal channels - only the user can access
    if (channelName === this.getPersonalChannelName(userId)) {
      return true;
    }

    // Role channels - user must have the role
    if (channelName === this.getRoleChannelName(context.role)) {
      return true;
    }

    // Project channels - user must be associated with project
    if (channelName.startsWith('project:')) {
      const projectId = channelName.replace('project:', '');
      return context.projectIds.includes(projectId) || context.role === UserRole.ADMIN;
    }

    // Task channels - user must be associated with task
    if (channelName.startsWith('task:')) {
      const taskId = channelName.replace('task:', '');
      return context.taskIds.includes(taskId) || context.role === UserRole.ADMIN;
    }

    // Admin channels - admin role required
    if (channelName.includes('admin') || channelName.includes('system')) {
      return context.role === UserRole.ADMIN || context.role === UserRole.MODERATOR;
    }

    // Default deny for unknown channels
    return false;
  }

  /**
   * Find all sockets for a user
   */
  private async findUserSockets(userId: string, server: Server): Promise<Socket[]> {
    const sockets: Socket[] = [];
    const socketIds = await server.allSockets();

    for (const socketId of socketIds) {
      const socket = server.sockets.sockets.get(socketId);
      if (socket?.data?.user?.sub === userId) {
        sockets.push(socket);
      }
    }

    return sockets;
  }

  /**
   * Check if channel is a system channel that shouldn't be automatically removed
   */
  private isSystemChannel(channel: string): boolean {
    return channel.startsWith('user:') || channel.startsWith('role:');
  }

  // Channel name generators
  private getPersonalChannelName(userId: string): string {
    return `user:${userId}`;
  }

  private getRoleChannelName(role: UserRole): string {
    return `role:${role.toLowerCase()}`;
  }

  private getProjectChannelName(projectId: string): string {
    return `project:${projectId}`;
  }

  private getTaskChannelName(taskId: string): string {
    return `task:${taskId}`;
  }
}