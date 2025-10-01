import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { CaslAbilityFactory, Actions } from '../auth/casl-ability.factory';
import { JWTPayload, UserRole, UserStatus } from '@schemas/auth';
import {
  UserProfileUpdate,
  UserQueryFilter,
  UserRoleUpdate,
  UserStatusUpdate,
  UserListResponse,
  UserStatistics,
  BulkUserAction
} from './user.schemas';
import { User } from '@prisma/client';

/**
 * User Service implementing business logic with CASL authorization
 * Following Liskov Substitution Principle for service implementations
 * Following Single Responsibility Principle - handles user management only
 */
@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  /**
   * Get user by ID with authorization check
   */
  async getUserById(id: string, currentUser: JWTPayload): Promise<User> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const ability = this.caslAbilityFactory.createForUser(currentUser);

    // Check if user can read this user's data
    if (!ability.can(Actions.Read, { ...user, __typename: 'User' } as any)) {
      throw new ForbiddenException('You do not have permission to view this user');
    }

    return user;
  }

  /**
   * Get current user profile
   */
  async getCurrentUserProfile(currentUser: JWTPayload): Promise<User> {
    const user = await this.userRepository.findById(currentUser.sub);

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return user;
  }

  /**
   * Get list of users with pagination and filtering
   */
  async getUsers(filter: UserQueryFilter, currentUser: JWTPayload): Promise<UserListResponse> {
    const ability = this.caslAbilityFactory.createForUser(currentUser);

    // Check if user can read users
    if (!ability.can(Actions.Read, 'User')) {
      // User can only see their own profile
      if (currentUser.role === UserRole.USER) {
        const user = await this.userRepository.findById(currentUser.sub);
        if (!user) {
          throw new NotFoundException('User not found');
        }
        return {
          users: [this.sanitizeUser(user)],
          pagination: {
            total: 1,
            page: 1,
            limit: filter.limit,
            totalPages: 1,
          },
        };
      }
      throw new ForbiddenException('You do not have permission to list users');
    }

    const { users, total } = await this.userRepository.findMany(filter);
    const totalPages = Math.ceil(total / filter.limit);

    return {
      users: users.map(user => this.sanitizeUser(user)),
      pagination: {
        total,
        page: filter.page,
        limit: filter.limit,
        totalPages,
      },
    };
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    id: string,
    updateData: UserProfileUpdate,
    currentUser: JWTPayload
  ): Promise<User> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const ability = this.caslAbilityFactory.createForUser(currentUser);

    // Check if user can update this user's data
    if (!ability.can(Actions.Update, { ...user, __typename: 'User' } as any)) {
      throw new ForbiddenException('You do not have permission to update this user');
    }

    // Check for username uniqueness if updating username
    if (updateData.username && updateData.username !== user.username) {
      const usernameExists = await this.userRepository.usernameExists(updateData.username, id);
      if (usernameExists) {
        throw new ConflictException('Username already exists');
      }
    }

    return await this.userRepository.update(id, updateData);
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(
    id: string,
    roleUpdate: UserRoleUpdate,
    currentUser: JWTPayload
  ): Promise<User> {
    // Only admins can update roles
    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can update user roles');
    }

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Prevent admins from demoting themselves
    if (id === currentUser.sub && roleUpdate.role !== UserRole.ADMIN) {
      throw new BadRequestException('You cannot demote your own admin account');
    }

    // Prevent changing role of the last admin
    if (user.role === UserRole.ADMIN && roleUpdate.role !== UserRole.ADMIN) {
      const adminCount = await this.userRepository.findMany({
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        page: 1,
        limit: 2,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });

      if (adminCount.total <= 1) {
        throw new BadRequestException('Cannot demote the last administrator');
      }
    }

    return await this.userRepository.updateRole(id, roleUpdate.role as UserRole);
  }

  /**
   * Update user status (admin/moderator only)
   */
  async updateUserStatus(
    id: string,
    statusUpdate: UserStatusUpdate,
    currentUser: JWTPayload
  ): Promise<User> {
    const ability = this.caslAbilityFactory.createForUser(currentUser);

    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check permissions based on target user role
    if (user.role === UserRole.ADMIN && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can update admin status');
    }

    if (user.role === UserRole.MODERATOR && currentUser.role === UserRole.USER) {
      throw new ForbiddenException('You do not have permission to update moderator status');
    }

    // Prevent admins from suspending themselves
    if (id === currentUser.sub && statusUpdate.status === UserStatus.SUSPENDED) {
      throw new BadRequestException('You cannot suspend your own account');
    }

    // Prevent suspending the last active admin
    if (user.role === UserRole.ADMIN && statusUpdate.status !== UserStatus.ACTIVE) {
      const activeAdminCount = await this.userRepository.findMany({
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        page: 1,
        limit: 2,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });

      if (activeAdminCount.total <= 1) {
        throw new BadRequestException('Cannot suspend the last active administrator');
      }
    }

    return await this.userRepository.updateStatus(id, statusUpdate.status as UserStatus);
  }

  /**
   * Delete user
   */
  async deleteUser(id: string, currentUser: JWTPayload): Promise<void> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const ability = this.caslAbilityFactory.createForUser(currentUser);

    // Check if user can delete this user
    if (!ability.can(Actions.Delete, { ...user, __typename: 'User' } as any)) {
      throw new ForbiddenException('You do not have permission to delete this user');
    }

    // Prevent deleting admin accounts by non-admins
    if (user.role === UserRole.ADMIN && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can delete admin accounts');
    }

    // Prevent admins from deleting themselves
    if (id === currentUser.sub) {
      throw new BadRequestException('You cannot delete your own account');
    }

    // Prevent deleting the last admin
    if (user.role === UserRole.ADMIN) {
      const adminCount = await this.userRepository.findMany({
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        page: 1,
        limit: 2,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });

      if (adminCount.total <= 1) {
        throw new BadRequestException('Cannot delete the last administrator');
      }
    }

    await this.userRepository.delete(id);
  }

  /**
   * Perform bulk action on users (admin only)
   */
  async performBulkAction(
    bulkAction: BulkUserAction,
    currentUser: JWTPayload
  ): Promise<{ affected: number }> {
    // Only admins can perform bulk actions
    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can perform bulk actions');
    }

    // Prevent bulk actions on self
    if (bulkAction.userIds.includes(currentUser.sub)) {
      throw new BadRequestException('You cannot perform bulk actions on your own account');
    }

    let affected = 0;

    switch (bulkAction.action) {
      case 'activate':
        affected = await this.userRepository.updateManyStatus(
          bulkAction.userIds,
          UserStatus.ACTIVE
        );
        break;

      case 'deactivate':
        affected = await this.userRepository.updateManyStatus(
          bulkAction.userIds,
          UserStatus.INACTIVE
        );
        break;

      case 'suspend':
        affected = await this.userRepository.updateManyStatus(
          bulkAction.userIds,
          UserStatus.SUSPENDED
        );
        break;

      case 'delete':
        // Additional check to prevent deleting admins
        for (const userId of bulkAction.userIds) {
          const user = await this.userRepository.findById(userId);
          if (user && user.role === UserRole.ADMIN) {
            throw new BadRequestException('Cannot delete admin accounts in bulk action');
          }
        }
        affected = await this.userRepository.deleteMany(bulkAction.userIds);
        break;

      default:
        throw new BadRequestException(`Invalid bulk action: ${bulkAction.action}`);
    }

    return { affected };
  }

  /**
   * Get user statistics (admin only)
   */
  async getUserStatistics(currentUser: JWTPayload): Promise<UserStatistics> {
    // Only admins can view statistics
    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can view user statistics');
    }

    return await this.userRepository.getStatistics();
  }

  /**
   * Search users by email or username
   */
  async searchUsers(
    query: string,
    currentUser: JWTPayload
  ): Promise<Omit<User, 'password'>[]> {
    const ability = this.caslAbilityFactory.createForUser(currentUser);

    // Check if user can read users
    if (!ability.can(Actions.Read, 'User')) {
      throw new ForbiddenException('You do not have permission to search users');
    }

    const filter: UserQueryFilter = {
      search: query,
      page: 1,
      limit: 10,
      sortBy: 'username',
      sortOrder: 'asc',
    };

    const { users } = await this.userRepository.findMany(filter);
    return users.map(user => this.sanitizeUser(user));
  }

  /**
   * Sanitize user object to remove sensitive data
   */
  private sanitizeUser(user: User): Omit<User, 'password'> {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}