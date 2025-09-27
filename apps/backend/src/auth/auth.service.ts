import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import {
  UserRegistration,
  UserLogin,
  AuthResponse,
  JwtPayload,
  TokenRefresh,
  PasswordResetRequest,
  PasswordResetConfirm,
} from '../schemas/auth.schemas';

/**
 * Authentication Service
 *
 * Implements JWT-based authentication operations following Single Responsibility Principle.
 * Handles user authentication, token generation, and password management.
 * Uses dependency injection for testability and follows Interface Segregation.
 */
@Injectable()
export class AuthService {
  private readonly saltRounds = 12;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user account
   * Follows Open/Closed Principle - can be extended for new registration flows
   */
  async register(userData: UserRegistration): Promise<AuthResponse> {
    // In a real implementation, this would interact with a user repository
    // For now, we'll simulate the registration process

    // Check if user already exists (would typically query database)
    const existingUser = await this.findUserByEmail(userData.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password securely
    const hashedPassword = await this.hashPassword(userData.password);

    // Create user (would typically save to database)
    const newUser = {
      id: this.generateUserId(),
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      password: hashedPassword,
      permissions: this.getDefaultPermissions(userData.role),
    };

    // Generate tokens
    const tokens = await this.generateTokens(newUser);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        permissions: newUser.permissions,
      },
      expiresIn: 3600, // 1 hour
    };
  }

  /**
   * Authenticate user login
   * Implements secure password verification and token generation
   */
  async login(credentials: UserLogin): Promise<AuthResponse> {
    // Find user by email (would typically query database)
    const user = await this.findUserByEmail(credentials.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(credentials.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        permissions: user.permissions,
      },
      expiresIn: 3600, // 1 hour
    };
  }

  /**
   * Refresh access token using refresh token
   * Implements token rotation for enhanced security
   */
  async refreshToken(tokenData: TokenRefresh): Promise<AuthResponse> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(tokenData.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Find user (would typically query database)
      const user = await this.findUserById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          permissions: user.permissions,
        },
        expiresIn: 3600,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Request password reset
   * Generates secure reset token and sends notification
   */
  async requestPasswordReset(data: PasswordResetRequest): Promise<{ message: string }> {
    const user = await this.findUserByEmail(data.email);
    if (!user) {
      // Don't reveal if email exists for security
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token (would typically save to database with expiry)
    const resetToken = this.generateResetToken();

    // In real implementation: save token to database and send email
    console.log(`Password reset token for ${data.email}: ${resetToken}`);

    return { message: 'If the email exists, a reset link has been sent' };
  }

  /**
   * Confirm password reset with new password
   * Validates reset token and updates password securely
   */
  async confirmPasswordReset(data: PasswordResetConfirm): Promise<{ message: string }> {
    // Verify reset token (would typically query database)
    const isValidToken = await this.verifyResetToken(data.token);
    if (!isValidToken) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await this.hashPassword(data.newPassword);

    // Update user password (would typically update database)
    // const user = await this.updateUserPassword(userId, hashedPassword);

    return { message: 'Password reset successfully' };
  }

  /**
   * Generate JWT tokens (access and refresh)
   * Implements secure token generation with appropriate expiry
   */
  private async generateTokens(user: any): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      permissions: user.permissions,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );

    return { accessToken, refreshToken };
  }

  /**
   * Hash password securely using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Verify password against hash
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Get default permissions based on user role
   */
  private getDefaultPermissions(role: string): string[] {
    switch (role) {
      case 'admin':
        return ['user:admin', 'task:admin', 'project:admin'];
      case 'manager':
        return ['task:admin', 'project:admin'];
      case 'user':
      default:
        return [];
    }
  }

  /**
   * Mock database operations - replace with actual database queries
   */
  private async findUserByEmail(email: string): Promise<any | null> {
    // Mock implementation - replace with actual database query
    return null;
  }

  private async findUserById(id: string): Promise<any | null> {
    // Mock implementation - replace with actual database query
    return null;
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateResetToken(): string {
    return Math.random().toString(36).substr(2, 32);
  }

  private async verifyResetToken(token: string): Promise<boolean> {
    // Mock implementation - replace with actual token verification
    return token.length === 32;
  }
}