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
} from '../schemas/auth.schemas';

/**
 * User repository interface following Dependency Inversion Principle
 * Abstracts data access to allow for different implementations
 */
export interface IUserRepository {
  findByEmail(email: string): Promise<UserBase | null>;
  findByUsername(username: string): Promise<UserBase | null>;
  findById(id: string): Promise<UserBase | null>;
  create(userData: UserRegistration): Promise<UserBase>;
  updateLastLogin(id: string): Promise<void>;
}

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
    // Note: UserRepository would be injected here when database module is implemented
    // private userRepository: IUserRepository,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || 'fallback-secret';
    this.jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
    this.refreshTokenExpiresIn = this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN') || '7d';
  }

  /**
   * Authenticate user with email/username and password
   * Demonstrates secure authentication with bcrypt password verification
   */
  async login(loginData: LoginRequest): Promise<AuthResponse> {
    // Validate input using existing Zod schema
    const validatedData = validateLoginRequest(loginData);

    // Find user by email or username
    const user = await this.findUserByIdentifier(validatedData.identifier);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify user status
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    // Verify password (password field would be included in actual user object)
    // For now, using mock password verification
    const isPasswordValid = await this.verifyPassword(
      validatedData.password,
      this.getMockHashedPassword(user.email)
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    // await this.userRepository.updateLastLogin(user.id);

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
   * Demonstrates secure user creation with bcrypt password hashing
   */
  async register(registrationData: UserRegistration): Promise<AuthResponse> {
    // Validate input using existing Zod schema
    const validatedData = validateUserRegistration(registrationData);

    // Check if user already exists
    const existingUser = await this.findUserByIdentifier(validatedData.email);
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const existingUsername = await this.findUserByIdentifier(validatedData.username);
    if (existingUsername) {
      throw new BadRequestException('Username is already taken');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(validatedData.password);

    // Create user
    const newUser: UserBase = {
      id: uuidv4(),
      email: validatedData.email,
      username: validatedData.username,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      role: UserRole.USER, // Default role
      status: UserStatus.ACTIVE, // Default status
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save user (would use repository in actual implementation)
    // const createdUser = await this.userRepository.create(newUser);

    // Generate tokens
    const tokens = await this.generateTokens(newUser);

    return {
      ...tokens,
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        status: newUser.status,
        createdAt: newUser.createdAt,
        updatedAt: newUser.updatedAt,
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
   * Find user by email or username
   * Temporary implementation - would use repository in actual implementation
   */
  private async findUserByIdentifier(identifier: string): Promise<UserBase | null> {
    // Mock implementation - would use actual repository
    if (identifier === 'admin@example.com' || identifier === 'admin') {
      return {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: 'admin@example.com',
        username: 'admin',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
      };
    }
    return null;
  }

  /**
   * Get mock hashed password for testing
   * Would be stored in database in actual implementation
   */
  private getMockHashedPassword(email: string): string {
    // Mock hashed password for "password123!"
    return '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeV4Ru2rMd0xmQ8R6';
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