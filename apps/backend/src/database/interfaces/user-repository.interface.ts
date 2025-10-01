import { IBaseRepository } from './base-repository.interface';

/**
 * User Repository Interface
 * Extends base repository with user-specific operations
 * Following Interface Segregation Principle
 */
export interface IUserRepository extends IBaseRepository<UserEntity> {
  /**
   * Find user by email
   */
  findByEmail(email: string): Promise<UserEntity | null>;

  /**
   * Find user by username
   */
  findByUsername(username: string): Promise<UserEntity | null>;

  /**
   * Find user by email or username
   */
  findByEmailOrUsername(identifier: string): Promise<UserEntity | null>;

  /**
   * Update user's last login timestamp
   */
  updateLastLogin(id: string): Promise<void>;

  /**
   * Find users by role
   */
  findByRole(role: UserRole): Promise<UserEntity[]>;

  /**
   * Find users by status
   */
  findByStatus(status: UserStatus): Promise<UserEntity[]>;

  /**
   * Check if email is already taken
   */
  isEmailTaken(email: string, excludeUserId?: string): Promise<boolean>;

  /**
   * Check if username is already taken
   */
  isUsernameTaken(username: string, excludeUserId?: string): Promise<boolean>;
}

/**
 * User Entity interface aligned with Prisma model
 */
export interface UserEntity {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  password: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

/**
 * User Role enumeration matching Prisma schema
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  MODERATOR = 'MODERATOR',
}

/**
 * User Status enumeration matching Prisma schema
 */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}