import { Body, Controller, Post, UseGuards, Get, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CaslAuthGuard } from './guards/casl-auth.guard';
import { CaslAbilityFactory, Actions } from './casl-ability.factory';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequireAbility, createRule } from './decorators/casl.decorator';
import {
  LoginRequest,
  UserRegistration,
  AuthResponse,
  TokenRefresh,
  JWTPayload,
  validateTokenRefresh,
} from '../schemas/auth.schemas';

/**
 * Authentication controller following Single Responsibility Principle
 * Responsible only for handling authentication HTTP endpoints
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  /**
   * User login endpoint
   * Uses existing Zod validation for request validation
   */
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Authenticate user with credentials' })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    type: 'object',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(@Body() loginData: unknown): Promise<AuthResponse> {
    // Validation is handled in the service using existing Zod schemas
    return this.authService.login(loginData);
  }

  /**
   * User registration endpoint
   * Uses existing Zod validation for request validation
   */
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register new user account' })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: 'object',
  })
  @ApiResponse({
    status: 409,
    description: 'User already exists',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid registration data',
  })
  async register(@Body() registrationData: unknown): Promise<AuthResponse> {
    // Validation is handled in the service using existing Zod schemas
    return this.authService.register(registrationData);
  }

  /**
   * Token refresh endpoint
   * Uses existing Zod validation for request validation
   */
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: 'object',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid refresh token',
  })
  async refreshToken(@Body() refreshData: unknown): Promise<AuthResponse> {
    const { refreshToken } = validateTokenRefresh(refreshData);
    return this.authService.refreshToken(refreshToken);
  }

  /**
   * Get current user profile
   * Protected endpoint demonstrating JWT authentication
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
  })
  async getProfile(@Request() req: any) {
    // User information is available from JWT payload via the guard
    return {
      user: req.user,
      message: 'Profile retrieved successfully',
    };
  }

  /**
   * Logout endpoint
   * Placeholder for token invalidation logic
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user and invalidate session' })
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
  })
  async logout(@Request() req: any) {
    // In real implementation, this would invalidate the token/session
    // For now, we'll just return a success message
    return {
      message: 'Logout successful',
      userId: req.user.sub,
    };
  }

  /**
   * Get user permissions endpoint
   * Demonstrates CASL authorization integration
   */
  @Get('permissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user permissions' })
  @ApiResponse({
    status: 200,
    description: 'User permissions retrieved successfully',
  })
  async getPermissions(@CurrentUser() user: JWTPayload) {
    const permissions = this.caslAbilityFactory.getUserPermissions(user);
    return {
      userId: user.sub,
      role: user.role,
      permissions,
    };
  }

  /**
   * Admin-only endpoint demonstrating CASL authorization
   * Shows how to protect endpoints with role-based permissions
   */
  @UseGuards(JwtAuthGuard, CaslAuthGuard)
  @RequireAbility(createRule(Actions.Manage, 'all'))
  @Get('admin/users')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  async getAllUsers(@CurrentUser() user: JWTPayload) {
    // Mock implementation - would use actual user service
    return {
      message: 'Admin access granted',
      requestedBy: user.username,
      users: [], // Would return actual users from database
    };
  }

  /**
   * Token validation endpoint
   * Useful for frontend applications to validate token status
   */
  @Post('validate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate JWT token' })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
  })
  @ApiResponse({
    status: 401,
    description: 'Token is invalid or expired',
  })
  async validateToken(@CurrentUser() user: JWTPayload) {
    return {
      valid: true,
      user: {
        id: user.sub,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      expiresAt: new Date(user.exp * 1000),
    };
  }
}