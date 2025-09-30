import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { User, UserRole, UserStatus, Prisma } from '@prisma/client';
import { UserQueryFilter } from './user.schemas';

/**
 * User Repository implementing repository pattern
 * Following Dependency Inversion Principle - depends on abstraction
 */
@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  /**
   * Find users with pagination and filtering
   */
  async findMany(filter: UserQueryFilter): Promise<{
    users: User[];
    total: number;
  }> {
    const { role, status, search, page, limit, sortBy, sortOrder } = filter;

    const where: Prisma.UserWhereInput = {};

    if (role) {
      where.role = role as UserRole;
    }

    if (status) {
      where.status = status as UserStatus;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  /**
   * Create new user
   */
  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  /**
   * Update user by ID
   */
  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete user by ID
   */
  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Delete multiple users
   */
  async deleteMany(ids: string[]): Promise<number> {
    const result = await this.prisma.user.deleteMany({
      where: {
        id: { in: ids },
      },
    });
    return result.count;
  }

  /**
   * Update user status
   */
  async updateStatus(id: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Update user role
   */
  async updateRole(id: string, role: UserRole): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  /**
   * Update multiple users status
   */
  async updateManyStatus(ids: string[], status: UserStatus): Promise<number> {
    const result = await this.prisma.user.updateMany({
      where: {
        id: { in: ids },
      },
      data: { status },
    });
    return result.count;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
      },
    });
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string, excludeUserId?: string): Promise<boolean> {
    const where: Prisma.UserWhereInput = { email };

    if (excludeUserId) {
      where.NOT = { id: excludeUserId };
    }

    const count = await this.prisma.user.count({ where });
    return count > 0;
  }

  /**
   * Check if username exists
   */
  async usernameExists(username: string, excludeUserId?: string): Promise<boolean> {
    const where: Prisma.UserWhereInput = { username };

    if (excludeUserId) {
      where.NOT = { id: excludeUserId };
    }

    const count = await this.prisma.user.count({ where });
    return count > 0;
  }

  /**
   * Get user statistics
   */
  async getStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    pendingVerification: number;
    usersByRole: Record<UserRole, number>;
    recentSignups: number;
    activeToday: number;
  }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      pendingVerification,
      usersByRole,
      recentSignups,
      activeToday,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.user.count({ where: { status: UserStatus.PENDING_VERIFICATION } }),
      this.getUsersByRole(),
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: weekAgo,
          },
        },
      }),
      this.prisma.user.count({
        where: {
          lastLoginAt: {
            gte: todayStart,
          },
        },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      suspendedUsers,
      pendingVerification,
      usersByRole,
      recentSignups,
      activeToday,
    };
  }

  /**
   * Get users grouped by role
   */
  private async getUsersByRole(): Promise<Record<UserRole, number>> {
    const results = await this.prisma.user.groupBy({
      by: ['role'],
      _count: true,
    });

    const usersByRole: Record<UserRole, number> = {
      [UserRole.ADMIN]: 0,
      [UserRole.MODERATOR]: 0,
      [UserRole.USER]: 0,
    };

    results.forEach((result) => {
      usersByRole[result.role] = result._count;
    });

    return usersByRole;
  }
}