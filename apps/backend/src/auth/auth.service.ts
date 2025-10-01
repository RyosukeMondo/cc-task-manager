import { Injectable, UnauthorizedException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import {
  LoginRequest,
  AuthResponse,
  JWTPayload,
  UserRegistration,
  UserBase,
  UserRole,
  UserStatus,
  validateLoginRequest,
  validateUserRegistration,
  validateJWTPayload,
} from '@schemas/auth';
import { UserRepository } from '../users/user.repository';
import { PrismaService } from '../database/prisma.service';

/**
 * Authentication Service following Single Responsibility Principle
 * Responsible only for authentication operations and JWT token management
 */
@Injectable()
export class AuthService {
  private readonly saltRounds = 10;
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private userRepository: UserRepository,
    private prisma: PrismaService,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || 'fallback-secret';
    this.jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
    this.refreshTokenExpiresIn = this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') || '7d';
  }

  /**
   * Authenticate user with email/username and password
   * Uses real database and bcrypt password verification
   */
  async login(loginData: LoginRequest): Promise<AuthResponse> {
    // Validate input using existing Zod schema
    const validatedData = validateLoginRequest(loginData);

    // Find user by email or username
    const user = await this.findUserByIdentifier(validatedData.identifier);
    if (!user || !('passwordHash' in user)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify user status
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    // Verify password using bcrypt
    const isPasswordValid = await this.verifyPassword(
      validatedData.password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens and create session
    const tokens = await this.generateTokens(user);

    // Create session in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days for refresh token

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        expiresAt,
        lastActive: new Date(),
      },
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }

  /**
   * Register new user with password hashing
   * Saves to database using Prisma
   */
  async register(registrationData: UserRegistration): Promise<AuthResponse> {
    // Validate input using existing Zod schema
    const validatedData = validateUserRegistration(registrationData);

    // Check if user already exists (409 Conflict for duplicate email)
    const existingEmail = await this.userRepository.findByEmail(validatedData.email);
    if (existingEmail) {
      throw new ConflictException('User with this email already exists');
    }

    const existingUsername = await this.userRepository.findByUsername(validatedData.username);
    if (existingUsername) {
      throw new ConflictException('Username is already taken');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(validatedData.password);

    // Create user in database
    const createdUser = await this.userRepository.create({
      email: validatedData.email,
      username: validatedData.username,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      passwordHash: hashedPassword,
    });

    // Generate tokens and create session
    const tokens = await this.generateTokens(createdUser);

    // Create session in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days for refresh token

    await this.prisma.session.create({
      data: {
        userId: createdUser.id,
        refreshToken: tokens.refreshToken,
        expiresAt,
        lastActive: new Date(),
      },
    });

    return {
      ...tokens,
      user: {
        id: createdUser.id,
        email: createdUser.email,
        username: createdUser.username,
        firstName: createdUser.firstName,
        lastName: createdUser.lastName,
        role: createdUser.role,
        status: createdUser.status,
        createdAt: createdUser.createdAt,
        updatedAt: createdUser.updatedAt,
      },
    };
  }

  /**
   * Validate JWT token and return payload
   * Used by JWT strategy for token validation
   */
  async validateToken(token: string): Promise<JWTPayload> {
    try {
      const payload = this.jwtService.verify(token, { secret: this.jwtSecret });
      return validateJWTPayload(payload);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Generate access and refresh tokens for user
   * Demonstrates JWT token generation with proper payload structure
   */
  private async generateTokens(user: UserBase): Promise<Omit<AuthResponse, 'user'>> {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      sessionId: uuidv4(),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.jwtSecret,
        expiresIn: this.jwtExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.jwtSecret,
        expiresIn: this.refreshTokenExpiresIn,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpirationTime(this.jwtExpiresIn),
      tokenType: 'Bearer',
    };
  }

  /**
   * Hash password using bcrypt
   * Demonstrates secure password hashing
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Verify password against hash
   * Demonstrates secure password verification
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Find user by email or username using real database
   */
  private async findUserByIdentifier(identifier: string): Promise<any | null> {
    // Check if identifier is email or username
    if (identifier.includes('@')) {
      return await this.userRepository.findByEmail(identifier);
    } else {
      return await this.userRepository.findByUsername(identifier);
    }
  }

  /**
   * Refresh access token using refresh token
   * Validates session exists and is not expired, then generates new accessToken
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      // Verify JWT signature and expiration
      const payload = this.jwtService.verify(refreshToken, { secret: this.jwtSecret });

      // Find session by refresh token
      const session = await this.prisma.session.findUnique({
        where: { refreshToken },
        include: { user: true },
      });

      // Verify session exists, is not soft-deleted, and not expired
      if (!session || session.deletedAt !== null) {
        throw new UnauthorizedException('Session not found or invalidated');
      }

      if (session.expiresAt < new Date()) {
        throw new UnauthorizedException('Session expired');
      }

      // Verify user still exists and is active
      const user = session.user;
      if (!user || user.status !== UserStatus.ACTIVE || user.deletedAt !== null) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Generate new access token (keep same refresh token)
      const accessToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          sessionId: session.id,
        },
        {
          secret: this.jwtSecret,
          expiresIn: this.jwtExpiresIn,
        }
      );

      // Update session lastActive timestamp
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastActive: new Date() },
      });

      return {
        accessToken,
        refreshToken, // Return same refresh token
        expiresIn: this.parseExpirationTime(this.jwtExpiresIn),
        tokenType: 'Bearer',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Logout user by soft-deleting all active sessions
   * Implements soft delete to invalidate refresh tokens
   */
  async logout(userId: string): Promise<void> {
    // Soft delete all active sessions for this user
    await this.prisma.session.updateMany({
      where: {
        userId,
        deletedAt: null, // Only update active sessions
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Find user by ID, excluding password field
   * Returns user without sensitive password hash
   */
  async findUserById(id: string): Promise<UserBase | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        password: false, // Exclude password hash
      },
    });

    if (!user || user.deletedAt !== null) {
      return null;
    }

    return user as UserBase;
  }

  /**
   * Parse expiration time string to seconds
   */
  private parseExpirationTime(expirationString: string): number {
    const match = expirationString.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default to 15 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900;
    }
  }
}