import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ContractValidationPipe } from '@contracts/ContractValidationPipe';
import { JWTPayload } from '../schemas/auth.schemas';
import {
  UserProfileUpdateSchema,
  UserQueryFilterSchema,
  UserRoleUpdateSchema,
  UserStatusUpdateSchema,
  BulkUserActionSchema,
  UserProfileUpdate,
  UserQueryFilter,
  UserRoleUpdate,
  UserStatusUpdate,
  BulkUserAction,
  UserListResponse,
  UserStatistics,
} from './user.schemas';
import { User } from '@prisma/client';

/**
 * User Controller handling HTTP requests for user management
 * Following Single Responsibility Principle - handles only HTTP layer concerns
 */
@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Get current user profile
   */
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Returns the current user profile',
  })
  async getCurrentUser(@CurrentUser() user: JWTPayload): Promise<User> {
    return this.userService.getCurrentUserProfile(user);
  }

  /**
   * Update current user profile
   */
  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
  })
  @UsePipes(new ContractValidationPipe(UserProfileUpdateSchema))
  async updateCurrentUser(
    @CurrentUser() user: JWTPayload,
    @Body() updateData: UserProfileUpdate
  ): Promise<User> {
    return this.userService.updateUserProfile(user.sub, updateData, user);
  }

  /**
   * Get list of users with pagination and filtering
   */
  @Get()
  @ApiOperation({ summary: 'Get list of users' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated list of users',
  })
  @UsePipes(new ContractValidationPipe(UserQueryFilterSchema))
  async getUsers(
    @CurrentUser() user: JWTPayload,
    @Query() filter: UserQueryFilter
  ): Promise<UserListResponse> {
    return this.userService.getUsers(filter, user);
  }

  /**
   * Search users by email or username
   */
  @Get('search')
  @ApiOperation({ summary: 'Search users by email or username' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of matching users',
  })
  async searchUsers(
    @CurrentUser() user: JWTPayload,
    @Query('q') query: string
  ): Promise<Omit<User, 'passwordHash'>[]> {
    return this.userService.searchUsers(query, user);
  }

  /**
   * Get user statistics (admin only)
   */
  @Get('statistics')
  @ApiOperation({ summary: 'Get user statistics (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns user statistics',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getUserStatistics(@CurrentUser() user: JWTPayload): Promise<UserStatistics> {
    return this.userService.getUserStatistics(user);
  }

  /**
   * Perform bulk action on users (admin only)
   */
  @Post('bulk-action')
  @ApiOperation({ summary: 'Perform bulk action on users (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Bulk action performed successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @UsePipes(new ContractValidationPipe(BulkUserActionSchema))
  @HttpCode(HttpStatus.OK)
  async performBulkAction(
    @CurrentUser() user: JWTPayload,
    @Body() bulkAction: BulkUserAction
  ): Promise<{ affected: number }> {
    return this.userService.performBulkAction(bulkAction, user);
  }

  /**
   * Get user by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the user',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No permission to view this user',
  })
  async getUserById(
    @CurrentUser() user: JWTPayload,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<User> {
    return this.userService.getUserById(id, user);
  }

  /**
   * Update user profile
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No permission to update this user',
  })
  @UsePipes(new ContractValidationPipe(UserProfileUpdateSchema))
  async updateUser(
    @CurrentUser() user: JWTPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: UserProfileUpdate
  ): Promise<User> {
    return this.userService.updateUserProfile(id, updateData, user);
  }

  /**
   * Update user role (admin only)
   */
  @Patch(':id/role')
  @ApiOperation({ summary: 'Update user role (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @UsePipes(new ContractValidationPipe(UserRoleUpdateSchema))
  async updateUserRole(
    @CurrentUser() user: JWTPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() roleUpdate: UserRoleUpdate
  ): Promise<User> {
    return this.userService.updateUserRole(id, roleUpdate, user);
  }

  /**
   * Update user status (admin/moderator only)
   */
  @Patch(':id/status')
  @ApiOperation({ summary: 'Update user status (admin/moderator only)' })
  @ApiResponse({
    status: 200,
    description: 'User status updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin or moderator access required',
  })
  @UsePipes(new ContractValidationPipe(UserStatusUpdateSchema))
  async updateUserStatus(
    @CurrentUser() user: JWTPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() statusUpdate: UserStatusUpdate
  ): Promise<User> {
    return this.userService.updateUserStatus(id, statusUpdate, user);
  }

  /**
   * Delete user
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({
    status: 204,
    description: 'User deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - No permission to delete this user',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(
    @CurrentUser() user: JWTPayload,
    @Param('id', ParseUUIDPipe) id: string
  ): Promise<void> {
    return this.userService.deleteUser(id, user);
  }
}