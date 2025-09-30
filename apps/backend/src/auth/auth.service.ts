import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
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

/**
 * Authentication Service following Single Responsibility Principle
 * Responsible only for authentication operations and JWT token management
 */
@Injectable()
export class AuthService {
  private readonly saltRounds = 12;
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private userRepository: UserRepository,
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

    // Generate tokens
    const tokens = await this.generateTokens(user);

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

    // Check if user already exists
    const existingEmail = await this.userRepository.findByEmail(validatedData.email);
    if (existingEmail) {
      throw new BadRequestException('User with this email already exists');
    }

    const existingUsername = await this.userRepository.findByUsername(validatedData.username);
    if (existingUsername) {
      throw new BadRequestException('Username is already taken');
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

    // Generate tokens
    const tokens = await this.generateTokens(createdUser);

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
   * Demonstrates secure token refresh with validation
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify(refreshToken, { secret: this.jwtSecret });
      
      // Find user to ensure they still exist and are active
      const user = await this.findUserByIdentifier(payload.email);
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

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
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
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