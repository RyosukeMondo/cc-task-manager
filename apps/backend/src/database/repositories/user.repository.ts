import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BaseRepository } from './base.repository';
import {
  IUserRepository,
  UserEntity,
  UserRole,
  UserStatus,
} from '../interfaces/user-repository.interface';

/**
 * User Repository Implementation
 * Extends BaseRepository with user-specific operations
 * Following Single Responsibility Principle and Repository Pattern
 */
@Injectable()
export class UserRepository extends BaseRepository<UserEntity> implements IUserRepository {
  constructor(prisma: PrismaService) {
    super(prisma, 'User');
  }

  /**
   * Get the Prisma User model delegate
   */
  protected getModel() {
    return this.prisma.user;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserEntity | null> {
    try {
      this.logger.debug('Finding user by email', { email });
      
      const user = await this.getModel().findUnique({
        where: { email },
      });
      
      if (!user) {
        this.logger.debug('User not found by email', { email });
        return null;
      }
      
      return this.transformToDomain(user);
    } catch (error) {
      this.logger.error('Failed to find user by email', {
        error: error.message,
        email,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<UserEntity | null> {
    try {
      this.logger.debug('Finding user by username', { username });
      
      const user = await this.getModel().findUnique({
        where: { username },
      });
      
      if (!user) {
        this.logger.debug('User not found by username', { username });
        return null;
      }
      
      return this.transformToDomain(user);
    } catch (error) {
      this.logger.error('Failed to find user by username', {
        error: error.message,
        username,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find user by email or username
   */
  async findByEmailOrUsername(identifier: string): Promise<UserEntity | null> {
    try {
      this.logger.debug('Finding user by email or username', { identifier });
      
      const user = await this.getModel().findFirst({
        where: {
          OR: [
            { email: identifier },
            { username: identifier },
          ],
        },
      });
      
      if (!user) {
        this.logger.debug('User not found by email or username', { identifier });
        return null;
      }
      
      return this.transformToDomain(user);
    } catch (error) {
      this.logger.error('Failed to find user by email or username', {
        error: error.message,
        identifier,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    try {
      this.logger.debug('Updating user last login', { id });
      
      await this.getModel().update({
        where: { id },
        data: {
          lastLoginAt: new Date(),
        },
      });
      
      this.logger.log('User last login updated successfully', { id });
    } catch (error) {
      this.logger.error('Failed to update user last login', {
        error: error.message,
        id,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find users by role
   */
  async findByRole(role: UserRole): Promise<UserEntity[]> {
    try {
      this.logger.debug('Finding users by role', { role });
      
      const users = await this.getModel().findMany({
        where: { role },
        orderBy: { createdAt: 'desc' },
      });
      
      this.logger.debug(`Found ${users.length} users with role ${role}`);
      return users.map(user => this.transformToDomain(user));
    } catch (error) {
      this.logger.error('Failed to find users by role', {
        error: error.message,
        role,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Find users by status
   */
  async findByStatus(status: UserStatus): Promise<UserEntity[]> {
    try {
      this.logger.debug('Finding users by status', { status });
      
      const users = await this.getModel().findMany({
        where: { status },
        orderBy: { createdAt: 'desc' },
      });
      
      this.logger.debug(`Found ${users.length} users with status ${status}`);
      return users.map(user => this.transformToDomain(user));
    } catch (error) {
      this.logger.error('Failed to find users by status', {
        error: error.message,
        status,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Check if email is already taken
   */
  async isEmailTaken(email: string, excludeUserId?: string): Promise<boolean> {
    try {
      const whereClause: any = { email };
      
      if (excludeUserId) {
        whereClause.id = { not: excludeUserId };
      }
      
      const count = await this.getModel().count({
        where: whereClause,
      });
      
      return count > 0;
    } catch (error) {
      this.logger.error('Failed to check if email is taken', {
        error: error.message,
        email,
        excludeUserId,
      });
      throw this.handlePrismaError(error);
    }
  }

  /**
   * Check if username is already taken
   */
  async isUsernameTaken(username: string, excludeUserId?: string): Promise<boolean> {
    try {
      const whereClause: any = { username };
      
      if (excludeUserId) {
        whereClause.id = { not: excludeUserId };
      }
      
      const count = await this.getModel().count({
        where: whereClause,
      });
      
      return count > 0;
    } catch (error) {
      this.logger.error('Failed to check if username is taken', {
        error: error.message,
        username,
        excludeUserId,
      });
      throw this.handlePrismaError(error);
    }
  }
}