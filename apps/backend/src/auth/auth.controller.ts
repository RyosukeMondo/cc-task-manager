import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CaslAuthGuard } from './guards/casl-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { CanManageUsers } from './decorators/auth-policies.decorator';
import {
  UserRegistrationSchema,
  UserLoginSchema,
  TokenRefreshSchema,
  PasswordResetRequestSchema,
  PasswordResetConfirmSchema,
  UserRegistration,
  UserLogin,
  TokenRefresh,
  PasswordResetRequest,
  PasswordResetConfirm,
  AuthResponse,
} from '../schemas/auth.schemas';

/**
 * Authentication Controller
 *
 * Implements REST API endpoints for authentication operations.
 * Follows Single Responsibility Principle by focusing only on HTTP concerns.
 * Uses guards for authorization following Interface Segregation Principle.
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user account
   * Open endpoint that creates new user accounts with validation
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'User successfully registered',
    type: 'object',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'User already exists',
  })
  async register(@Body() userData: UserRegistration): Promise<AuthResponse> {
    // Validate input using Zod schema
    const validatedData = UserRegistrationSchema.parse(userData);
    return this.authService.register(validatedData);
  }

  /**
   * User login authentication
   * Authenticates user credentials and returns JWT tokens
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user login' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully authenticated',
    type: 'object',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async login(@Body() credentials: UserLogin): Promise<AuthResponse> {
    // Validate input using Zod schema
    const validatedCredentials = UserLoginSchema.parse(credentials);
    return this.authService.login(validatedCredentials);
  }

  /**
   * Refresh access token
   * Generates new access token using valid refresh token
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token successfully refreshed',
    type: 'object',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid refresh token',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async refresh(@Body() tokenData: TokenRefresh): Promise<AuthResponse> {
    // Validate input using Zod schema
    const validatedTokenData = TokenRefreshSchema.parse(tokenData);
    return this.authService.refreshToken(validatedTokenData);
  }

  /**
   * Request password reset
   * Initiates password reset process for user
   */
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password reset initiated',
    type: 'object',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async requestPasswordReset(
    @Body() resetData: PasswordResetRequest,
  ): Promise<{ message: string }> {
    // Validate input using Zod schema
    const validatedResetData = PasswordResetRequestSchema.parse(resetData);
    return this.authService.requestPasswordReset(validatedResetData);
  }

  /**
   * Confirm password reset
   * Completes password reset with new password
   */
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm password reset' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Password successfully reset',
    type: 'object',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or expired reset token',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input data',
  })
  async confirmPasswordReset(
    @Body() confirmData: PasswordResetConfirm,
  ): Promise<{ message: string }> {
    // Validate input using Zod schema
    const validatedConfirmData = PasswordResetConfirmSchema.parse(confirmData);
    return this.authService.confirmPasswordReset(validatedConfirmData);
  }

  /**
   * Get current user profile
   * Protected endpoint that returns authenticated user information
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile retrieved successfully',
    type: 'object',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async getProfile(@CurrentUser() user: any) {
    return {
      id: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      permissions: user.permissions,
    };
  }

  /**
   * Logout user
   * Invalidates user session (in a real implementation would blacklist tokens)
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User successfully logged out',
    type: 'object',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async logout(@CurrentUser() user: any): Promise<{ message: string }> {
    // In a real implementation, you would:
    // 1. Add the token to a blacklist
    // 2. Clean up any user sessions
    // 3. Revoke refresh tokens

    return { message: 'Successfully logged out' };
  }

  /**
   * Admin endpoint - List all users
   * Protected endpoint with CASL authorization for user management
   */
  @Get('users')
  @UseGuards(JwtAuthGuard, CaslAuthGuard)
  @CanManageUsers()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Users retrieved successfully',
    type: 'array',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Insufficient permissions',
  })
  async listUsers(@CurrentUser() user: any) {
    // In a real implementation, this would query the database
    // and return a list of users based on the admin's permissions
    return {
      users: [],
      message: 'User management endpoint - implementation pending database integration',
    };
  }

  /**
   * Health check endpoint for authentication service
   * Unprotected endpoint for monitoring service health
   */
  @Get('health')
  @ApiOperation({ summary: 'Authentication service health check' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Service is healthy',
    type: 'object',
  })
  async healthCheck() {
    return {
      status: 'healthy',
      service: 'authentication',
      timestamp: new Date().toISOString(),
      features: {
        jwtAuth: 'enabled',
        caslAuthorization: 'enabled',
        passwordReset: 'enabled',
        tokenRefresh: 'enabled',
      },
    };
  }
}